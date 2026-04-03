window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_FILE_VERSION['balls.js'] = 1201;
// balls.js — Ball type definitions and behaviors

var BALL_TYPES = {
  BOUNCER:  'bouncer',
  EXPLODER: 'exploder',
  STICKY:   'sticky',
  SPLITTER: 'splitter',
  GRAVITY:  'gravity',
};

// Base sizes scaled to 75% of original
var _S = 0.75;

var BallSettings = {
  bouncer: {
    label: 'BOUNCER', color: '#1040a0', glow: '#4488ff',
    size: Math.round(15 * _S),
    velocity: 1.0, bounciness: 1.0,
    density: 1.0,
    groundFriction: 0.88,
    baseDamage: 20,   // base HP damage per hit (out of 100 HP)
  },
  exploder: {
    label: 'EXPLODER', color: '#8b1a00', glow: '#ff4400',
    size: Math.round(13 * _S),
    velocity: 1.0, bounciness: 0.85,
    density: 0.9,
    groundFriction: 0.85,
    blastRadius: 130, blastForce: 20,
    baseDamage: 35,
  },
  sticky: {
    label: 'STICKY', color: '#1a6b00', glow: '#44ff44',
    size: Math.round(13 * _S),
    velocity: 1.0, bounciness: 0.15,
    density: 2.2,
    stickyStrength: 0.85,
    stickThreshold: 6,
    groundFriction: 0.70,
    baseDamage: 25,   // dense/heavy so more impact
  },
  splitter: {
    label: 'SPLITTER', color: '#6b006b', glow: '#ff44ff',
    size: Math.round(14 * _S),
    velocity: 1.0, bounciness: 0.9,
    density: 0.5,
    groundFriction: 0.90,
    splitCount: 3,
    childDensity: 1.8,
    baseDamage: 15,   // light ball, less damage
  },
  gravity: {
    label: 'GRAV WELL', color: '#005555', glow: '#00ffee',
    size: Math.round(16 * _S),
    velocity: 1.0, bounciness: 0.7,
    density: 1.2,
    groundFriction: 0.86,
    gravRange: 150,
    gravPull:  0.55,
    baseDamage: 18,
  },
};

// ── _makeMass: derive mass from radius + density ──────────────────────────────
function _ballMass(type, r) {
  var density = (BallSettings[type] || BallSettings.bouncer).density || 1.0;
  return (r / 10) * density;
}

// ── Splitter children — heavier, become mini-exploders ────────────────────────
function makeSplitChildren(parent, count) {
  var children = [];
  var bs       = BallSettings.splitter;
  var childR   = Math.max(4, parent.r * 0.7);
  for (var i = 0; i < count; i++) {
    var angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    var speed = Math.hypot(parent.vx, parent.vy) * 0.75 + 3;
    var childMass = (childR / 10) * bs.childDensity;
    var child = new PhysObj(
      parent.x + Math.cos(angle) * (parent.r + childR + 2),
      parent.y + Math.sin(angle) * (parent.r + childR + 2),
      childR, childMass, '#6b2200', '#ff6600', 'SPC'
    );
    child.vx           = Math.cos(angle) * speed;
    child.vy           = Math.sin(angle) * speed;
    child.type         = BALL_TYPES.EXPLODER;
    child.isSplitChild = true;
    child.inFlight     = true;
    child.exploded     = false;
    child.dead         = false;
    child.hasStuck     = false;
    child.hasSplit     = false;
    child.stuckTo      = null;
    child.gravActive   = false;
    child._slungIds    = [];
    child.bouncesLeft  = 1;
    child._explodeTier = 1;
    children.push(child);
  }
  return children;
}

// ── Gravity well ──────────────────────────────────────────────────────────────
function applyGravityWell(well, objects) {
  if (!well.gravActive) return;

  var bs         = BallSettings.gravity;
  var range      = bs.gravRange;
  var basePull   = bs.gravPull;
  var coreRadius = well.r + 6;

  if (!well._slungIds) well._slungIds = [];

  for (var i = 0; i < objects.length; i++) {
    var obj = objects[i];
    if (obj === well)                   continue;
    if (obj.pinned || obj.stuckTo)      continue;
    if (obj.dead)                       continue;
    if (_arrayHas(well._slungIds, obj)) continue;

    var dx   = well.x - obj.x;
    var dy   = well.y - obj.y;
    var dist = Math.hypot(dx, dy);
    if (dist < 0.5 || dist > range)     continue;

    var nx = dx / dist;
    var ny = dy / dist;

    // Denser balls resist gravity pull
    var density       = (BallSettings[obj.type] || BallSettings.bouncer).density || 1.0;
    var densityFactor = 1.0 / density;

    if (dist <= coreRadius) {
      // Pass-through eject
      var inSpeed    = Math.hypot(obj.vx, obj.vy);
      var ejectSpeed = Math.max(inSpeed * 1.6, 11);
      obj.vx       = -nx * ejectSpeed;
      obj.vy       = -ny * ejectSpeed;
      obj.inFlight = true;
      well._slungIds.push(obj);
      if (window.Physics) Physics.spawnSparks(window._gameSparks || [], obj.x, obj.y, '#00ffee', 16);
      if (window.Sound)   Sound.snap(0.65);
    } else {
      var pull = basePull * (range / dist) * (range / dist) * 0.04 * densityFactor;
      pull = Math.min(pull, 2.8);
      obj.vx      += nx * pull;
      obj.vy      += ny * pull;
      obj.inFlight = true;
    }
  }
}

function _arrayHas(arr, val) {
  for (var i = 0; i < arr.length; i++) if (arr[i] === val) return true;
  return false;
}

function resetGravityWell(well) {
  well.gravActive = false;
  well._slungIds  = [];
}

// ── Exploder — 3-tier countdown system ───────────────────────────────────────
// obj.bouncesLeft counts down per collision; 0 = explode.
// obj._explodeTier (1/2/3) controls visual rings + blast size.
function triggerExplosion(exploder, objects, sparks) {
  if (exploder.exploded) return;
  exploder.exploded = true;
  exploder.dead     = true;

  var bs     = BallSettings.exploder;
  var tier   = exploder._explodeTier || 1;
  var radius = bs.blastRadius * (0.7 + tier * 0.3);
  var force  = bs.blastForce  * (0.7 + tier * 0.3);

  if (window.Physics) {
    Physics.spawnSparks(sparks, exploder.x, exploder.y, '#ff6600', 50 + tier * 20);
    Physics.spawnSparks(sparks, exploder.x, exploder.y, '#ffcc00', 30 + tier * 15);
    Physics.spawnSparks(sparks, exploder.x, exploder.y, '#ffffff', 20);
    Physics.spawnSparks(sparks, exploder.x, exploder.y, '#ff3300', 25 + tier * 10);
  }
  _spawnShrapnel(sparks, exploder.x, exploder.y, radius, tier);
  if (window.Sound) Sound.thud(15 + tier * 5);

  for (var i = 0; i < objects.length; i++) {
    var obj = objects[i];
    if (obj === exploder) continue;
    var dx   = obj.x - exploder.x;
    var dy   = obj.y - exploder.y;
    var dist = Math.hypot(dx, dy);
    if (dist < 1 || dist > radius) continue;
    var density  = (BallSettings[obj.type] || BallSettings.bouncer).density || 1.0;
    var strength = force * Math.pow(1 - dist / radius, 1.5) / density;
    obj.vx += (dx / dist) * strength;
    obj.vy += (dy / dist) * strength;
    obj.inFlight = true;
  }
}

function _spawnShrapnel(sparks, x, y, radius, tier) {
  if (!sparks) return;
  var count = 18 + (tier || 1) * 8;
  for (var i = 0; i < count; i++) {
    var angle = Math.random() * Math.PI * 2;
    var speed = 4 + Math.random() * (8 + (tier || 1) * 3);
    sparks.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.010 + Math.random() * 0.015,
      color: Math.random() < 0.5 ? '#ff8800' : '#ffee00',
      size: 2 + Math.random() * (2 + tier),
    });
  }
}

window.BALL_TYPES        = BALL_TYPES;
window.BallSettings      = BallSettings;
window._ballMass         = _ballMass;
window.makeSplitChildren = makeSplitChildren;
window.applyGravityWell  = applyGravityWell;
window.resetGravityWell  = resetGravityWell;
window.triggerExplosion  = triggerExplosion;
