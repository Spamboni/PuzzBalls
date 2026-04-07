window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_FILE_VERSION['sound.js'] = 1527;
// sound.js — Web Audio API synthesized sound effects
// No external files. All sounds generated procedurally.

var Sound = (function() {

  var ctx = null;
  var enabled = true;

  // Lazy-init AudioContext on first user gesture (browser requirement)
  function getCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch(e) {
        enabled = false;
      }
    }
    // Resume if suspended (mobile browsers suspend until gesture)
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ── Low-level helpers ──────────────────────────────────────────────────────

  function playTone(opts) {
    // opts: { type, freq, freq2, gain, attack, decay, duration, filterFreq, filterQ, detune }
    if (!enabled) return;
    var c = getCtx();
    if (!c) return;

    var now = c.currentTime;
    var osc = c.createOscillator();
    var gainNode = c.createGain();

    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq || 440, now);
    if (opts.freq2) osc.frequency.exponentialRampToValueAtTime(opts.freq2, now + (opts.duration || 0.2));
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, now);

    var g = opts.gain || 0.3;
    var attack  = opts.attack  || 0.005;
    var decay   = opts.decay   || 0.1;
    var dur     = opts.duration || 0.2;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(g, now + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

    if (opts.filterFreq) {
      var filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = opts.filterFreq;
      filter.Q.value = opts.filterQ || 1;
      osc.connect(filter);
      filter.connect(gainNode);
    } else {
      osc.connect(gainNode);
    }

    gainNode.connect(c.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  function playNoise(opts) {
    // Filtered noise burst
    if (!enabled) return;
    var c = getCtx();
    if (!c) return;

    var now      = c.currentTime;
    var duration = opts.duration || 0.15;
    var bufSize  = Math.ceil(c.sampleRate * duration);
    var buffer   = c.createBuffer(1, bufSize, c.sampleRate);
    var data     = buffer.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);

    var src    = c.createBufferSource();
    src.buffer = buffer;

    var filter = c.createBiquadFilter();
    filter.type = opts.filterType || 'bandpass';
    filter.frequency.value = opts.filterFreq || 800;
    filter.Q.value = opts.filterQ || 2;

    var gainNode = c.createGain();
    var g = opts.gain || 0.2;
    gainNode.gain.setValueAtTime(g, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(c.destination);
    src.start(now);
    src.stop(now + duration);
  }

  // ── Sound definitions ──────────────────────────────────────────────────────

  // Elastic stretch: rising subtle creak as you pull back
  // Call repeatedly while dragging, with power 0..1
  var _stretchThrottle = 0;
  function stretch(power) {
    if (!enabled) return;
    var now = Date.now();
    // Throttle to every ~80ms to avoid audio spam
    if (now - _stretchThrottle < 80) return;
    _stretchThrottle = now;

    var c = getCtx(); if (!c) return;
    var t = c.currentTime;

    // Rubber band creak: noise burst + rising pitched tone
    playNoise({
      filterType: 'bandpass',
      filterFreq: 200 + power * 600,
      filterQ: 8,
      gain: 0.12 + power * 0.18,
      duration: 0.07,
    });
  }

  // Snap on release
  function snap(power) {
    if (!enabled) return;
    getCtx();
    // Sharp noise burst (the snap)
    playNoise({
      filterType: 'highpass',
      filterFreq: 1200 + power * 800,
      filterQ: 1,
      gain: 0.12 + power * 0.18,
      duration: 0.08,
    });
    // Quick low thud underneath
    playTone({
      type: 'sine',
      freq: 120,
      freq2: 40,
      gain: 0.25 + power * 0.2,
      attack: 0.001,
      decay: 0.12,
      duration: 0.14,
    });
  }

  // Ball-on-ball clink: bright metallic ping
  function clink(speed) {
    if (!enabled) return;
    getCtx();
    var s = Math.min(speed / 20, 1);
    // High metallic tone
    playTone({
      type: 'sine',
      freq: 900 + s * 400,
      freq2: 700,
      gain: 0.08 + s * 0.14,
      attack: 0.001,
      decay: 0.18 + s * 0.1,
      duration: 0.3,
    });
    // Slight overtone
    playTone({
      type: 'sine',
      freq: 1400 + s * 600,
      gain: 0.04 + s * 0.06,
      attack: 0.001,
      decay: 0.1,
      duration: 0.15,
    });
  }

  // Ball-on-wall click: sharp transient
  function wallClick(speed) {
    if (!enabled) return;
    getCtx();
    var s = Math.min(speed / 20, 1);
    playNoise({
      filterType: 'highpass',
      filterFreq: 2000 + s * 1000,
      filterQ: 0.8,
      gain: 0.08 + s * 0.1,
      duration: 0.05,
    });
    playTone({
      type: 'square',
      freq: 180 + s * 80,
      freq2: 80,
      gain: 0.06 + s * 0.08,
      attack: 0.001,
      decay: 0.06,
      duration: 0.08,
    });
  }

  // Ball-on-obstacle thud: dull low impact
  function thud(speed) {
    if (!enabled) return;
    getCtx();
    var s = Math.min(speed / 20, 1);
    // Low thud
    playTone({
      type: 'sine',
      freq: 80 + s * 60,
      freq2: 30,
      gain: 0.2 + s * 0.2,
      attack: 0.002,
      decay: 0.18 + s * 0.1,
      duration: 0.22,
    });
    // Mid noise component
    playNoise({
      filterType: 'lowpass',
      filterFreq: 300 + s * 200,
      filterQ: 1,
      gain: 0.1 + s * 0.1,
      duration: 0.1,
    });
  }

  // Win jingle
  function win() {
    if (!enabled) return;
    getCtx();
    var notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    for (var i = 0; i < notes.length; i++) {
      (function(freq, delay) {
        setTimeout(function() {
          playTone({ type: 'sine', freq: freq, gain: 0.15, attack: 0.01, decay: 0.3, duration: 0.35 });
        }, delay);
      })(notes[i], i * 80);
    }
  }

  // ── Dynamic impact sound: volume/pitch scaled by velocity, density, size ──
  // §3.1: volume = baseVol * velFactor * densityFactor * sizeFactor
  // §3.2: pitch shifted based on density (heavy = lower, light = higher)
  function ballImpact(ballType, speed, ballR) {
    if (!enabled) return;
    var c = getCtx(); if (!c) return;
    var as      = window.AudioSettings || {};
    var master  = as.masterVol !== undefined ? as.masterVol : 1.0;
    if (master <= 0) return;
    var bs      = window.BallSettings && window.BallSettings[ballType];
    var density = bs ? (bs.density || 1.0) : 1.0;
    var size    = ballR || 12;

    var velFactor     = Math.min(speed / 12, 1.0);
    var densityFactor = (as.impactScaling !== false) ? Math.min(density / 2.0, 1.5) : 1.0;
    var sizeFactor    = (as.impactScaling !== false) ? Math.min(size / 12, 1.5)    : 1.0;
    var impactVol     = as.impactVol !== undefined ? as.impactVol : 1.0;
    var vol = 0.18 * velFactor * densityFactor * sizeFactor * master * impactVol;
    vol = Math.max(0.04, Math.min(vol, 0.55));

    var detune = (as.pitchScaling !== false) ? (1.0 - density) * 220 : 0;

    // Ball-specific sounds (§3.2)
    var variant = (window.SoundVariants && window.SoundVariants[ballType]) || 0;
    if (variant === -1) return;  // None — silence

    // Per-sound volume multiplier
    var svol = (window.SoundVolumes && window.SoundVolumes[ballType] !== undefined)
              ? window.SoundVolumes[ballType] / 100 : 1.0;
    vol *= svol;

    switch (ballType) {
      case 'exploder':
        if (variant === 4) { playTone({ type:'square', freq:200, freq2:80, gain:vol*1.6, attack:0.001, decay:0.12, duration:0.14, detune:detune }); break; }
        if (variant === 5) { playTone({ type:'sine', freq:55, freq2:20, gain:vol*2.5, attack:0.001, decay:0.25, duration:0.28, detune:detune }); break; }
        if (variant === 8) { playTone({ type:'sine', freq:300, freq2:600, gain:vol, attack:0.01, decay:0.3, duration:0.35 }); break; }
        if (variant === 9) { playTone({ type:'sawtooth', freq:440, freq2:880, gain:vol*0.5, attack:0.001, decay:0.06, duration:0.08 }); break; }
        playTone({ type: 'sine', freq: 90, freq2: 35, gain: vol * 2.0, attack: 0.001, decay: 0.18, duration: 0.22, detune: detune });
        playNoise({ filterType: 'lowpass', filterFreq: 400, filterQ: 1.5, gain: vol * 0.8, duration: 0.08 });
        break;
      case 'sticky':
        if (variant === 1) { playTone({ type:'sine', freq:100, freq2:50, gain:vol*0.8, attack:0.005, decay:0.10, duration:0.12 }); break; }
        if (variant === 8) { playTone({ type:'triangle', freq:180, freq2:360, gain:vol, attack:0.01, decay:0.2, duration:0.25 }); break; }
        if (variant === 9) { playNoise({ filterType:'bandpass', filterFreq:200, filterQ:1, gain:vol*1.5, duration:0.12 }); break; }
        playTone({ type: 'sine', freq: 130, freq2: 55, gain: vol * 1.5, attack: 0.003, decay: 0.16, duration: 0.18, detune: detune });
        break;
      case 'splitter':
        if (variant === 3) { playTone({ type:'sine', freq:800, freq2:1200, gain:vol*0.6, attack:0.001, decay:0.15, duration:0.18 }); break; }
        if (variant === 8) { playTone({ type:'sine', freq:440, freq2:880, gain:vol, attack:0.005, decay:0.5, duration:0.55 }); break; }
        if (variant === 9) { playNoise({ filterType:'highpass', filterFreq:5000, filterQ:2, gain:vol*0.8, duration:0.03 }); break; }
        playTone({ type: 'triangle', freq: 340, freq2: 200, gain: vol * 1.2, attack: 0.001, decay: 0.10, duration: 0.12, detune: detune });
        playNoise({ filterType: 'highpass', filterFreq: 2800, filterQ: 1, gain: vol * 0.9, duration: 0.05 });
        break;
      case 'gravity':
        if (variant === 4) { playTone({ type:'sine', freq:60, freq2:40, gain:vol*2, attack:0.01, decay:0.35, duration:0.4, detune:detune }); break; }
        if (variant === 8) { playTone({ type:'sine', freq:55, freq2:110, gain:vol*1.5, attack:0.02, decay:0.8, duration:0.85 }); break; }
        if (variant === 9) { playTone({ type:'sawtooth', freq:80, freq2:40, gain:vol*0.8, attack:0.001, decay:0.15, duration:0.18 }); break; }
        playTone({ type: 'sine', freq: 110, freq2: 65, gain: vol * 1.8, attack: 0.002, decay: 0.22, duration: 0.25, detune: detune });
        break;
      default: // bouncer
        if (variant === 1) { playTone({ type:'sine', freq:120, freq2:60, gain:vol*0.7, attack:0.001, decay:0.08, duration:0.10 }); break; }
        if (variant === 2) { playNoise({ filterType:'bandpass', filterFreq:1200, filterQ:3, gain:vol*1.2, duration:0.07 }); break; }
        if (variant === 3) { playTone({ type:'sine', freq:700, freq2:500, gain:vol*0.5, attack:0.001, decay:0.2, duration:0.22 }); break; }
        if (variant === 4) { playTone({ type:'square', freq:150, freq2:80, gain:vol*0.9, attack:0.001, decay:0.08, duration:0.10 }); break; }
        if (variant === 6) { playTone({ type:'sine', freq:180, freq2:90, gain:vol*1.2, attack:0.001, decay:0.18, duration:0.22 }); break; }
        if (variant === 7) { playNoise({ filterType:'bandpass', filterFreq:400, filterQ:1, gain:vol*0.8, duration:0.06 }); break; }
        if (variant === 8) { playTone({ type:'sine', freq:440, freq2:880, gain:vol*0.4, attack:0.001, decay:0.5, duration:0.55 }); break; }
        if (variant === 9) { playTone({ type:'sawtooth', freq:300, freq2:600, gain:vol*0.3, attack:0.001, decay:0.04, duration:0.05 }); break; }
        playTone({ type: 'sine', freq: 200, freq2: 90, gain: vol * 1.4, attack: 0.001, decay: 0.12, duration: 0.14, detune: detune });
        playNoise({ filterType: 'bandpass', filterFreq: 600 + speed * 25, filterQ: 2.5, gain: vol * 0.7, duration: 0.06 });
    }
  }

  // Explosion: short punchy, not overpowering (§3.3)
  function explode(tier) {
    if (!enabled) return;
    var c = getCtx(); if (!c) return;
    var now = c.currentTime;
    var as  = window.AudioSettings || {};
    var vol = (0.28 + (tier || 1) * 0.08) * (as.masterVol !== undefined ? as.masterVol : 1.0)
                                           * (as.explosionVol !== undefined ? as.explosionVol : 1.0);

    // Deep sub-bass boom — the main body
    var osc = c.createOscillator(); var g1 = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55 + (tier||1) * 8, now);
    osc.frequency.exponentialRampToValueAtTime(18, now + 0.55);
    g1.gain.setValueAtTime(vol * 1.8, now);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.60);
    osc.connect(g1); g1.connect(c.destination); osc.start(now); osc.stop(now + 0.60);

    // Mid punch layer
    var osc2 = c.createOscillator(); var g2 = c.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(110, now);
    osc2.frequency.exponentialRampToValueAtTime(30, now + 0.30);
    g2.gain.setValueAtTime(vol * 1.0, now);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc2.connect(g2); g2.connect(c.destination); osc2.start(now); osc2.stop(now + 0.35);

    // Noise burst (low-passed rumble for texture)
    var bufSize = Math.ceil(c.sampleRate * 0.5);
    var buf = c.createBuffer(1, bufSize, c.sampleRate);
    var d   = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.25));
    var src = c.createBufferSource(); src.buffer = buf;
    var flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 280 + (tier||1) * 60; flt.Q.value = 0.7;
    var g3  = c.createGain();
    g3.gain.setValueAtTime(vol * 1.3, now); g3.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    src.connect(flt); flt.connect(g3); g3.connect(c.destination);
    src.start(now); src.stop(now + 0.5);

    // Reverb tail — delayed echo for resonance
    var osc3 = c.createOscillator(); var g4 = c.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(38, now + 0.05);
    osc3.frequency.exponentialRampToValueAtTime(15, now + 0.80);
    g4.gain.setValueAtTime(0, now);
    g4.gain.linearRampToValueAtTime(vol * 0.5, now + 0.08);
    g4.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    osc3.connect(g4); g4.connect(c.destination); osc3.start(now); osc3.stop(now + 0.85);
  }

  return { stretch, snap, clink, wallClick, thud, win, getCtx, ballImpact, explode };

})();

window.Sound = Sound;

// Patched in: chute sounds
// Accessed via Sound.chuteSlide() and Sound.chuteExit()
(function() {
  var S = window.Sound;

  // Continuous swishing hiss as ball slides down chute
  // Call once when ball enters chute; it auto-fades
  S.chuteSlide = function() {
    if (!S.getCtx()) return;
    var c = S.getCtx();
    var now = c.currentTime;
    // Rising filtered noise whoosh
    var bufSize = Math.ceil(c.sampleRate * 0.45);
    var buffer  = c.createBuffer(1, bufSize, c.sampleRate);
    var data    = buffer.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    var src = c.createBufferSource();
    src.buffer = buffer;
    var filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.linearRampToValueAtTime(1200, now + 0.3);
    filter.Q.value = 3;
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    src.connect(filter); filter.connect(gain); gain.connect(c.destination);
    src.start(now); src.stop(now + 0.45);
  };

  // Pop/thud as ball exits chute onto floor
  S.chuteExit = function() {
    if (!S.getCtx()) return;
    // Low soft thud + quick high tick
    var c = S.getCtx();
    var now = c.currentTime;
    // Soft thud
    var osc = c.createOscillator();
    var g   = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(g); g.connect(c.destination);
    osc.start(now); osc.stop(now + 0.2);
    // Tick
    var osc2 = c.createOscillator();
    var g2   = c.createGain();
    osc2.type = 'square';
    osc2.frequency.value = 800;
    g2.gain.setValueAtTime(0.08, now);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    osc2.connect(g2); g2.connect(c.destination);
    osc2.start(now); osc2.stop(now + 0.04);
  };
})();

// ── Glass shatter sound for bricks ───────────────────────────────────────────
(function() {
  var S = window.Sound;
  S.brickShatter = function(intensity) {
    if (!S.getCtx()) return;
    var c   = S.getCtx();
    var now = c.currentTime;
    var vol = 0.12 + Math.min(intensity || 0.5, 1.0) * 0.18;

    // High glassy crack transient
    var bufSize = Math.ceil(c.sampleRate * 0.18);
    var buf = c.createBuffer(1, bufSize, c.sampleRate);
    var d   = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.15));
    var src = c.createBufferSource();
    src.buffer = buf;
    var flt = c.createBiquadFilter();
    flt.type = 'highpass'; flt.frequency.value = 2800; flt.Q.value = 1.2;
    var g = c.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    src.connect(flt); flt.connect(g); g.connect(c.destination);
    src.start(now); src.stop(now + 0.18);

    // Low thud underneath
    var osc = c.createOscillator();
    var g2  = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    g2.gain.setValueAtTime(vol * 1.2, now);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(g2); g2.connect(c.destination);
    osc.start(now); osc.stop(now + 0.14);
  };
})();

// ── Brick-on-brick collision sound ────────────────────────────────────────────
(function() {
  var S = window.Sound;
  S.brickOnBrick = function(speed) {
    if (!S.getCtx()) return;
    var c   = S.getCtx();
    var now = c.currentTime;
    var vol = Math.min(0.08 + speed * 0.04, 0.28);
    // Low stony thud
    var osc = c.createOscillator(); var g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(75, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.13);
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(g); g.connect(c.destination); osc.start(now); osc.stop(now + 0.15);
    // Gritty crunch layer
    var bufSize = Math.ceil(c.sampleRate * 0.08);
    var buf = c.createBuffer(1, bufSize, c.sampleRate);
    var d   = buf.getChannelData(0);
    for (var i2 = 0; i2 < bufSize; i2++) d[i2] = (Math.random()*2-1) * Math.exp(-i2/(bufSize*0.18));
    var src = c.createBufferSource(); src.buffer = buf;
    var flt = c.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 550; flt.Q.value = 2.5;
    var g2  = c.createGain(); g2.gain.setValueAtTime(vol*0.55, now); g2.gain.exponentialRampToValueAtTime(0.0001, now+0.09);
    src.connect(flt); flt.connect(g2); g2.connect(c.destination); src.start(now); src.stop(now+0.09);
  };
})();

// ── Brick musical note system ─────────────────────────────────────────────────
window.BrickNote = (function() {

  // MIDI note → Hz
  function noteHz(note, octave) {
    var notes = { 'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11 };
    var semitone = (octave + 1) * 12 + (notes[note] || 0);
    return 440 * Math.pow(2, (semitone - 69) / 12);
  }

  // 10 rich timbres
  var timbres = {
    // 1. Marimba — short sine with wooden thump
    marimba: function(c, hz, vol) {
      var now = c.currentTime;
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = 'sine'; osc.frequency.value = hz;
      g.gain.setValueAtTime(vol * 1.2, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc.connect(g); g.connect(c.destination); osc.start(now); osc.stop(now + 0.5);
      // Wooden thump
      var o2 = c.createOscillator(), g2 = c.createGain();
      o2.type = 'triangle'; o2.frequency.setValueAtTime(hz * 0.5, now); o2.frequency.exponentialRampToValueAtTime(hz * 0.25, now + 0.06);
      g2.gain.setValueAtTime(vol * 0.5, now); g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      o2.connect(g2); g2.connect(c.destination); o2.start(now); o2.stop(now + 0.08);
    },
    // 2. Bell — long ringing with harmonics
    bell: function(c, hz, vol) {
      var now = c.currentTime;
      [[1.0, 1.2], [2.76, 0.7], [5.4, 0.4], [7.8, 0.2]].forEach(function(p) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = hz * p[0];
        g.gain.setValueAtTime(vol * p[1], now); g.gain.exponentialRampToValueAtTime(0.0001, now + 2.5 * p[1]);
        o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 3);
      });
    },
    // 3. Plucked string — Karplus-Strong style
    pluck: function(c, hz, vol) {
      var now = c.currentTime;
      var bufLen = Math.ceil(c.sampleRate / hz);
      var buf = c.createBuffer(1, bufLen * 8, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1);
      for (var i2 = bufLen; i2 < bufLen * 8; i2++) d[i2] = 0.5 * (d[i2 - bufLen] + d[i2 - bufLen + 1]);
      var src = c.createBufferSource(); src.buffer = buf;
      var g = c.createGain(); g.gain.setValueAtTime(vol * 1.5, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      src.connect(g); g.connect(c.destination); src.start(now); src.stop(now + 1.2);
    },
    // 4. Vibraphone — sine with tremolo
    vibraphone: function(c, hz, vol) {
      var now = c.currentTime;
      var osc = c.createOscillator(), lfo = c.createOscillator(), lfoG = c.createGain(), g = c.createGain();
      osc.type = 'sine'; osc.frequency.value = hz;
      lfo.type = 'sine'; lfo.frequency.value = 6;
      lfoG.gain.value = vol * 0.3;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      g.gain.setValueAtTime(vol * 0.9, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      osc.connect(g); g.connect(c.destination);
      osc.start(now); lfo.start(now); osc.stop(now + 2); lfo.stop(now + 2);
      // Second harmonic
      var o2 = c.createOscillator(), g2 = c.createGain();
      o2.type = 'sine'; o2.frequency.value = hz * 2;
      g2.gain.setValueAtTime(vol * 0.25, now); g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      o2.connect(g2); g2.connect(c.destination); o2.start(now); o2.stop(now + 1);
    },
    // 5. Flute — breathy sine with high harmonics
    flute: function(c, hz, vol) {
      var now = c.currentTime;
      // Noise breath
      var bLen = Math.ceil(c.sampleRate * 0.05);
      var bBuf = c.createBuffer(1, bLen, c.sampleRate);
      var bd = bBuf.getChannelData(0);
      for (var i = 0; i < bLen; i++) bd[i] = (Math.random() * 2 - 1);
      var bSrc = c.createBufferSource(); bSrc.buffer = bBuf;
      var bFlt = c.createBiquadFilter(); bFlt.type = 'bandpass'; bFlt.frequency.value = hz * 2; bFlt.Q.value = 15;
      var bG = c.createGain(); bG.gain.setValueAtTime(vol * 0.4, now); bG.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      bSrc.connect(bFlt); bFlt.connect(bG); bG.connect(c.destination); bSrc.start(now); bSrc.stop(now + 0.08);
      // Tone
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(hz * 0.99, now); osc.frequency.linearRampToValueAtTime(hz, now + 0.05);
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol * 0.8, now + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      osc.connect(g); g.connect(c.destination); osc.start(now); osc.stop(now + 1.3);
    },
    // 6. Bird chirp — fast freq sweep
    bird: function(c, hz, vol) {
      var now = c.currentTime;
      [0, 0.07, 0.14].forEach(function(delay) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(hz * 1.5, now + delay);
        o.frequency.exponentialRampToValueAtTime(hz * 2.5, now + delay + 0.04);
        o.frequency.exponentialRampToValueAtTime(hz * 1.8, now + delay + 0.07);
        g.gain.setValueAtTime(vol * 0.7, now + delay);
        g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.09);
        o.connect(g); g.connect(c.destination); o.start(now + delay); o.stop(now + delay + 0.1);
      });
    },
    // 7. Organ — multiple detuned sawtooths
    organ: function(c, hz, vol) {
      var now = c.currentTime;
      var g = c.createGain();
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol * 0.6, now + 0.02);
      g.gain.setValueAtTime(vol * 0.6, now + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      g.connect(c.destination);
      [1, 2, 3, 4].forEach(function(harm) {
        var o = c.createOscillator();
        o.type = harm === 1 ? 'sawtooth' : 'sine';
        o.frequency.value = hz * harm;
        o.detune.value = (Math.random() - 0.5) * 4;
        o.connect(g); o.start(now); o.stop(now + 0.8);
      });
    },
    // 8. Celesta — bright sparkly bell
    celesta: function(c, hz, vol) {
      var now = c.currentTime;
      [[1, 0.8, 0.6], [4.07, 0.5, 0.3], [6.1, 0.3, 0.2]].forEach(function(p) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = hz * p[0];
        g.gain.setValueAtTime(vol * p[1], now); g.gain.exponentialRampToValueAtTime(0.0001, now + p[2] * 3);
        o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + p[2] * 3 + 0.1);
      });
      // Bright transient
      var noise = c.createBuffer(1, Math.ceil(c.sampleRate * 0.02), c.sampleRate);
      var nd = noise.getChannelData(0); for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      var ns = c.createBufferSource(); ns.buffer = noise;
      var nf = c.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 4000;
      var ng = c.createGain(); ng.gain.setValueAtTime(vol * 0.3, now); ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
      ns.connect(nf); nf.connect(ng); ng.connect(c.destination); ns.start(now);
    },
    // 9. Sub bass synth — deep sine with slight detune chorus
    bass: function(c, hz, vol) {
      var now = c.currentTime;
      [1, 1.002, 0.998].forEach(function(dt) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = hz * dt;
        g.gain.setValueAtTime(vol * 0.7, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
        o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 1);
      });
      // Sub octave
      var sub = c.createOscillator(), sg = c.createGain();
      sub.type = 'triangle'; sub.frequency.value = hz * 0.5;
      sg.gain.setValueAtTime(vol * 0.5, now); sg.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      sub.connect(sg); sg.connect(c.destination); sub.start(now); sub.stop(now + 1.3);
    },
    // 10. Crystal glass — very pure long tone with high partial
    crystal: function(c, hz, vol) {
      var now = c.currentTime;
      [[1, 1.0], [2.756, 0.35], [9.0, 0.12]].forEach(function(p) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = hz * p[0];
        g.gain.setValueAtTime(vol * p[1] * 0.5, now);
        g.gain.linearRampToValueAtTime(vol * p[1], now + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 3.5 * p[1]);
        o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 4);
      });
    },
  };

  var timbreList = ['marimba','bell','pluck','vibraphone','flute','bird','organ','celesta','bass','crystal'];
  var timbreLabels = ['Marimba','Bell','Pluck','Vibraphone','Flute','Bird','Organ','Celesta','Sub Bass','Crystal'];

  function playNote(note, octave, timbre, vol) {
    var c = window.Sound && window.Sound.getCtx ? window.Sound.getCtx() : null;
    if (!c) return;
    var hz = noteHz(note || 'C', octave !== undefined ? octave : 4);
    var fn = timbres[timbre] || timbres.marimba;
    var v  = (vol !== undefined ? vol : 1.0) *
             ((window.AudioSettings && window.AudioSettings.masterVol !== undefined) ? window.AudioSettings.masterVol : 1.0);
    fn(c, hz, Math.min(v, 1.4));
  }

  var noteNames   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  var noteDisplay = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];

  return { playNote, timbreList, timbreLabels, noteNames, noteDisplay };
})();

// ── UI Sounds ─────────────────────────────────────────────────────────────────
(function() {
  var S = window.Sound;
  if (!S) return;

  // Button tap — short bright click
  S.uiTap = function(vol) {
    var c = S.getCtx(); if (!c) return;
    vol = (vol || 0.35) * ((window.AudioSettings && window.AudioSettings.masterVol) || 1);
    var now = c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, now); o.frequency.exponentialRampToValueAtTime(440, now + 0.06);
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.07);
    // Bright transient tick
    var o2 = c.createOscillator(), g2 = c.createGain();
    o2.type = 'square'; o2.frequency.value = 2200;
    g2.gain.setValueAtTime(vol * 0.2, now); g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    o2.connect(g2); g2.connect(c.destination); o2.start(now); o2.stop(now + 0.025);
  };

  // Slider tick — very soft blip, not annoying
  S.uiSlider = function() {
    var c = S.getCtx(); if (!c) return;
    var vol = 0.008 * ((window.AudioSettings && window.AudioSettings.masterVol) || 1);
    var now = c.currentTime;
    // Soft low whoosh — filtered noise feel
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    // Gentle low pitch with slow glide — 180-260Hz range
    o.frequency.setValueAtTime(180 + Math.random() * 80, now);
    o.frequency.linearRampToValueAtTime(200 + Math.random() * 60, now + 0.12);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.02);
    g.gain.linearRampToValueAtTime(0, now + 0.14);
    o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.15);
  };

  // Toggle on/off — two-tone
  S.uiToggle = function(on) {
    var c = S.getCtx(); if (!c) return;
    var vol = 0.25 * ((window.AudioSettings && window.AudioSettings.masterVol) || 1);
    var now = c.currentTime;
    var freqs = on ? [660, 880] : [880, 550];
    freqs.forEach(function(f, i) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      var t = now + i * 0.06;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.08);
    });
  };

  // Editor open — mechanical whoosh + settle
  S.editorOpen = function() {
    var c = S.getCtx(); if (!c) return;
    var vol = 0.3 * ((window.AudioSettings && window.AudioSettings.masterVol) || 1);
    var now = c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, now); o.frequency.exponentialRampToValueAtTime(280, now + 0.12);
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    var flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 800;
    o.connect(flt); flt.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.18);
  };

  // Editor close
  S.editorClose = function() {
    var c = S.getCtx(); if (!c) return;
    var vol = 0.25 * ((window.AudioSettings && window.AudioSettings.masterVol) || 1);
    var now = c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(280, now); o.frequency.exponentialRampToValueAtTime(100, now + 0.14);
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    var flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 600;
    o.connect(flt); flt.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.16);
  };

  // Reset button — descending arpeggio
  S.uiReset = function() {
    var c = S.getCtx(); if (!c) return;
    var vol = 0.28 * ((window.AudioSettings && window.AudioSettings.masterVol) || 1);
    var now = c.currentTime;
    [880, 660, 440].forEach(function(f, i) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.value = f;
      var t = now + i * 0.07;
      g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.09);
    });
  };

  // Intro jingle — 8-bit Nintendo style, plays on game/menu load
  S.introJingle = function() {
    var c = S.getCtx(); if (!c) return;
    var vol = 0.04 * ((window.AudioSettings && window.AudioSettings.masterVol) || 1);
    var now = c.currentTime + 0.1;
    // Main melody — square wave, C major feel with a little jump
    var melody = [
      [523.25, 0.10], [659.25, 0.10], [783.99, 0.10], [1046.5, 0.18],
      [880.00, 0.10], [1046.5, 0.10], [1174.7, 0.10], [1318.5, 0.22],
      [1174.7, 0.10], [1046.5, 0.10], [880.00, 0.10], [783.99, 0.28],
      [659.25, 0.10], [783.99, 0.10], [880.00, 0.10], [1046.5, 0.35],
    ];
    var t = now;
    melody.forEach(function(note) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.value = note[0];
      var dur = note[1];
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.setValueAtTime(vol, t + dur - 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.01);
      t += dur;
    });
    // Bass line — triangle wave, every other beat
    var bass = [
      [130.81, 0.20], [196.00, 0.20], [164.81, 0.20], [174.61, 0.20],
      [130.81, 0.20], [130.81, 0.20], [196.00, 0.40],
    ];
    var bt = now;
    bass.forEach(function(note) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = note[0];
      var dur = note[1];
      g.gain.setValueAtTime(vol * 0.55, bt);
      g.gain.exponentialRampToValueAtTime(0.0001, bt + dur * 0.85);
      o.connect(g); g.connect(c.destination); o.start(bt); o.stop(bt + dur);
      bt += dur;
    });
    // Percussion — noise bursts on beat
    [0, 0.20, 0.40, 0.60, 0.80, 1.00, 1.20, 1.40].forEach(function(offset) {
      var bufLen = Math.ceil(c.sampleRate * 0.04);
      var buf = c.createBuffer(1, bufLen, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.2));
      var src = c.createBufferSource(); src.buffer = buf;
      var flt = c.createBiquadFilter(); flt.type = 'highpass'; flt.frequency.value = 4000;
      var g = c.createGain(); g.gain.setValueAtTime(vol * 0.4, now + offset);
      src.connect(flt); flt.connect(g); g.connect(c.destination);
      src.start(now + offset);
    });
  };

})();
