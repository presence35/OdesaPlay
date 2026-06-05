import { getAudioContext } from '../../../utils/audioContext';

export class AudioEngine {
    ctx: AudioContext | null = null;
    ambienceGain: GainNode | null = null;
    ambienceFilter: BiquadFilterNode | null = null;
    sfxEnabled: boolean = true;
    currentAmbienceGain: number = 0.05;
    
    setSfxEnabled(enabled: boolean) {
        this.sfxEnabled = enabled;
        if (this.ambienceGain && this.ctx) {
            this.ambienceGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.ambienceGain.gain.setTargetAtTime(
                enabled ? this.currentAmbienceGain : 0,
                this.ctx.currentTime,
                0.1
            );
        }
    }
    
    ensureReady() {
        if (!this.ctx || this.ctx.state === 'closed') {
            this.ctx = getAudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    
    init() {
        this.ensureReady();
        this.startAmbience();
    }

    setWeather(weather: 'clear' | 'fog' | 'storm') {
        this.ensureReady();
        if (!this.ctx || !this.ambienceFilter || !this.ambienceGain) return;
        
        let targetGain: number;
        let targetFreq: number;
        
        if (weather === 'storm') {
            targetFreq = 1200;
            targetGain = 0.15;
        } else if (weather === 'fog') {
            targetFreq = 300;
            targetGain = 0.08;
        } else {
            targetFreq = 250;
            targetGain = 0.015;
        }
        
        this.currentAmbienceGain = targetGain;
        
        this.ambienceFilter.frequency.cancelScheduledValues(this.ctx.currentTime);
        this.ambienceGain.gain.cancelScheduledValues(this.ctx.currentTime);
        
        this.ambienceFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 1);
        this.ambienceGain.gain.setTargetAtTime(
            this.sfxEnabled ? targetGain : 0,
            this.ctx.currentTime,
            1
        );
    }

    startAmbience() {
      if (!this.ctx || this.ambienceGain) return;
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400; // Deep waves
      this.ambienceFilter = filter;

      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = this.sfxEnabled ? 0.05 : 0;

      // Add a slow LFO to the filter to simulate waves
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.1; // 10 seconds per wave
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 200;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      noise.connect(filter);
      filter.connect(this.ambienceGain);
      this.ambienceGain.connect(this.ctx.destination);
      noise.start();
    }

    playPump() {
        this.ensureReady();
        if (!this.ctx || !this.sfxEnabled) return;
        
        const now = this.ctx.currentTime;
        
        // 1. Hydraulic hiss
        const duration = 0.12;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1200, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(300, now + duration);
        noiseFilter.Q.value = 1.5;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(0.8, now + 0.02);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noiseSource.start(now);

        // 2. Heavy thud
        const osc = this.ctx.createOscillator();
        const thumpGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + duration);
        
        thumpGain.gain.setValueAtTime(0, now);
        thumpGain.gain.linearRampToValueAtTime(1, now + 0.01);
        thumpGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        osc.connect(thumpGain);
        thumpGain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    }

    playDock(lesser = false) {
        this.ensureReady();
        if (!this.ctx || !this.sfxEnabled) return;
        // Ship horn chime
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc1.type = 'sine';
        osc2.type = 'sine';
        
        if (lesser) {
            osc1.frequency.setValueAtTime(330, this.ctx.currentTime); // Lower pitch E4
            osc2.frequency.setValueAtTime(415.30, this.ctx.currentTime); // Lower pitch G#4
        } else {
            osc1.frequency.setValueAtTime(440, this.ctx.currentTime); // A4
            osc2.frequency.setValueAtTime(554.37, this.ctx.currentTime); // C#5
        }
        
        // Slightly lower volume for lesser points
        gain.gain.setValueAtTime(lesser ? 0.08 : 0.15, this.ctx.currentTime);
        gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); // exponential decay
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 1.5);
        osc2.stop(this.ctx.currentTime + 1.5);
    }

    playLightToggle(on: boolean) {
        this.ensureReady();
        if (!this.ctx || !this.sfxEnabled) return;
        // Heavy switch click
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = on ? 1000 : 800;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    }

    playRadioBlip() {
        this.ensureReady();
        if (!this.ctx || !this.sfxEnabled) return;
        // Static crackle
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1500;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    }

    playFoghorn() {
        this.ensureReady();
        if (!this.ctx || !this.sfxEnabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(55, this.ctx.currentTime);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, this.ctx.currentTime);
        filter.frequency.linearRampToValueAtTime(400, this.ctx.currentTime + 0.5);
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime + 1.5);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2.5);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 2.5);
    }

    playError() {
      this.ensureReady();
      if (!this.ctx || !this.sfxEnabled) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.setTargetAtTime(0, this.ctx.currentTime + 0.1, 0.05);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    }

    playSpark() {
      this.ensureReady();
      if (!this.ctx || !this.sfxEnabled) return;
      const bufferSize = this.ctx.sampleRate * 0.1;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2000;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    }

    playThunder() {
        this.ensureReady();
        if (!this.ctx || !this.sfxEnabled) return;
        const bufferSize = this.ctx.sampleRate * 2.0;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, this.ctx.currentTime);
        filter.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.1);
        filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 1.5);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 2.0);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    }
}

export const audio = new AudioEngine();
