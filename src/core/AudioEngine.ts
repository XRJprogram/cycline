export class AudioEngine {
  public ctx: AudioContext | null = null;
  private isPlaying = false;
  private startPerfTime = 0;
  private startAudioTime = 0;
  private pauseOffset = 0;
  public userOffsetMs = 0;
  public hitsoundVolume = 0.9;
  public musicVolume = 0.7;
  public playbackRate = 1.0;

  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  public bpm = 120;
  private schedulerTimer: number | null = null;
  private nextBeatTime = 0;
  private currentBeat = 0;
  private totalBeats = 256;

  private audioEl: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private isUsingAudioFile = false;
  private audioBuffers = new Map<string, AudioBuffer>();
  private currentBufferSource: AudioBufferSourceNode | null = null;
  private bufferStartTime = 0;
  private isUsingBuffer = false;

  public init(): void {
    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();

        this.masterGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();

        this.masterGain.connect(this.ctx.destination);
        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);

        this.musicGain.gain.value = this.musicVolume;
        this.sfxGain.gain.value = this.hitsoundVolume;
      } catch (e) {
        console.warn('Web Audio initialization error:', e);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public async preload(audioUrl?: string): Promise<void> {
    this.init();
    if (!audioUrl) return;

    // 1. Fallback HTMLAudioElement
    if (!this.audioEl || this.currentAudioUrl !== audioUrl) {
      if (this.audioEl) {
        this.audioEl.pause();
        this.audioEl.src = '';
      }
      this.currentAudioUrl = audioUrl;
      this.audioEl = new Audio(audioUrl);
      this.audioEl.preload = 'auto';
      this.audioEl.load();
    }

    // 2. High-precision Web Audio AudioBuffer
    if (this.ctx && !this.audioBuffers.has(audioUrl)) {
      try {
        const res = await fetch(audioUrl);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          const buffer = await this.ctx.decodeAudioData(ab);
          this.audioBuffers.set(audioUrl, buffer);
        }
      } catch (e) {
        console.warn('Web Audio decode fallback to audioEl:', e);
      }
    }
  }

  public chartOffset = 0;

  public play(bpm = 120, totalBeats = 256, startOffset = 0, audioUrl?: string, chartOffset = 0): void {
    if (this.isPlaying) return;

    this.init();

    this.bpm = bpm;
    this.totalBeats = totalBeats;
    this.isPlaying = true;
    this.chartOffset = chartOffset;
    this.pauseOffset = startOffset;

    const targetUrl = audioUrl || this.currentAudioUrl;
    if (targetUrl) {
      this.isUsingAudioFile = true;

      // Priority 1: High-precision Web Audio AudioBuffer (zero seek lag, microsecond sync)
      const cachedBuffer = this.audioBuffers.get(targetUrl);
      if (this.ctx && cachedBuffer) {
        this.isUsingBuffer = true;
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }

        const source = this.ctx.createBufferSource();
        source.buffer = cachedBuffer;
        source.playbackRate.value = this.playbackRate;
        if (this.musicGain) {
          source.connect(this.musicGain);
        } else {
          source.connect(this.ctx.destination);
        }

        const targetAudioTime = Math.max(0, startOffset + this.chartOffset);
        const scheduledTime = this.ctx.currentTime + 0.012; // 12ms buffer for audio quantum alignment
        source.start(scheduledTime, targetAudioTime);
        this.currentBufferSource = source;
        this.bufferStartTime = scheduledTime - (targetAudioTime / this.playbackRate);

        source.onended = () => {
          if (this.currentBufferSource === source) {
            this.currentBufferSource = null;
          }
        };
        return;
      }

      // Priority 2: HTMLAudioElement fallback
      this.isUsingBuffer = false;
      if (!this.audioEl || this.currentAudioUrl !== targetUrl) {
        if (this.audioEl) {
          this.audioEl.pause();
          this.audioEl.src = '';
        }
        this.currentAudioUrl = targetUrl;
        this.audioEl = new Audio(targetUrl);
        this.audioEl.preload = 'auto';
      }

      this.audioEl.volume = Math.max(0, Math.min(1, this.musicVolume));
      this.audioEl.playbackRate = this.playbackRate;
      
      const targetAudioTime = Math.max(0, startOffset + this.chartOffset);
      this.audioEl.currentTime = targetAudioTime;

      this.audioEl.onerror = () => {
        console.warn('Audio element error for URL:', targetUrl, 'falling back to synth');
        this.fallbackToSynth();
      };

      const p = this.audioEl.play();
      if (p !== undefined) {
        p.catch((e) => {
          console.warn('Audio playback start info:', e, 'falling back to synth');
          this.fallbackToSynth();
        });
      }
      return;
    }

    // Procedural synthesis fallback
    this.fallbackToSynth();
  }

  public fallbackToSynth(): void {
    this.isUsingAudioFile = false;
    if (this.audioEl) {
      this.audioEl.pause();
    }
    this.startPerfTime = performance.now() - ((this.pauseOffset + this.chartOffset) * 1000);

    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.startAudioTime = this.ctx.currentTime - (this.pauseOffset + this.chartOffset);
      this.nextBeatTime = this.ctx.currentTime + 0.04;
      this.currentBeat = Math.floor((this.pauseOffset + this.chartOffset) / (60 / this.bpm));
      this.startScheduler();
    }
  }

  public pause(): void {
    if (!this.isPlaying) return;
    const current = this.getSongTime();
    this.isPlaying = false;
    this.pauseOffset = current;
    if (this.currentBufferSource) {
      try {
        this.currentBufferSource.stop();
      } catch (e) {}
      this.currentBufferSource = null;
    }
    if (this.audioEl && this.isUsingAudioFile) {
      this.audioEl.pause();
    }
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  public stop(): void {
    this.isPlaying = false;
    this.pauseOffset = 0;
    this.currentBeat = 0;
    if (this.currentBufferSource) {
      try {
        this.currentBufferSource.stop();
      } catch (e) {}
      this.currentBufferSource = null;
    }
    if (this.audioEl && this.isUsingAudioFile) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  public seek(time: number): void {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.pause();
    this.pauseOffset = time;
    if (this.audioEl && this.isUsingAudioFile) {
      this.audioEl.currentTime = Math.max(0, time + this.chartOffset);
    }
    this.currentBeat = Math.floor((this.pauseOffset + this.chartOffset) / (60 / this.bpm));
    if (wasPlaying) {
      this.play(this.bpm, this.totalBeats, this.pauseOffset, this.currentAudioUrl || undefined, this.chartOffset);
    }
  }

  public restart(bpm = 120, totalBeats = 256, audioUrl?: string, chartOffset = 0): void {
    this.stop();
    this.play(bpm, totalBeats, 0, audioUrl || this.currentAudioUrl || undefined, chartOffset);
  }

  public getSongTime(): number {
    if (!this.isPlaying) return this.pauseOffset;

    let time = 0;
    if (this.isUsingBuffer && this.ctx) {
      const elapsedAudioTime = (this.ctx.currentTime - this.bufferStartTime) * this.playbackRate;
      time = elapsedAudioTime - this.chartOffset;
    } else if (this.audioEl && this.isUsingAudioFile) {
      time = this.audioEl.currentTime - this.chartOffset;
    } else if (this.ctx && this.ctx.state === 'running') {
      time = (this.ctx.currentTime - this.startAudioTime) - this.chartOffset;
    } else {
      time = ((performance.now() - this.startPerfTime) / 1000) - this.chartOffset;
    }

    return time + (this.userOffsetMs / 1000);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private lastHitsoundTime = 0;

  private startScheduler(): void {
    const lookahead = 25.0;
    const scheduleAheadTime = 0.12;

    const step = () => {
      if (!this.isPlaying || !this.ctx) return;

      if (this.ctx.state === 'running') {
        const secondsPerBeat = (60.0 / this.bpm) / this.playbackRate;

        // Fast-forward silently if timer was throttled in background/tab-switch
        if (this.nextBeatTime < this.ctx.currentTime) {
          const missedBeats = Math.floor((this.ctx.currentTime - this.nextBeatTime) / secondsPerBeat);
          if (missedBeats > 0) {
            this.currentBeat += missedBeats;
            this.nextBeatTime += missedBeats * secondsPerBeat;
          }
        }

        while (this.nextBeatTime < this.ctx.currentTime + scheduleAheadTime && this.currentBeat < this.totalBeats) {
          const beatPlayTime = Math.max(this.nextBeatTime, this.ctx.currentTime);
          this.scheduleBeat(this.currentBeat, beatPlayTime);
          this.nextBeatTime += secondsPerBeat;
          this.currentBeat++;
        }
      }
    };

    this.schedulerTimer = window.setInterval(step, lookahead);
  }

  private scheduleBeat(beatNumber: number, time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const measureBeat = beatNumber % 4;

    // 1. Kick on 0 and 2
    if (measureBeat === 0 || measureBeat === 2) {
      this.playKick(time);
    }
    // 2. Snare on 1 and 3
    if (measureBeat === 1 || measureBeat === 3) {
      this.playSnare(time);
    }

    // 3. Melodic groove matching song speed
    if (this.bpm <= 90) {
      // Warm chill marimba
      const chillMelody = [261.63, 329.63, 392.00, 440.00];
      const freq = chillMelody[beatNumber % chillMelody.length];
      this.playMelodyNote(freq, time, 0.18, 0.3);
    } else if (this.bpm <= 130) {
      // Punchy groove
      const grooveMelody = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00];
      const freq = grooveMelody[beatNumber % grooveMelody.length];
      this.playMelodyNote(freq, time, 0.22, 0.2);
    } else {
      // Fast arpeggiated drive
      const fastMelody = [174.61, 220.00, 261.63, 329.63, 392.00, 523.25];
      const freq = fastMelody[(beatNumber * 2) % fastMelody.length];
      this.playMelodyNote(freq, time, 0.25, 0.15);
    }
  }

  private playKick(time: number): void {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.frequency.setValueAtTime(120, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);

      gain.gain.setValueAtTime(0.55, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      osc.start(time);
      osc.stop(time + 0.15);
    } catch {}
  }

  private playSnare(time: number): void {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(550, time);
      osc.frequency.exponentialRampToValueAtTime(220, time + 0.05);

      gain.gain.setValueAtTime(0.35, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + 0.06);
    } catch {}
  }

  private playMelodyNote(freq: number, time: number, vol = 0.2, decay = 0.2): void {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + decay);
    } catch {}
  }

  public playHitsound(isPerfect = true, type: 'tap' | 'hold' | 'touch' = 'tap'): void {
    if (!this.ctx || !this.sfxGain) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const now = this.ctx.currentTime;
      if (now - this.lastHitsoundTime < 0.025) {
        return; // Suppress audio stacking/bursts if many notes are processed simultaneously
      }
      this.lastHitsoundTime = now;

      if (type === 'touch') {
        // Sparkling crystal chime
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(isPerfect ? 1200 : 900, now);
        osc1.frequency.exponentialRampToValueAtTime(isPerfect ? 2400 : 1800, now + 0.08);

        osc2.frequency.setValueAtTime(isPerfect ? 1800 : 1350, now);
        osc2.frequency.exponentialRampToValueAtTime(isPerfect ? 3600 : 2700, now + 0.08);

        gain.gain.setValueAtTime(this.hitsoundVolume * 0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.12);
        osc2.stop(now + 0.12);
      } else if (type === 'hold') {
        // Resonant beam hold initiation
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(isPerfect ? 600 : 450, now);
        osc.frequency.linearRampToValueAtTime(isPerfect ? 900 : 700, now + 0.06);

        gain.gain.setValueAtTime(this.hitsoundVolume * 0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.08);
      } else {
        // Standard snappy tap
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        const startF = isPerfect ? 700 : 500;
        const endF = isPerfect ? 1600 : 1200;

        osc.frequency.setValueAtTime(startF, now);
        osc.frequency.exponentialRampToValueAtTime(endF, now + 0.035);

        gain.gain.setValueAtTime(this.hitsoundVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch {}
  }

  public playHoldTick(): void {
    if (!this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.02);

      gain.gain.setValueAtTime(this.hitsoundVolume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }

  public playHoldComplete(): void {
    if (!this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const freqs = [1046, 1318, 1568]; // C6, E6, G6
      freqs.forEach((f, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.03);

        gain.gain.setValueAtTime(this.hitsoundVolume * 0.45, now + idx * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.03 + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain!);

        osc.start(now + idx * 0.03);
        osc.stop(now + idx * 0.03 + 0.12);
      });
    } catch {}
  }

  public playTrackClear(): void {
    if (!this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      // Majestic triumphant chime: C5 (523Hz), G5 (784Hz), C6 (1046Hz), E6 (1318Hz), G6 (1568Hz)
      const freqs = [523.25, 783.99, 1046.50, 1318.51, 1567.98];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        const startTime = now + idx * 0.06;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.4);

        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(startTime);
        osc.stop(startTime + 1.45);
      });
    } catch {}
  }
}

