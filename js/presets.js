window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_FILE_VERSION['presets.js'] = 1530;
// presets.js — Physics preset save/load system
// Presets are stored in localStorage under 'puzzballs_presets'

var PRESET_STORAGE_KEY = 'puzzballs_presets';

var DEFAULT_PRESET = {
  name: 'Default',
  id:   'default',
  builtIn: true,
  gravity:  1.0,
  friction: 1.0,
  balls: {
    bouncer:  { velocity: 1.0, bounciness: 1.0 },
    exploder: { velocity: 1.0, bounciness: 0.8, blastRadius: 120, blastForce: 18 },
    sticky:   { velocity: 1.0, bounciness: 0.1, stickyStrength: 0.85 },
    splitter: { velocity: 1.0, bounciness: 0.9, splitCount: 2 },
    gravity:  { velocity: 1.0, bounciness: 0.7, gravRange: 140, gravPull: 0.55 },
  },
};

var BUILT_IN_PRESETS = [
  DEFAULT_PRESET,
  {
    name: 'Moon Physics',
    id:   'moon',
    builtIn: true,
    gravity:  0.3,
    friction: 0.995,
    balls: {
      bouncer:  { velocity: 1.2, bounciness: 1.4 },
      exploder: { velocity: 1.2, bounciness: 1.0, blastRadius: 160, blastForce: 14 },
      sticky:   { velocity: 1.0, bounciness: 0.2, stickyStrength: 0.7 },
      splitter: { velocity: 1.2, bounciness: 1.2, splitCount: 2 },
      gravity:  { velocity: 1.0, bounciness: 0.9, gravRange: 180, gravPull: 0.4 },
    },
  },
  {
    name: 'Heavy Gravity',
    id:   'heavy',
    builtIn: true,
    gravity:  2.0,
    friction: 0.97,
    balls: {
      bouncer:  { velocity: 1.5, bounciness: 0.8 },
      exploder: { velocity: 1.5, bounciness: 0.6, blastRadius: 100, blastForce: 22 },
      sticky:   { velocity: 1.2, bounciness: 0.05, stickyStrength: 0.95 },
      splitter: { velocity: 1.5, bounciness: 0.7, splitCount: 3 },
      gravity:  { velocity: 1.3, bounciness: 0.5, gravRange: 110, gravPull: 0.8 },
    },
  },
  {
    name: 'Chaos',
    id:   'chaos',
    builtIn: true,
    gravity:  0.6,
    friction: 0.999,
    balls: {
      bouncer:  { velocity: 2.0, bounciness: 1.8 },
      exploder: { velocity: 2.0, bounciness: 1.2, blastRadius: 200, blastForce: 30 },
      sticky:   { velocity: 1.5, bounciness: 0.3, stickyStrength: 0.5 },
      splitter: { velocity: 2.0, bounciness: 1.5, splitCount: 4 },
      gravity:  { velocity: 1.8, bounciness: 1.0, gravRange: 220, gravPull: 1.2 },
    },
  },
];

var Presets = (function() {

  function _loadFromStorage() {
    try {
      var raw = localStorage.getItem(PRESET_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function _saveToStorage(custom) {
    try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(custom)); } catch(e) {}
  }

  function getAll() {
    var custom = _loadFromStorage();
    return BUILT_IN_PRESETS.concat(custom);
  }

  function getById(id) {
    var all = getAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i];
    }
    return DEFAULT_PRESET;
  }

  function save(preset) {
    // Don't overwrite built-ins
    var custom = _loadFromStorage();
    var idx = -1;
    for (var i = 0; i < custom.length; i++) {
      if (custom[i].id === preset.id) { idx = i; break; }
    }
    if (idx >= 0) custom[idx] = preset;
    else custom.push(preset);
    _saveToStorage(custom);
  }

  function deleteCustom(id) {
    var custom = _loadFromStorage();
    custom = custom.filter(function(p) { return p.id !== id; });
    _saveToStorage(custom);
  }

  // Build a preset snapshot from current BallSettings + Settings
  function captureFromCurrent(name) {
    var id = 'custom_' + Date.now();
    return {
      id:   id,
      name: name,
      builtIn: false,
      gravity:  window.Settings ? (Settings.gravityMult || 1.0) : 1.0,
      friction: 1.0,
      balls: {
        bouncer:  _captureBall('bouncer'),
        exploder: _captureBall('exploder'),
        sticky:   _captureBall('sticky'),
        splitter: _captureBall('splitter'),
        gravity:  _captureBall('gravity'),
      },
    };
  }

  function _captureBall(type) {
    if (!window.BallSettings) return {};
    var bs = BallSettings[type];
    var out = { velocity: bs.velocity || 1.0, bounciness: bs.bounciness || 1.0, groundFriction: bs.groundFriction !== undefined ? bs.groundFriction : 0.88, density: bs.density || 1.0, baseDamage: bs.baseDamage || 20, bounceDecay: bs.bounceDecay !== undefined ? bs.bounceDecay : 0.72 };
    if (type === 'exploder') { out.blastRadius = bs.blastRadius; out.blastForce = bs.blastForce; }
    if (type === 'sticky')   { out.stickyStrength = bs.stickyStrength; out.stickThreshold = bs.stickThreshold || 6; }
    if (type === 'splitter') { out.splitCount = bs.splitCount; }
    if (type === 'gravity')  { out.gravRange = bs.gravRange; out.gravPull = bs.gravPull; }
    return out;
  }

  // Apply a preset to the live Settings + BallSettings objects
  function applyPreset(preset) {
    if (!window.Settings || !window.BallSettings) return;
    Settings.gravityMult = preset.gravity  || 1.0;
    Settings.frictionMult = preset.friction || 1.0;

    var types = ['bouncer','exploder','sticky','splitter','gravity'];
    types.forEach(function(type) {
      var src = (preset.balls && preset.balls[type]) || {};
      var dst = BallSettings[type];
      if (src.velocity       !== undefined) dst.velocity       = src.velocity;
      if (src.bounciness     !== undefined) dst.bounciness     = src.bounciness;
      if (src.groundFriction !== undefined) dst.groundFriction = src.groundFriction;
      if (src.density        !== undefined) dst.density        = src.density;
      if (src.baseDamage     !== undefined) dst.baseDamage     = src.baseDamage;
      if (src.bounceDecay    !== undefined) dst.bounceDecay    = src.bounceDecay;
      if (src.explosionDamage!== undefined) dst.explosionDamage= src.explosionDamage;
      if (src.bounceHeightY  !== undefined) dst.bounceHeightY  = src.bounceHeightY;
      if (src.bounceDistanceX!== undefined) dst.bounceDistanceX= src.bounceDistanceX;
      if (src.deadZonePercent!== undefined) dst.deadZonePercent= src.deadZonePercent;
      if (src.stickThreshold !== undefined) dst.stickThreshold = src.stickThreshold;
      if (type === 'exploder') {
        if (src.blastRadius !== undefined) dst.blastRadius = src.blastRadius;
        if (src.blastForce  !== undefined) dst.blastForce  = src.blastForce;
      }
      if (type === 'sticky'   && src.stickyStrength !== undefined) dst.stickyStrength = src.stickyStrength;
      if (type === 'sticky'   && src.stickThreshold !== undefined) dst.stickThreshold = src.stickThreshold;
      if (type === 'splitter' && src.splitCount     !== undefined) dst.splitCount     = src.splitCount;
      if (type === 'gravity') {
        if (src.gravRange !== undefined) dst.gravRange = src.gravRange;
        if (src.gravPull  !== undefined) dst.gravPull  = src.gravPull;
      }
    });
  }

  return { getAll, getById, save, deleteCustom, captureFromCurrent, applyPreset };
})();

window.Presets = Presets;
