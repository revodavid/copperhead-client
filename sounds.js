// CopperHead Sound Effects - Pac-Man style using Web Audio API

class SoundFX {
    constructor() {
        this.audioCtx = null;
        this.enabled = true;
    }

    init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    // "Waka" eating sound - alternating tones like Pac-Man
    eat() {
        if (!this.enabled) return;
        this.init();
        
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc.type = 'square';
        const now = this.audioCtx.currentTime;
        
        // Waka waka - two quick alternating tones
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(300, now + 0.07);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialDecayTo = 0.01;
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialDecayTo(0.01, now + 0.14);
        
        osc.start(now);
        osc.stop(now + 0.14);
    }

    // Game start jingle
    gameStart() {
        if (!this.enabled) return;
        this.init();

        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        const duration = 0.15;
        
        notes.forEach((freq, i) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.type = 'square';
            osc.frequency.value = freq;
            
            const startTime = this.audioCtx.currentTime + (i * duration);
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialDecayTo(0.01, startTime + duration - 0.02);
            
            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }

    // Death sound - descending wah-wah
    death() {
        if (!this.enabled) return;
        this.init();

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc.type = 'sawtooth';
        const now = this.audioCtx.currentTime;
        
        // Descending frequency
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.8);
        
        // Wobble effect
        const lfo = this.audioCtx.createOscillator();
        const lfoGain = this.audioCtx.createGain();
        lfo.frequency.value = 8;
        lfoGain.gain.value = 30;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(now);
        lfo.stop(now + 0.8);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        
        osc.start(now);
        osc.stop(now + 0.8);
    }

    // Victory fanfare
    win() {
        if (!this.enabled) return;
        this.init();

        const melody = [
            { freq: 523, dur: 0.1 },  // C5
            { freq: 659, dur: 0.1 },  // E5
            { freq: 784, dur: 0.1 },  // G5
            { freq: 1047, dur: 0.3 }, // C6
            { freq: 784, dur: 0.1 },  // G5
            { freq: 1047, dur: 0.4 }, // C6
        ];
        
        let time = this.audioCtx.currentTime;
        
        melody.forEach((note) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.type = 'square';
            osc.frequency.value = note.freq;
            
            gain.gain.setValueAtTime(0.15, time);
            gain.gain.setValueAtTime(0.15, time + note.dur - 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, time + note.dur);
            
            osc.start(time);
            osc.stop(time + note.dur);
            
            time += note.dur;
        });
    }

    // Lose sound - sad descending tones
    lose() {
        if (!this.enabled) return;
        this.init();

        const notes = [400, 350, 300, 200];
        const duration = 0.25;
        
        notes.forEach((freq, i) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.type = 'triangle';
            osc.frequency.value = freq;
            
            const startTime = this.audioCtx.currentTime + (i * duration);
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration - 0.02);
            
            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }

    // Move/turn blip
    move() {
        if (!this.enabled) return;
        this.init();

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = 220;
        
        const now = this.audioCtx.currentTime;
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        
        osc.start(now);
        osc.stop(now + 0.05);
    }
}

// Polyfill for exponentialDecayTo
GainNode.prototype.exponentialDecayTo = function(value, endTime) {
    this.gain.exponentialRampToValueAtTime(Math.max(value, 0.0001), endTime);
};

const sfx = new SoundFX();
