window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_FILE_VERSION['sound.js'] = 1302;
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

    var velFactor     = Math.min(speed / 15, 1.0);
    var densityFactor = (as.impactScaling !== false) ? Math.min(density / 2.0, 1.5) : 1.0;
    var sizeFactor    = (as.impactScaling !== false) ? Math.min(size / 12, 1.5)    : 1.0;
    var vol = 0.06 * velFactor * densityFactor * sizeFactor * master;
    vol = Math.max(0.02, Math.min(vol, 0.35));

    var detune = (as.pitchScaling !== false) ? (1.0 - density) * 220 : 0;

    // Ball-specific sounds (§3.2)
    switch (ballType) {
      case 'exploder':
        // Heavy thud
        playTone({ type: 'sine', freq: 90, freq2: 35, gain: vol * 1.4,
                   attack: 0.001, decay: 0.15, duration: 0.18, detune: detune });
        break;
      case 'sticky':
        // Soft dull thump
        playTone({ type: 'sine', freq: 140, freq2: 60, gain: vol * 0.9,
                   attack: 0.003, decay: 0.12, duration: 0.14, detune: detune });
        break;
      case 'splitter':
        // Crisp light click
        playTone({ type: 'triangle', freq: 320, freq2: 180, gain: vol * 0.7,
                   attack: 0.001, decay: 0.08, duration: 0.10, detune: detune });
        playNoise({ filterType: 'highpass', filterFreq: 3000, filterQ: 1,
                    gain: vol * 0.5, duration: 0.04 });
        break;
      case 'gravity':
        // Low resonant hum on impact
        playTone({ type: 'sine', freq: 110, freq2: 70, gain: vol * 1.1,
                   attack: 0.002, decay: 0.20, duration: 0.22, detune: detune });
        break;
      default: // bouncer — standard bounce
        playTone({ type: 'sine', freq: 180, freq2: 80, gain: vol,
                   attack: 0.001, decay: 0.10, duration: 0.12, detune: detune });
        playNoise({ filterType: 'bandpass', filterFreq: 800 + speed * 30,
                    filterQ: 2, gain: vol * 0.4, duration: 0.05 });
    }
  }

  // Explosion: short punchy, not overpowering (§3.3)
  function explode(tier) {
    if (!enabled) return;
    var c = getCtx(); if (!c) return;
    var now = c.currentTime;
    var vol = 0.18 + (tier || 1) * 0.06;

    // Sharp transient crack
    var bufSize = Math.ceil(c.sampleRate * 0.06);
    var buf = c.createBuffer(1, bufSize, c.sampleRate);
    var d   = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.08));
    var src = c.createBufferSource(); src.buffer = buf;
    var flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 1200 + tier * 200;
    var g   = c.createGain();
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    src.connect(flt); flt.connect(g); g.connect(c.destination);
    src.start(now); src.stop(now + 0.08);

    // Low punch body
    var osc = c.createOscillator(); var g2 = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120 + tier * 20, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.18);
    g2.gain.setValueAtTime(vol * 1.3, now); g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
    osc.connect(g2); g2.connect(c.destination); osc.start(now); osc.stop(now + 0.20);
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
