// Decodes base64 string to raw bytes
export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Decodes raw PCM data to AudioBuffer
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert int16 to float (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export class AudioController {
  private ctx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  
  constructor() {
    // Defer AudioContext creation until first use (requires user interaction)
    this.initContext();
  }

  private initContext() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.gainNode = this.ctx.createGain();
        this.gainNode.connect(this.ctx.destination);
        console.log('🔊 AudioContext initialized, state:', this.ctx.state, 'sampleRate:', this.ctx.sampleRate);
      } catch (e) {
        console.error('❌ Failed to create AudioContext:', e);
      }
    }
    return this.ctx;
  }

  async resumeContext() {
    const ctx = this.initContext();
    if (ctx && ctx.state === 'suspended') {
      console.log('🔊 Resuming suspended AudioContext...');
      await ctx.resume();
      console.log('🔊 AudioContext resumed, state:', ctx.state);
    }
  }

  async pause() {
    if (this.ctx && this.ctx.state === 'running') {
      await this.ctx.suspend();
      console.log('🔊 AudioContext paused');
    }
  }

  async play(buffer: AudioBuffer, onEnded?: () => void): Promise<void> {
    this.stop(); // Stop any currently playing audio node
    
    const ctx = this.initContext();
    if (!ctx || !this.gainNode) {
      console.error('❌ AudioContext not available');
      return;
    }

    // IMPORTANT: Resume context (requires prior user interaction)
    await this.resumeContext();
    
    console.log('🔊 Playing audio buffer:', {
      duration: buffer.duration.toFixed(2) + 's',
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      contextState: ctx.state,
    });

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    
    source.onended = () => {
      console.log('🔊 Audio playback ended');
      if (onEnded) onEnded();
    };

    source.start();
    this.currentSource = source;
    console.log('🔊 Audio playback started');
  }

  stop() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
        console.log('🔊 Audio stopped');
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.currentSource = null;
    }
  }
  
  getContext() {
    return this.initContext()!;
  }

  getState() {
    return this.ctx?.state || 'closed';
  }
}

export const audioController = new AudioController();