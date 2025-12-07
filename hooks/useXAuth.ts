import { useCallback, useEffect, useState } from 'react';

interface UseXAuthOptions {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
}

interface AuthState {
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

const CODE_VERIFIER_KEY = 'x_pkce_verifier';
const AUTH_STATE_KEY = 'x_pkce_state';
const TOKEN_KEY = 'x_user_bearer_token';

function toBase64Url(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256(input: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return toBase64Url(hash);
}

function generateCodeVerifier(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

function generateState(length = 24) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

export function useXAuth({ clientId, redirectUri, scopes = ['tweet.read', 'users.read', 'follows.read', 'offline.access'] }: UseXAuthOptions) {
  const [state, setState] = useState<AuthState>({
    token: typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,
    isLoading: false,
    error: null,
  });

  const clearVerifier = () => {
    localStorage.removeItem(CODE_VERIFIER_KEY);
    localStorage.removeItem(AUTH_STATE_KEY);
  };

  const setManualToken = useCallback((token: string) => {
    const trimmed = token.trim();
    if (!trimmed) return;
    localStorage.setItem(TOKEN_KEY, trimmed);
    clearVerifier();
    setState({ token: trimmed, isLoading: false, error: null });
  }, []);

  const startAuth = useCallback(async () => {
    if (!clientId || !redirectUri) {
      setState((prev) => ({ ...prev, error: 'Missing X client ID or redirect URI' }));
      return;
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await sha256(codeVerifier);
    const authState = generateState();

    localStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);
    localStorage.setItem(AUTH_STATE_KEY, authState);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state: authState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `https://api.x.com/oauth2/authorize?${params.toString()}`;
    window.location.href = authUrl;
  }, [clientId, redirectUri, scopes]);

  const exchangeCodeForToken = useCallback(async (code: string, returnedState: string | null) => {
    const storedState = localStorage.getItem(AUTH_STATE_KEY);
    if (!storedState || storedState !== returnedState) {
      throw new Error('State mismatch during X auth');
    }
    const codeVerifier = localStorage.getItem(CODE_VERIFIER_KEY);
    if (!codeVerifier) {
      throw new Error('Missing PKCE verifier');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      client_id: clientId,
    });

    const res = await fetch('/api/twitter/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Unable to parse token response');
    }

    if (!res.ok) {
      throw new Error(json.error_description || json.error || 'Failed to exchange code for token');
    }

    const token = json.access_token as string | undefined;
    if (!token) {
      throw new Error('No access token returned');
    }

    localStorage.setItem(TOKEN_KEY, token);
    clearVerifier();
    setState({ token, isLoading: false, error: null });
    return token;
  }, [clientId, redirectUri]);

  const clearToken = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    clearVerifier();
    setState({ token: null, isLoading: false, error: null });
  }, []);

  const completeAuthFromRedirect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    if (!code) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      await exchangeCodeForToken(code, returnedState);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      window.history.replaceState({}, document.title, url.toString());
    } catch (err) {
      setState({ token: null, isLoading: false, error: err instanceof Error ? err.message : 'Auth failed' });
    } finally {
      clearVerifier();
    }
  }, [exchangeCodeForToken]);

  useEffect(() => {
    completeAuthFromRedirect();
  }, [completeAuthFromRedirect]);

  return {
    token: state.token,
    isLoading: state.isLoading,
    error: state.error,
    startAuth,
    clearToken,
    setManualToken,
  };
}
