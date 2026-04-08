window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_FILE_VERSION['balls.js'] = 1535;
// balls.js — Ball type definitions and behaviors

var BALL_TYPES = {
  BOUNCER:  'bouncer',
  EXPLODER: 'exploder',
  STICKY:   'sticky',
  SPLITTER: 'splitter',
  GRAVITY:  'gravity',
  SQUIGGLY: 'squiggly',
  SPLATTER: 'splatter',
  CUBE:     'cube',
};

// Base sizes scaled to 75% of original
var _S = 0.75;

var BallSettings = {
  bouncer: {
    label: 'BOUNCER', color: '#1040a0', glow: '#4488ff',
    size: Math.round(15 * _S),
    velocity: 1.0, bounciness: 1.0,
    density: 1.0, groundFriction: 0.88,
    baseDamage: 20,
    bounceDecay: 0.72,
  },
  exploder: {
    label: 'EXPLODER', color: '#8b1a00', glow: '#ff4400',
    size: Math.round(13 * _S),
    velocity: 1.0, bounciness: 0.85,
    density: 0.9, groundFriction: 0.85,
    blastRadius: 130, blastForce: 20,
    baseDamage: 35,
    explosionDamage: 40,  // flat extra damage on detonation (per spec §2.1)
    bounceDecay: 0.65,
  },
  sticky: {
    label: 'STICKY', color: '#1a6b00', glow: '#44ff44',
    size: Math.round(13 * _S),
    velocity: 1.0, bounciness: 0.15,
    density: 2.2, groundFriction: 0.70,
    stickyStrength: 0.85,
    stickThreshold: 10,
    baseDamage: 25,
    bounceDecay: 0.50,
    bounceHeightY: 80,     // max Y distance on tap-bounce (§1.2)
    bounceDistanceX: 60,   // max X distance on tap-bounce
    deadZonePercent: 30,   // % center blocked from straight-up (§1.3)
    stickiness: 50,
  },
  splitter: {
    label: 'SPLITTER', color: '#6b006b', glow: '#ff44ff',
    size: Math.round(14 * _S),
    velocity: 1.0, bounciness: 0.9,
    density: 0.5, groundFriction: 0.90,
    splitCount: 3, childDensity: 1.8,
    baseDamage: 15,
    bounceDecay: 0.75,
  },
  squiggly: {
    label: 'SQUIGGLY', color: '#ffcc00', glow: '#ffee44',
    r: 11, mass: 1.0, bounceMult: 0.65, gravMult: 0.9, dampMult: 1.0,
    size: 11, velocity: 1.0, bounciness: 0.65, density: 1.0,
    groundFriction: 0.82, baseDamage: 15, bounceDecay: 0.52,
  },
  splatter: {
    label: 'SPLATTER', color: '#884400', glow: '#cc6600',
    r: 9,  mass: 1.2, bounceMult: 0.0, gravMult: 1.0, dampMult: 0.0,
    size: 13, velocity: 0.9, bounciness: 0.0, density: 1.2,
    groundFriction: 0.0, baseDamage: 0, bounceDecay: 0.0,
  },
  cube: {
    label: 'CUBE', color: '#00ddff', glow: '#00ffff',
    r: 12, mass: 1.4, bounceMult: 0.72, gravMult: 1.0, dampMult: 0.95,
    size: 15, velocity: 1.1, bounciness: 0.72, density: 1.4,
    groundFriction: 0.88, baseDamage: 22, bounceDecay: 0.72,
  },
  gravity: {
    label: 'GRAV WELL', color: '#005555', glow: '#00ffee',
    size: Math.round(16 * _S),
    velocity: 1.0, bounciness: 0.7,
    density: 1.2, groundFriction: 0.86,
    gravRange: 200, gravPull: 2.0,
    baseDamage: 18,
    bounceDecay: 0.68,
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
  var childR   = Math.max(3, Math.round(parent.r * 0.18));  // tiny — about 1/5 parent
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
    // Stuck sticky balls can be pulled off by gravity well
    if (obj.pinned) continue;
    if (obj.stuckTo && !(obj.type === BALL_TYPES.STICKY && obj.stuckTo === '_wall_')) continue;
    var isStuck = (obj.type === BALL_TYPES.STICKY && obj.stuckTo === '_wall_');
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
      if (isStuck) {
        // For stuck stickies: accumulate pull force, pop off if strong enough
        var stickiness2 = (window.BallSettings && BallSettings.sticky && BallSettings.sticky.stickiness !== undefined)
          ? BallSettings.sticky.stickiness : 50;
        var gravThreshold = 0.3 + (stickiness2 / 100) * 2.5;
        if (pull > gravThreshold) {
          obj.stuckTo  = null;
          obj.inFlight = true;
          obj.vx = nx * pull * 3;
          obj.vy = ny * pull * 3;
          // Mouth-pop sound
          if (window.Sound && Sound.getCtx) {
            var _sc = Sound.getCtx();
            if (_sc) {
              var _gp = _sc.createGain(); _gp.connect(_sc.destination);
              _gp.gain.setValueAtTime(0.0, _sc.currentTime);
              _gp.gain.linearRampToValueAtTime(0.45, _sc.currentTime + 0.006);
              _gp.gain.exponentialRampToValueAtTime(0.001, _sc.currentTime + 0.18);
              var _op = _sc.createOscillator(); _op.connect(_gp);
              _op.type = 'sine';
              _op.frequency.setValueAtTime(800, _sc.currentTime);
              _op.frequency.exponentialRampToValueAtTime(120, _sc.currentTime + 0.12);
              _op.start(_sc.currentTime); _op.stop(_sc.currentTime + 0.18);
              // Second pop click
              var _gp2 = _sc.createGain(); _gp2.connect(_sc.destination);
              _gp2.gain.setValueAtTime(0.0, _sc.currentTime + 0.01);
              _gp2.gain.linearRampToValueAtTime(0.3, _sc.currentTime + 0.016);
              _gp2.gain.exponentialRampToValueAtTime(0.001, _sc.currentTime + 0.09);
              var _op2 = _sc.createOscillator(); _op2.connect(_gp2);
              _op2.type = 'sine';
              _op2.frequency.setValueAtTime(500, _sc.currentTime + 0.01);
              _op2.frequency.exponentialRampToValueAtTime(80, _sc.currentTime + 0.08);
              _op2.start(_sc.currentTime + 0.01); _op2.stop(_sc.currentTime + 0.09);
            }
          }
        }
        // else: just wiggle — don't move
      } else {
        obj.vx      += nx * pull;
        obj.vy      += ny * pull;
        obj.inFlight = true;
        // Cube: spin faster as it approaches gravity well
        if (obj.type === BALL_TYPES.CUBE && obj._cubeRot) {
          var spinBoost = pull * (range / Math.max(dist, 10)) * 0.08;
          var maxSpin = 0.15;
          obj._cubeRX = Math.max(-maxSpin, Math.min(maxSpin, (obj._cubeRX||0) + (Math.random()-0.5)*spinBoost));
          obj._cubeRY = Math.max(-maxSpin, Math.min(maxSpin, (obj._cubeRY||0) + (Math.random()-0.5)*spinBoost));
        }
      }
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
  // Static explosion damage (§2.1) — applied to all bricks in range
  var expDmg = (bs.explosionDamage || 40) * tier;

  if (window.Physics) {
    Physics.spawnSparks(sparks, exploder.x, exploder.y, '#ff6600', 50 + tier * 20);
    Physics.spawnSparks(sparks, exploder.x, exploder.y, '#ffcc00', 30 + tier * 15);
    Physics.spawnSparks(sparks, exploder.x, exploder.y, '#ffffff', 20);
    Physics.spawnSparks(sparks, exploder.x, exploder.y, '#ff3300', 25 + tier * 10);
  }
  _spawnShrapnel(sparks, exploder.x, exploder.y, radius, tier);
  if (window.Sound) Sound.explode(tier);

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

  // Apply flat explosion damage to bricks in range (§2.1)
  var game = window._gameInstance;
  if (game && game.bricks) {
    for (var bi = 0; bi < game.bricks.length; bi++) {
      var brick = game.bricks[bi];
      if (!brick.isAlive()) continue;
      var bdx  = brick.x - exploder.x, bdy = brick.y - exploder.y;
      var bdist = Math.hypot(bdx, bdy);
      if (bdist < radius + Math.max(brick.w, brick.h) / 2) {
        var falloff = Math.max(0, 1 - bdist / radius);
        brick.takeDamage(Math.round(expDmg * falloff));
        if (window.spawnBrickShards) spawnBrickShards(sparks, brick, exploder);
        // Detach any sticky balls stuck to this brick if it was destroyed
        if (!brick.isAlive()) {
          for (var si = 0; si < objects.length; si++) {
            if (objects[si].stuckTo === '_wall_') {
              // Can't easily know which wall — just check proximity
              if (Math.hypot(objects[si].x - brick.x, objects[si].y - brick.y) < brick.w) {
                objects[si].stuckTo = null;
                objects[si].inFlight = true;
                objects[si].vy = -2;
              }
            }
          }
        }
      }
    }
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
