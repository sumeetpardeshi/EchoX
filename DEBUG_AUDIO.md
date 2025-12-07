# Debug Audio Playback Issues

## Current Status
- ✅ Trends loading from database
- ❌ Audio not playing

## Possible Issues

### 1. Check Browser Console
Open browser DevTools (F12) and check the Console tab. Look for:
- `🎙️ Generating audio client-side...`
- `✅ Track ready: ... duration: X.XXs`
- `▶️ Starting audio playback...`
- Any error messages

### 2. Check Audio Context State
The audio might not be playing because:
- Audio context is suspended (needs user interaction)
- Audio context was not unlocked

**Fix**: Make sure you clicked the "Start Listening" button on the splash screen.

### 3. Check API Keys
Audio generation requires:
- `GEMINI_API_KEY` - for summarization
- `XAI_API_KEY` - for TTS (text-to-speech)

Verify both are set in `.env.local`

### 4. Check Network Tab
In DevTools → Network tab, look for:
- Failed requests to XAI API
- Failed requests to Gemini API
- CORS errors

### 5. Common Issues

#### "xAI service not available"
- Check `XAI_API_KEY` is set
- Check it's loaded in the app (check console on page load)

#### "Gemini service not available"
- Check `GEMINI_API_KEY` is set
- Check it's loaded in the app

#### Audio context suspended
- Click the "Start Listening" button
- Or interact with the page first

#### Audio generation fails silently
- Check browser console for errors
- Check Network tab for failed API calls
- Verify API keys are valid

## Quick Test

1. Open browser console
2. Reload the page
3. Click "Start Listening"
4. Watch for these logs:
   ```
   🎙️ Generating audio client-side...
   🎤 Generating audio with Grok TTS...
   ✅ Grok TTS audio buffer created
   ✅ Track ready: ... duration: X.XXs
   ▶️ Starting audio playback...
   ```

If you see errors, share them and we can fix!

