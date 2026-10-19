// --------------------------------------------------------------------------
// 6B. KITCHEN AUDIO ENGINE (Dual Web Audio API Synth + Fallback)
// --------------------------------------------------------------------------
const KitchenAudioEngine = {
  audioCtx: null,
  audioEl: null,

  init() {
    this.audioEl = document.getElementById("audioKitchenAlert");
    if (this.audioEl && !this.audioEl.src) {
      this.audioEl.src = this.generateChimeDataUri();
    }
  },

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  },

  playChime() {
    if (!State.kdsSoundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === "running") {
        const now = ctx.currentTime;
        
        // Tone 1: High crisp bell (D5 - 587.33 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.35, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 1.25);

        // Tone 2: Dual harmonic bell tone (A5 - 880 Hz) with slight melodic offset
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880.00, now + 0.08);
        gain2.gain.setValueAtTime(0.001, now);
        gain2.gain.setValueAtTime(0.28, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 1.45);
        return;
      }
    } catch (e) {
      console.warn("Web Audio API chime failed, falling back to audio element:", e);
    }

    if (this.audioEl) {
      this.audioEl.currentTime = 0;
      this.audioEl.play().catch(() => {});
    }
  },

  playCancelWarning() {
    if (!State.kdsSoundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === "running") {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(330, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {}
  },

  generateChimeDataUri() {
    const sampleRate = 8000;
    const duration = 1.0;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Uint8Array(44 + numSamples);
    
    buffer[0] = 82; buffer[1] = 73; buffer[2] = 70; buffer[3] = 70; // "RIFF"
    const fileSize = 36 + numSamples;
    buffer[4] = fileSize & 0xff; buffer[5] = (fileSize >> 8) & 0xff;
    buffer[6] = (fileSize >> 16) & 0xff; buffer[7] = (fileSize >> 24) & 0xff;
    buffer[8] = 87; buffer[9] = 65; buffer[10] = 86; buffer[11] = 69; // "WAVE"
    buffer[12] = 102; buffer[13] = 109; buffer[14] = 116; buffer[15] = 32; // "fmt "
    buffer[16] = 16; buffer[17] = 0; buffer[18] = 0; buffer[19] = 0;
    buffer[20] = 1; buffer[21] = 0; // PCM
    buffer[22] = 1; buffer[23] = 0; // Mono
    buffer[24] = sampleRate & 0xff; buffer[25] = (sampleRate >> 8) & 0xff;
    buffer[26] = (sampleRate >> 16) & 0xff; buffer[27] = (sampleRate >> 24) & 0xff;
    buffer[28] = sampleRate & 0xff; buffer[29] = (sampleRate >> 8) & 0xff;
    buffer[30] = (sampleRate >> 16) & 0xff; buffer[31] = (sampleRate >> 24) & 0xff;
    buffer[32] = 1; buffer[33] = 0;
    buffer[34] = 8; buffer[35] = 0; // 8-bit
    buffer[36] = 100; buffer[37] = 97; buffer[38] = 116; buffer[39] = 97; // "data"
    buffer[40] = numSamples & 0xff; buffer[41] = (numSamples >> 8) & 0xff;
    buffer[42] = (numSamples >> 16) & 0xff; buffer[43] = (numSamples >> 24) & 0xff;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-3.5 * t);
      const val = 0.6 * Math.sin(2 * Math.PI * 659.25 * t) + 0.4 * Math.sin(2 * Math.PI * 880.00 * t);
      const sample = Math.floor(128 + 120 * val * decay);
      buffer[44 + i] = Math.max(0, Math.min(255, sample));
    }

    let binary = "";
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return "data:audio/wav;base64," + btoa(binary);
  }
};
if (typeof window !== "undefined") {
  window.KitchenAudioEngine = KitchenAudioEngine;
}
