window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_FILE_VERSION['game.js'] = 1645;

// ── Tube render debug panel ───────────────────────────────────────────────────
window._tubeDebugPanelOpen = false;

window._buildTubeDebugPanel = function() {
  // Toggle panel visibility — don't destroy it (preserves slider state)
  var existing = document.getElementById('tube-debug-panel');
  if (existing) {
    existing.style.display = existing.style.display === 'none' ? 'block' : 'none';
    return;
  }

  var panel = document.createElement('div');
  panel.id = 'tube-debug-panel';
  panel.style.cssText = [
    'position:fixed', 'bottom:80px', 'left:10px', 'z-index:9999',
    'background:rgba(0,0,0,0.92)', 'border:1px solid #00ffcc',
    'border-radius:10px', 'padding:10px 14px', 'min-width:200px',
    'font-family:monospace', 'font-size:13px', 'color:#00ffcc',
    'box-shadow:0 0 16px #00ffcc44', 'user-select:none'
  ].join(';');

  // Title row with X close button
  var titleRow = document.createElement('div');
  titleRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';
  var titleTxt = document.createElement('span');
  titleTxt.textContent = '🔬 TUBE LAYERS';
  titleTxt.style.cssText = 'font-weight:bold; color:#ffffff; letter-spacing:2px; font-size:11px;';
  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none; border:none; color:#00ffcc; font-size:14px; cursor:pointer; padding:0 2px; line-height:1;';
  closeBtn.addEventListener('click', function() { panel.style.display = 'none'; });
  titleRow.appendChild(titleTxt);
  titleRow.appendChild(closeBtn);
  panel.appendChild(titleRow);

  var flags = [
    { key: 'bodyFill',    label: 'Body fill (0.06α)' },
    { key: 'outerGlow',   label: 'Outer glow stroke' },
    { key: 'mainWall',    label: 'Main wall stroke' },
    { key: 'highlight',   label: 'Highlight edge' },
    { key: 'gloss',       label: 'Gloss stripe' },
    { key: 'jointFillet', label: 'Joint fillet curves' },
    { key: 'endCaps',     label: 'End caps' },
    { key: 'capDarkFill', label: 'Cap dark interior' },
    { key: 'selectOutline', label: '⚡ Select outline' },
    { key: 'selectGlow',    label: '⚡ Select glow' },
    { key: 'selectJointHL', label: '⚡ Select joint fillets' },
  ];

  flags.forEach(function(f) {
    var row = document.createElement('label');
    row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:3px 0; cursor:pointer;';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = window.TUBE_DEBUG[f.key];
    cb.style.cssText = 'width:16px; height:16px; cursor:pointer; accent-color:#00ffcc;';
    cb.addEventListener('change', function() { window.TUBE_DEBUG[f.key] = cb.checked; });
    var lbl = document.createElement('span');
    lbl.textContent = f.label;
    row.appendChild(cb); row.appendChild(lbl);
    panel.appendChild(row);
  });

  // Body fill brightness slider — label and slider as separate elements
  var sliderLabel = document.createElement('div');
  sliderLabel.style.cssText = 'margin-top:8px; font-size:11px; color:#aaffcc;';
  sliderLabel.textContent = 'Fill brightness: 1.0x';
  var slider = document.createElement('input');
  slider.type = 'range'; slider.min = '0'; slider.max = '20'; slider.step = '0.5';
  slider.value = String(window.TUBE_DEBUG.bodyFillMult || 1.0);
  slider.style.cssText = 'width:100%; accent-color:#00ffcc; margin-top:4px; display:block;';
  slider.addEventListener('input', function() {
    window.TUBE_DEBUG.bodyFillMult = parseFloat(slider.value);
    sliderLabel.textContent = 'Fill brightness: ' + slider.value + 'x';
  });
  panel.appendChild(sliderLabel);
  panel.appendChild(slider);

  // Selection glow brightness slider
  var glowSliderLabel = document.createElement('div');
  glowSliderLabel.style.cssText = 'margin-top:8px; font-size:11px; color:#aaffcc;';
  glowSliderLabel.textContent = 'Select glow: ' + (window.TUBE_DEBUG.selectGlowMult || 1.0).toFixed(1) + 'x';
  var glowSlider = document.createElement('input');
  glowSlider.type = 'range'; glowSlider.min = '0'; glowSlider.max = '5'; glowSlider.step = '0.1';
  glowSlider.value = String(window.TUBE_DEBUG.selectGlowMult || 1.0);
  glowSlider.style.cssText = 'width:100%; accent-color:#00eeff; margin-top:4px; display:block;';
  glowSlider.addEventListener('input', function() {
    window.TUBE_DEBUG.selectGlowMult = parseFloat(glowSlider.value);
    glowSliderLabel.textContent = 'Select glow: ' + parseFloat(glowSlider.value).toFixed(1) + 'x';
  });
  panel.appendChild(glowSliderLabel);
  panel.appendChild(glowSlider);

  // Reset all button
  var resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset All ON';
  resetBtn.style.cssText = [
    'margin-top:8px', 'width:100%', 'padding:5px',
    'background:#003322', 'color:#00ffcc', 'border:1px solid #00ffcc',
    'border-radius:6px', 'cursor:pointer', 'font-family:monospace', 'font-size:12px'
  ].join(';');
  resetBtn.addEventListener('click', function() {
    Object.keys(window.TUBE_DEBUG).forEach(function(k) {
      if (typeof window.TUBE_DEBUG[k] === 'boolean') window.TUBE_DEBUG[k] = true;
      if (k === 'bodyFillMult') window.TUBE_DEBUG[k] = 1.0;
      if (k === 'selectGlowMult') window.TUBE_DEBUG[k] = 1.0;
    });
    panel.querySelectorAll('input[type=checkbox]').forEach(function(cb) { cb.checked = true; });
    slider.value = '1'; sliderLabel.textContent = 'Fill brightness: 1.0x';
    glowSlider.value = '1'; glowSliderLabel.textContent = 'Select glow: 1.0x';
  });
  panel.appendChild(resetBtn);

  document.body.appendChild(panel);
};
// game.js — PuzzBalls game controller

var SLING_MIN_OFFSET = 10;
var SLING_MAX_PULL   = 180;
var SLING_POWER      = 0.38;
var FLOOR_MARGIN     = 150;

// Runtime physics multipliers — set by preset
var Settings = {
  gravityMult:  1.0,
  frictionMult: 1.0,
};

function getSpawnX(index, total, W) {
  var margin = 0.10;
  var step   = (1.0 - margin * 2) / (total - 1 || 1);
  return (margin + step * index) * W;
}

class Game {
  constructor(canvas, onBackToMenu) {
    this.canvas        = canvas;
    this.ctx           = canvas.getContext('2d');
    this.onBackToMenu  = onBackToMenu;
    this.levelData     = null;

    this.W = window.innerWidth;
    this.H = canvas.clientHeight || window.innerHeight;
    this.canvas.width  = this.W;
    this.canvas.height = this.H;

    this.score      = 0;
    this.collisions = 0;
    this.won        = false;
    this.winTimer   = 0;
    this.frame      = 0;

    this.objects    = [];
    this.obstacles  = [];
    this.sparks     = [];
    this.target     = null;
    this.barrier    = null;
    this.sling      = null;

    this.ballQueue  = [];   // remaining balls to be slung, by type
    this.objectives = [];   // { description, met }
    this.speedMult  = 0.5;  // global simulation speed — 50% default
    this.brickSpeedMult = 0.5;  // brick movement speed multiplier
    this._slingZoneH    = 100;  // px above floor that balls can be tapped
    this.tubes          = new TubeManager();
    this._tubeSelected  = null;
    this._tubeDragging  = null;
    this._editorTubeMode = false;
    this.splats = [];
    this._dmgNumbers = [];  // floating damage number particles   // px the whole view is shifted up (unused currently)
    this._editorScrollY   = 0;   // px the editor panel is scrolled up
    this._aimMode   = 'pull'; // 'pull' = classic pull-back, 'push' = drag-up-to-aim

    // ── Phase 2: Interactive Objects ─────────────────────────────────────────
    this.buttons   = [];
    this.bricks    = [];
    this.turnstiles = [];
    this.ports     = [];
    this.spawners  = [];

    // Store reference for event system
    window._gameInstance = this;

    this.stars = this._buildStars(180);
    this.nebulaOffscreen = null;

    this.ui = new UI({
      canvas:        canvas,
      onReset:       () => this._resetLevel(),
      onBackToMenu:  () => { this.stop(); this.onBackToMenu(); },
      game:          this,
    });

    this._loop = this._loop.bind(this);
    this._rafId = null;

    window.addEventListener('resize', () => {
      this.W = window.innerWidth;
      this.H = canvas.clientHeight || window.innerHeight;
      this.canvas.width  = this.W;
      this.canvas.height = this.H;
      this.nebulaOffscreen = this._buildNebulaOffscreen();
      if (this.levelData) this._spawnLevel();
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  loadLevel(levelData) {
    this.levelData = levelData;
    try {
      this.nebulaOffscreen = this._buildNebulaOffscreen();
      this._spawnLevel();
    } catch(err) {
      console.error('PuzzBalls loadLevel crash:', err);
      // Show error on canvas immediately
      var ctx = this.ctx;
      if (ctx) {
        ctx.fillStyle = '#030a18'; ctx.fillRect(0,0,this.W,this.H);
        ctx.fillStyle = '#ff4444'; ctx.font = "bold 13px 'Share Tech Mono',monospace";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('LOAD ERROR:', this.W/2, this.H/2 - 30);
        ctx.fillStyle = '#ff8888'; ctx.font = "11px 'Share Tech Mono',monospace";
        // Word-wrap the error message
        var msg = err.message || String(err);
        ctx.fillText(msg.slice(0,50), this.W/2, this.H/2);
        if (msg.length > 50) ctx.fillText(msg.slice(50,100), this.W/2, this.H/2 + 18);
        ctx.fillStyle = '#ffaa44'; ctx.font = "9px 'Share Tech Mono',monospace";
        ctx.fillText(err.stack ? err.stack.split('\n')[1] : '', this.W/2, this.H/2 + 44);
        ctx.fillText('Tap ⟳ to retry', this.W/2, this.H/2 + 68);
      }
    }
    this._bindInput();
    if (!this._rafId) this._rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  // ── Level setup ────────────────────────────────────────────────────────────

  _spawnLevel() {
    if (window.Sound && Sound.introJingle && !this._jinglePlayed) {
      this._jinglePlayed = true;
      Sound.introJingle();
    }
    var self = this;
    var W    = this.W;
    var ld   = this.levelData;

    // Build ball queue from level definition
    this.ballQueue = [];
    ld.balls.forEach(function(entry) {
      for (var c = 0; c < entry.count; c++) {
        self.ballQueue.push(entry.type);
      }
    });

    // Chute: starts EMPTY — player drops balls via chute buttons
    this.objects = [];
    this._chuteQueue   = [];   // empty — player taps buttons to add
    this._chuteActive  = [];
    this._chuteTimer   = 0;
    this._chuteDelay   = 500;
    this._deleteMode   = false;
    // Keep _aimMode across level resets

    // Obstacles
    this.obstacles = ld.obstacles.map(function(d) {
      return new StaticObstacle(d.rx * W, d.ry * self.floorY(), d.shape, d.size);
    });

    // Target
    var t = ld.target;
    var tx = t.rx * W;
    var ty = t.ry * this.floorY() + t.r + t.barrierR;
    this.target  = new TargetZone(tx, ty, t.r);
    this.barrier = new TargetBarrier(tx, ty, t.barrierR, t.barrierThickness, t.barrierGap, t.barrierGapAngle);

    // Objectives
    this.objectives = ld.objectives.map(function(o) {
      return { id: o.id, type: o.type, ballType: o.ballType, portId: o.portId, brickId: o.brickId, description: o.description, met: false };
    });

    // Phase 2: Spawn interactive objects
    EventManager.reset();
    this.buttons    = [];
    this.bricks     = [];
    this.turnstiles = [];
    this.ports      = [];
    this.spawners   = [];

    // Restore editor-placed bricks from custom level save
    if (ld.objects) {
      ld.objects.forEach(function(objDef) {
        var x = (objDef.rx !== undefined ? objDef.rx * W : objDef.x || W * 0.5);
        var y = (objDef.ry !== undefined ? objDef.ry * self.floorY() : objDef.y || self.floorY() * 0.5);
        // Custom levels store absolute x/y directly
        if (objDef.x !== undefined) x = objDef.x;
        if (objDef.y !== undefined) y = objDef.y;
        var obj = null;
        switch (objDef.type) {
          case 'button':
            obj = new Button(x, y, objDef.r || 18, objDef.id);
            self.buttons.push(obj);
            break;
          case 'breakable_brick':
            obj = new BreakableBrick(x, y, objDef.w || 40, objDef.h || 22, objDef.health || 100, objDef.id, objDef.regenAfter || null);
            if (objDef.rotation) obj._rotation = objDef.rotation;
            if (objDef._movable) obj._movable = objDef._movable;
            if (objDef._density !== undefined) obj._density = objDef._density;
            if (objDef._maxTravel !== undefined) obj._maxTravel = objDef._maxTravel;
            if (objDef._decel !== undefined) obj._decel = objDef._decel;
            if (objDef._rotSpeed !== undefined) obj._rotSpeed = objDef._rotSpeed;
            if (objDef._rotDecel !== undefined) obj._rotDecel = objDef._rotDecel;
            if (objDef._wallBounce !== undefined) obj._wallBounce = objDef._wallBounce;
            if (objDef._invincible) obj._invincible = true;
            if (objDef._noRegen) obj._noRegen = true;
            if (objDef._noteConfig) obj._noteConfig = objDef._noteConfig;
            self.bricks.push(obj);
            break;
          case 'circular_brick':
            obj = new CircularBrick(x, y, objDef.r || 22, objDef.health || 100, objDef.id, objDef.regenAfter || null);
            if (objDef.rotation) obj._rotation = objDef.rotation;
            if (objDef._movable) obj._movable = objDef._movable;
            if (objDef._noteConfig) obj._noteConfig = objDef._noteConfig;
            self.bricks.push(obj);
            break;
          case 'turnstile':
            obj = new RotatingTurnstile(x, y, objDef.r || 40, objDef.rotationSpeed || 180, objDef.id);
            self.turnstiles.push(obj);
            break;
          case 'electrical_port':
            obj = new ElectricalPort(x, y, objDef.r || 20, objDef.requiredBallType || null, objDef.id);
            self.ports.push(obj);
            break;
          case 'spawner':
            obj = new BallSpawner(x, y, objDef.spawnType || 'bouncer', objDef.spawnInterval || 1000, objDef.spawnCount || null, objDef.id);
            self.spawners.push(obj);
            break;
        }
        if (obj) {
          EventManager.registerTarget(objDef.id, obj);
          if (objDef.triggers) {
            objDef.triggers.forEach(function(trigger) {
              EventManager.subscribe(objDef.id + '_triggered', trigger);
            });
          }
        }
      });
    }

    // Restore active balls from save (if present)
    if (ld.activeBalls && ld.activeBalls.length) {
      ld.activeBalls.forEach(function(bd) {
        var bs = BallSettings[bd.type] || BallSettings.bouncer;
        var obj = new PhysObj(bd.x, bd.y, bd.r || bs.size, bd.mass || 1.0, bd.color || bs.color, bd.glow || bs.glow, bd.label || bs.label.slice(0,3));
        obj.type = bd.type;
        obj.vx = bd.vx || 0; obj.vy = bd.vy || 0;
        obj.inFlight = bd.inFlight || false;
        obj.pinned = bd.pinned || false;
        obj.stuckTo = bd.stuckTo || null;
        obj.gravActive = bd.gravActive || false;
        obj._fromChute = bd._fromChute || false;
        obj.exploded = false; obj.dead = false;
        obj.hasStuck = false; obj.hasSplit = false;
        obj._slungIds = [];
        if (bd.type === BALL_TYPES.CUBE) {
          obj._cubeRot = bd._cubeRot || [1,0,0,0,1,0,0,0,1];
          obj._cubeRX = bd._cubeRX || 0; obj._cubeRY = bd._cubeRY || 0; obj._cubeRZ = bd._cubeRZ || 0;
          obj._cubeHP = bd._cubeHP || 4; obj._cubeMaxHP = bd._cubeMaxHP || 4;
          obj._cubeShattering = false; obj._cubeShards = null;
        }
        if (bd.type === BALL_TYPES.EXPLODER) {
          obj._explodeTier = bd._explodeTier || 1;
          obj.bouncesLeft = bd.bouncesLeft || 1;
        }
        if (bd.type === BALL_TYPES.SQUIGGLY) {
          obj._sqAmp = bd._sqAmp || 18; obj._sqFreq = bd._sqFreq || 0.08;
          obj._sqFade = bd._sqFade || 0; obj._sqDelay = bd._sqDelay || 0;
          obj._sqWave = bd._sqWave || 'sine'; obj._sqT = 0;
          obj._ghostVx = 0; obj._ghostVy = 0; obj._ghostX = 0; obj._ghostY = 0;
        }
        self.objects.push(obj);
      });
    }

    // Register barrier so buttons can open_door it
    if (this.barrier) {
      var self2 = this;
      var savedGap = this.barrier.gapHalfAngle;
      this.barrier.isOpen = false;
      this.barrier.openDoor = function() {
        self2.barrier._savedGap = self2.barrier.gapHalfAngle;
        self2.barrier.gapHalfAngle = Math.PI;
        self2.barrier.isOpen = true;
      };
      this.barrier.closeDoor = function() {
        self2.barrier.gapHalfAngle = self2.barrier._savedGap || savedGap;
        self2.barrier.isOpen = false;
      };
      EventManager.registerTarget('barrier_main', this.barrier);
    }

    this.sparks     = [];
    this._dmgNumbers = [];
    this.won        = false;
    this.winTimer   = 0;
    this.collisions = 0;
    this.score      = 0;
    this.sling      = null;

    // Restore tubes from custom level save
    this.tubes = new TubeManager();
    if (ld.tubeData && ld.tubeData.length > 0) {
      this.tubes.fromJSON(ld.tubeData);
    }

    this.ui.attachObjects(this.objects);
    this.ui.setScore(0);
    this.ui.setCollisions(0);
    this.ui.setLevel(ld.name);
    this.ui.hideWin();
    this.ui.setObjectives(this.objectives);
  }

  _resetLevel() {
    if (this.levelData) this._spawnLevel();
  }

  _makeBall(type, x) {
    var bs   = BallSettings[type];
    var r    = bs.size;
    var y    = this.floorY() - r;
    var mass = (r / 10) * (bs.density || 1.0);
    var obj  = new PhysObj(x, y, r, mass, bs.color, bs.glow, bs.label.slice(0, 3));
    obj.type       = type;
    obj.inFlight   = false;
    obj.pinned     = false;
    obj.exploded   = false;
    obj.dead       = false;
    obj.hasStuck   = false;
    obj.hasSplit   = false;
    obj.stuckTo    = null;
    obj.gravActive = false;
    obj._slungIds  = [];
    // Exploder: assign random tier (1, 2, or 3) and set bounce countdown
    if (type === BALL_TYPES.CUBE) {
      var cset = (window.Settings && window.Settings.cube) || {};
      obj._cubeHP     = cset.hp    !== undefined ? cset.hp    : 4;
      obj._cubeMaxHP  = obj._cubeHP;
      obj._cubeSpin   = cset.spin  !== undefined ? cset.spin  : 1.0;
      obj._cubeChaos  = cset.chaos !== undefined ? cset.chaos : 0.6;
      // 3D rotation matrix (starts as identity)
      // Start with random tilt so multiple faces show immediately
      var _ca = 0.3 + Math.random() * 0.5, _cb = Math.random() * 0.4;
      var _cx=Math.cos(_ca),_sx=Math.sin(_ca),_cy=Math.cos(_cb),_sy=Math.sin(_cb);
      obj._cubeRot = [
        _cy, 0, _sy,
        _sx*_sy, _cx, -_sx*_cy,
        -_cx*_sy, _sx, _cx*_cy
      ];
      // Angular velocities on 3 axes — start spinning visibly
      var spd = 0.025 + Math.random() * 0.035;
      obj._cubeRX = (Math.random()-0.5) * spd * 2;
      obj._cubeRY = (Math.random()-0.5) * spd * 3;
      obj._cubeRZ = (Math.random()-0.5) * spd * 0.8;
      obj._cubeShattering = false;
      obj._cubeShards = null;
      var cubeSize = (window.Settings && window.Settings.cube && window.Settings.cube.size) || 1.0;
      obj.r = Math.max(3, Math.round(9 * cubeSize));
      obj.mass = (obj.r / 10) * ((BallSettings.cube && BallSettings.cube.density) || 1.4);
      obj.y = this.floorY() - obj.r;
    }
    if (type === BALL_TYPES.SQUIGGLY) {
      var sqSet = (window.Settings && window.Settings.squiggly) || {};
      obj._sqAmp   = sqSet.amp   !== undefined ? sqSet.amp   : 18;
      obj._sqFreq  = sqSet.freq  !== undefined ? sqSet.freq  : 0.08;
      obj._sqFade  = sqSet.fade  !== undefined ? sqSet.fade  : 0.0;
      obj._sqDelay = sqSet.delay !== undefined ? sqSet.delay : 0.0;
      obj._sqWave  = sqSet.wave  !== undefined ? sqSet.wave  : 'sine';
      obj._sqT     = 0;
      obj._ghostVx = 0; obj._ghostVy = 0;
      obj._ghostX  = 0; obj._ghostY  = 0;
    }
    if (type === BALL_TYPES.EXPLODER) {
      obj._explodeTier = Math.ceil(Math.random() * 3);
      obj.bouncesLeft  = obj._explodeTier;
    }
    return obj;
  }

  floorY() { return this.H - FLOOR_MARGIN; }

  // ── Input ──────────────────────────────────────────────────────────────────

  _bindInput() {
    var self   = this;
    var canvas = this.canvas;
    if (this._inputBound) return;
    this._inputBound = true;

    function getPos(e) {
      var rect   = canvas.getBoundingClientRect();
      var src    = e.touches ? e.touches[0] : e;
      var scaleX = canvas.width  / rect.width;
      var scaleY = canvas.height / rect.height;
      return {
        x: (src.clientX - rect.left) * scaleX,
        y: (src.clientY - rect.top)  * scaleY
      };
    }

    function isUI(t) {
      if (!t) return false;
      if (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'SELECT') return true;
      if (t.closest && (t.closest('#hud-overlay') || t.closest('#settings-panel') || t.closest('#objectives-panel'))) return true;
      return false;
    }

    function onDown(e) {
      if (isUI(e.target)) return;
      // Two-finger = start pinch — init state immediately
      if (e.touches && e.touches.length >= 2) {
        self._lastPinchAngle = undefined;
        self._editorPinchStart = null;
        self._tubePinchStart = null;

        if (self._editorTubeMode) {
          var rect2 = self.canvas.getBoundingClientRect();
          var z5 = self._viewZoom || 1.0;
          var fY2 = self.floorY();
          var W2 = self.W;
          function toWorld2(t) {
            var _scX2 = self.canvas.width  / rect2.width;
            var _scY2 = self.canvas.height / rect2.height;
            var sx = (t.clientX - rect2.left) * _scX2;
            var sy = (t.clientY - rect2.top)  * _scY2;
            return { x: (sx - W2) / z5 + W2, y: (sy - fY2) / z5 + fY2 };
          }
          var pt0 = e.touches[0], pt1 = e.touches[1];
          var pp0 = toWorld2(pt0);
          var pp1 = toWorld2(pt1);
          // Find tube under first finger if none selected
          if (!self._tubeSelected) {
            var tubes2 = self.tubes.tubes;
            for (var ti2b = tubes2.length-1; ti2b >= 0; ti2b--) {
              var tb2 = tubes2[ti2b];
              var path2 = tb2._path;
              if (!path2) continue;
              for (var pi2 = 0; pi2 < path2.length; pi2++) {
                if (Math.hypot(pp0.x - path2[pi2].x, pp0.y - path2[pi2].y) < tb2.radius + 20) {
                  self._tubeSelected = tb2; break;
                }
              }
              if (self._tubeSelected) break;
            }
          }
          if (self._tubeSelected) {
            var td2 = self._tubeSelected;
            var isConn2 = td2.connectedA || td2.connectedB;
            if (isConn2) {
              // Two fingers on a connected tube: group drag/rotate whole chain
              var grp2 = self.tubes.getConnectedGroup(td2);
              for (var _ghi2 = 0; _ghi2 < grp2.length; _ghi2++) grp2[_ghi2]._groupHighlight = true;
              var gcx2 = grp2.reduce(function(s,t){return s+t.x;},0)/grp2.length;
              var gcy2 = grp2.reduce(function(s,t){return s+t.y;},0)/grp2.length;
              self._tubeGroupDrag = {
                group: grp2,
                startX: pp0.x, startY: pp0.y,
                origins: grp2.map(function(t) { return { x: t.x, y: t.y }; }),
                cx: gcx2, cy: gcy2, snapCandidate: null,
              };
              self._tubeGroupPinchStart = {
                angle: Math.atan2(pp1.y - pp0.y, pp1.x - pp0.x),
                mx: (pp0.x + pp1.x) * 0.5, my: (pp0.y + pp1.y) * 0.5,
              };
              self._tubeDragging = null;
              self._tubePinchStart = null;
            } else {
              self._tubeDragging = td2;
              self._tubeDragOffX = 0; self._tubeDragOffY = 0;
              self._tubePinchStart = {
                p0:pp0, p1:pp1, x:td2.x, y:td2.y,
                rot:td2.rotation, len:td2.length,
                dist: Math.hypot(pp1.x-pp0.x, pp1.y-pp0.y),
                angle: Math.atan2(pp1.y-pp0.y, pp1.x-pp0.x),
              };
            }
          }
        } else if (!self._editorTubeMode && self._editorSelected) {
          self._editorPinchStart = null;
        }
        return;
      }
      // Let touches in the HUD button strip pass through to DOM elements
      var hudH = 56;  // approximate height of top HUD bar
      var firstTouch = e.touches ? e.touches[0] : e;
      if (firstTouch) {
        var _hudRect = canvas.getBoundingClientRect();
        var _hudScaleY = canvas.height / _hudRect.height;
        var _scaledY = (firstTouch.clientY - _hudRect.top) * _hudScaleY;
        if (_scaledY < hudH) return;
      }
      e.preventDefault();
      if (window.Sound) Sound.getCtx();

      var pos = getPos(e);
      // World position (zoom-adjusted) for game interactions
      var _worldPos = { x: pos.x, y: pos.y };

      // ── Corner HUD buttons — only when editor is closed ─────────────────────
      if (!self._editorMode) {
      if (self._cornerBrickBtns) {
        for (var cbi = 0; cbi < self._cornerBrickBtns.length; cbi++) {
          var cbr = self._cornerBrickBtns[cbi];
          if (pos.x >= cbr.x && pos.x <= cbr.x + cbr.w && pos.y >= cbr.y && pos.y <= cbr.y + cbr.h) {
            if (window.Sound && Sound.uiToggle) Sound.uiToggle(!window[cbr.key]);
            window[cbr.key] = !window[cbr.key]; return;
          }
        }
      }
      if (self._cornerMidRects) {
        for (var cmi = 0; cmi < self._cornerMidRects.length; cmi++) {
          var cmr = self._cornerMidRects[cmi];
          if (pos.x >= cmr.x && pos.x <= cmr.x + cmr.w && pos.y >= cmr.y && pos.y <= cmr.y + cmr.h) {
            if (window.Sound && Sound.uiToggle) Sound.uiToggle(!window[cmr.key]);
            window[cmr.key] = !window[cmr.key]; return;
          }
        }
      }
      if (self._cornerLeftRects) {
        for (var cli = 0; cli < self._cornerLeftRects.length; cli++) {
          var cr = self._cornerLeftRects[cli];
          if (pos.x >= cr.x && pos.x <= cr.x + cr.w && pos.y >= cr.y && pos.y <= cr.y + cr.h) {
            if (window.Sound && Sound.uiToggle) Sound.uiToggle(!window[cr.key]);
            window[cr.key] = !window[cr.key];
            return;
          }
        }
      }
      } // end !editorMode corner buttons
      if (self._cornerEditorBtn) {
        var ceb = self._cornerEditorBtn;
        if (pos.x >= ceb.x && pos.x <= ceb.x + ceb.w && pos.y >= ceb.y && pos.y <= ceb.y + ceb.h) {
          self.toggleEditor(); return;
        }
      }
      if (self._cornerAimBtn) {
        var cab = self._cornerAimBtn;
        if (pos.x >= cab.x && pos.x <= cab.x + cab.w && pos.y >= cab.y && pos.y <= cab.y + cab.h) {
          if (window.Sound && Sound.uiToggle) Sound.uiToggle(self._aimMode !== 'pull');
          self._aimMode = self._aimMode === 'pull' ? 'push' : 'pull';
          return;
        }
      }

      // ── HUD clear buttons (work at all times) ──────────────────────────────
      if (self._hudClearBtns) {
        for (var hci=0;hci<self._hudClearBtns.length;hci++) {
          var hcb=self._hudClearBtns[hci];
          if (pos.x>=hcb.x&&pos.x<=hcb.x+hcb.w&&pos.y>=hcb.y&&pos.y<=hcb.y+hcb.h) {
            if (hcb.type===0) { self._undoPush && self._undoPush(); self.bricks=[]; }
            else if (hcb.type===1) { self.objects.forEach(function(o){o.dead=true;}); self._chuteQueue=[]; self._chuteActive=[]; }
            else if (hcb.type===2) { self._undoPush && self._undoPush(); self.tubes.tubes=[]; }
            else if (hcb.type===3) { self.splats=[]; }
            if(window.Sound&&Sound.uiTap)Sound.uiTap(0.3); return;
          }
        }
      }
      // ── Editor mode ──────────────────────────────────────────────────────────
      if (self._editorMode) {
        var _vSY = self._editorScrollY || 0;
        var _py  = pos.y - _vSY;  // offset screen tap to match translated canvas
        var _px  = pos.x;
        var inPanel = _py >= self.floorY() - 5;

        // ── Top-bar buttons (screen coords, no scroll offset) ─────────────────
        // DONE
        if (self._editorDoneBtn) {
          var d=self._editorDoneBtn;
          if (_px>=d.x&&_px<=d.x+d.w&&_py>=d.y&&_py<=d.y+d.h) {
            self._editorMode=false; self._editorTubeMode=false;
            window._tubeEditorMode=false; self._editorSelected=null;
            var _dbgBtnDone = document.getElementById('tube-debug-btn'); if (_dbgBtnDone) _dbgBtnDone.style.display='none';
            var _dbgPanelDone = document.getElementById('tube-debug-panel'); if (_dbgPanelDone) _dbgPanelDone.style.display='none';
            self._tubeSelected=null;
            self._editorBrickDeleteMode=false;
            self._editorScrollY=0;
            if(window.Sound&&Sound.uiTap)Sound.uiTap(0.25); return;
          }
        }
        // UNDO
        if (self._editorUndoBtn) {
          var u=self._editorUndoBtn;
          if (_px>=u.x&&_px<=u.x+u.w&&_py>=u.y&&_py<=u.y+u.h) {
            self._btnFlash = { btn: u, col: '#0088ff', t: Date.now() };
            if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2);
            self._undoApply&&self._undoApply(self._undoHistory&&self._undoHistory.pop()); return;
          }
        }
        // REDO
        if (self._editorRedoBtn) {
          var rd=self._editorRedoBtn;
          if (_px>=rd.x&&_px<=rd.x+rd.w&&_py>=rd.y&&_py<=rd.y+rd.h) {
            self._btnFlash = { btn: rd, col: '#0088ff', t: Date.now() };
            if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2);
            self._redoApply&&self._redoApply(self._redoHistory&&self._redoHistory.pop()); return;
          }
        }
        // DEL button — tap deletes selected (brick or tube), long-press toggles persistent delete mode
        if (self._editorDelBtn) {
          var db=self._editorDelBtn;
          if (_px>=db.x&&_px<=db.x+db.w&&_py>=db.y&&_py<=db.y+db.h) {
            if (self._editorBrickDeleteMode) {
              self._editorBrickDeleteMode=false;
              self._tubeDeleteMode=false;
              self._btnFlash = { btn: db, col: '#ff2222', t: Date.now() };
              if(window.Sound&&Sound.uiToggle)Sound.uiToggle(false);
            } else if (self._editorSelected || self._tubeSelected) {
              self._btnFlash = { btn: db, col: '#ff2222', t: Date.now() };
              self._undoPush();
              if (self._editorSelected) {
                var idx2=self.bricks.indexOf(self._editorSelected);
                if (idx2>=0) self.bricks.splice(idx2,1);
                self._editorSelected=null;
              }
              if (self._tubeSelected) {
                self.tubes.remove(self._tubeSelected);
                self._tubeSelected=null;
              }
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.3);
            } else {
              _startLongPress('del', 500, function() {
                self._editorBrickDeleteMode=true;
                self._tubeDeleteMode=true;
                self._btnFlash = { btn: self._editorDelBtn, col: '#ff2222', t: Date.now() };
                if(window.Sound&&Sound.uiToggle)Sound.uiToggle(true);
              });
            }
            return;
          }
        }
        // CLR ALL — long press only
        if (self._editorClearBtn) {
          var ca=self._editorClearBtn;
          if (_px>=ca.x&&_px<=ca.x+ca.w&&_py>=ca.y&&_py<=ca.y+ca.h) {
            _clrPressState = { target:'clrall', startTime:Date.now(), duration:700, col:'#ff4400', btn:ca };
            self._clrPressState = _clrPressState;
            _startClrTone('#ff4400');
            _startLongPress('clrall', 700, function() {
              _playClrConfirm();
              self._undoPush();
              self.bricks=[]; self.tubes.tubes=[]; self.objects=[];
              self._editorSelected=null;
            }); return;
          }
        }
        // Tab buttons
        if (self._editorTabBtns) {
          for (var tbi=0; tbi<self._editorTabBtns.length; tbi++) {
            var tb2=self._editorTabBtns[tbi];
            if (_px>=tb2.x&&_px<=tb2.x+tb2.w&&_py>=tb2.y&&_py<=tb2.y+tb2.h) {
              self._editorActiveTab=tb2.id;
              self._editorTubeMode=(tb2.id==='tubes');
              window._tubeEditorMode=(tb2.id==='tubes');
              self._editorSelected=null;
              // Show/hide tube debug button
              var _dbgBtn = document.getElementById('tube-debug-btn');
              if (tb2.id === 'tubes') {
                if (!_dbgBtn) {
                  _dbgBtn = document.createElement('button');
                  _dbgBtn.id = 'tube-debug-btn';
                  _dbgBtn.textContent = '\uD83D\uDD2C';
                  _dbgBtn.title = 'Tube layer debug';
                  _dbgBtn.style.cssText = [
                    'position:fixed','bottom:' + (self.H * 0.18 + 48) + 'px','left:6px',
                    'z-index:9998','width:36px','height:36px','border-radius:50%',
                    'background:rgba(0,20,40,0.85)','border:1px solid #00ffcc',
                    'color:#00ffcc','font-size:16px','cursor:pointer',
                    'box-shadow:0 0 8px #00ffcc55','padding:0'
                  ].join(';');
                  _dbgBtn.addEventListener('click', function() { window._buildTubeDebugPanel(); });
                  document.body.appendChild(_dbgBtn);
                }
                _dbgBtn.style.display = 'block';
              } else {
                if (_dbgBtn) _dbgBtn.style.display = 'none';
                var _panel = document.getElementById('tube-debug-panel');
                if (_panel) _panel.style.display='none';
              }
              // Clear stale button rects from other tabs
              if (tb2.id==='tubes') {
                self._editorModeBtns=null; self._editorTypeBtns=null;
                self._editorSnapBoxBtns=null; self._editorGridPivRects=null;
              } else {
                self._tubeModeBtns=null; self._tubeBtns=null;
                self._tubeStyleBtns=null; self._tubeLayerBtns=null;
                self._tubeAnchorBtns=null; self._tubeDelBtn=null;
              }
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2); return;
            }
          }
        }
        // Tool mode buttons (bricks only)
        if (!self._editorTubeMode && self._editorModeBtns) {
          for (var mbi=0; mbi<self._editorModeBtns.length; mbi++) {
            var mb2=self._editorModeBtns[mbi];
            if (_px>=mb2.x&&_px<=mb2.x+mb2.w&&_py>=mb2.y&&_py<=mb2.y+mb2.h) {
              self._editorToolMode=mb2.id;
              self._editorSelectMode=(mb2.id!=='build');
              self._editorSelected=null;
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2); return;
            }
          }
        }
        // Sub-type buttons (bricks only)
        if (!self._editorTubeMode && self._editorTypeBtns) {
          for (var ti4=0; ti4<self._editorTypeBtns.length; ti4++) {
            var tb3=self._editorTypeBtns[ti4];
            if (_px>=tb3.x&&_px<=tb3.x+tb3.w&&_py>=tb3.y&&_py<=tb3.y+tb3.h) {
              self._editorBrickType=tb3.type;
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2); return;
            }
          }
        }
        // CLR row buttons — long press only
        if (self._editorClrBtns) {
          for (var cli2=0; cli2<self._editorClrBtns.length; cli2++) {
            var clb=self._editorClrBtns[cli2];
            if (_px>=clb.x&&_px<=clb.x+clb.w&&_py>=clb.y&&_py<=clb.y+clb.h) {
              _clrPressState = { target:'clr'+clb.type, startTime:Date.now(), duration:700, col:clb._col||'#ff6600', btn:clb };
              self._clrPressState = _clrPressState;
              _startClrTone(clb._col||'#ff6600');
              (function(type) {
                _startLongPress('clr'+type, 700, function() {
                  _playClrConfirm();
                  self._undoPush();
                  if (type===0) self.bricks=[];
                  else if (type===1) self.tubes.tubes=[];
                  else if (type===2) self.objects=[];
                  self._editorSelected=null;
                });
              })(clb.type);
              return;
            }
          }
        }
        // Grid pivot (bricks only)
        if (!self._editorTubeMode && self._editorGridPivRects) {
          for (var gpi=0; gpi<self._editorGridPivRects.length; gpi++) {
            var gpr2=self._editorGridPivRects[gpi];
            if (_px>=gpr2.x&&_px<=gpr2.x+gpr2.w&&_py>=gpr2.y&&_py<=gpr2.y+gpr2.h) {
              window._editorGridSnapPivot=gpr2.val;
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.15); return;
            }
          }
        }
        // Snap box buttons (bricks only)
        if (!self._editorTubeMode && self._editorSnapBoxBtns) {
          for (var snbi=0; snbi<self._editorSnapBoxBtns.length; snbi++) {
            var snb=self._editorSnapBoxBtns[snbi];
            if (_px>=snb.x&&_px<=snb.x+snb.w&&_py>=snb.y&&_py<=snb.y+snb.h) {
              if (snb.snapKey==='grid') {
                // Toggle grid visibility
                window._showEditorGrid = !(window._showEditorGrid !== false);
                if(window.Sound&&Sound.uiToggle)Sound.uiToggle(window._showEditorGrid);
              }
              else if (snb.snapKey==='snapGrid') {
                // Short tap = toggle snap, long press = enter grid size
                _startLongPress('snapgrid', 600, function() {
                  var cur = window._snapGridSize || 20;
                  self._neonPrompt('Grid snap size (px):', String(cur), function(r) {
                    if (r !== null && r.trim() !== '') {
                      var v = parseInt(r.trim());
                      if (!isNaN(v) && v > 0) { window._snapGridSize = v; window._snapToGrid = true; }
                    }
                  });
                });
                window._snapToGrid=!window._snapToGrid;
                if(window.Sound&&Sound.uiToggle)Sound.uiToggle(window._snapToGrid);
              }
              else if (snb.snapKey==='rotSnap') {
                // Short tap = cycle, long press = pick from list
                _startLongPress('rotsnap', 600, function() {
                  self._neonPicker('ROTATION SNAP', [
                    {label:'FREE (0°)', value:0},{label:'15°', value:15},{label:'30°', value:30},
                    {label:'45°', value:45},{label:'90°', value:90}
                  ], function(v) {
                    if (v !== null) { self._editorSnapDeg = v; if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2); }
                  });
                });
                var snaps2=[0,15,30,45,90]; var cur2=snaps2.indexOf(self._editorSnapDeg||0);
                self._editorSnapDeg=snaps2[(cur2+1)%snaps2.length];
                if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2);
              }
              else if (snb.snapKey==='lenSnap') {
                _startLongPress('lensnap', 600, function() {
                  var cur = window._editorLenSnap || 10;
                  self._neonPrompt('Length snap (px):', String(cur), function(r) {
                    if (r !== null && r.trim() !== '') {
                      var v = parseFloat(r.trim());
                      if (!isNaN(v) && v > 0) { window._editorLenSnap = v; }
                    }
                  });
                });
                window._editorLenSnap=(window._editorLenSnap||0)>0?0:10;
                if(window.Sound&&Sound.uiToggle)Sound.uiToggle((window._editorLenSnap||0)>0);
              }
              else if (snb.snapKey==='widSnap') {
                _startLongPress('widsnap', 600, function() {
                  var cur = window._editorWidSnap || 5;
                  self._neonPrompt('Width snap (px):', String(cur), function(r) {
                    if (r !== null && r.trim() !== '') {
                      var v = parseFloat(r.trim());
                      if (!isNaN(v) && v > 0) { window._editorWidSnap = v; }
                    }
                  });
                });
                window._editorWidSnap=(window._editorWidSnap||0)>0?0:5;
                if(window.Sound&&Sound.uiToggle)Sound.uiToggle((window._editorWidSnap||0)>0);
              }
              return;
            }
          }
        }
        // Legacy snap btn refs (disabled — null guards below)
        if (self._editorSnapBtn) {
          var rsb=self._editorSnapBtn;
          if (_px>=rsb.x&&_px<=rsb.x+rsb.w&&_py>=rsb.y&&_py<=rsb.y+rsb.h) {
            _startLongPress('rotsnap2', 600, function() {
              self._neonPicker('ROTATION SNAP', [
                {label:'FREE (0°)', value:0},{label:'15°', value:15},{label:'30°', value:30},
                {label:'45°', value:45},{label:'90°', value:90}
              ], function(v) { if (v !== null) self._editorSnapDeg = v; });
            });
            var snaps=[0,15,30,45,90];
            var cur=snaps.indexOf(self._editorSnapDeg||0);
            self._editorSnapDeg=snaps[(cur+1)%snaps.length];
            if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2); return;
          }
        }
        // Row 4 GRID SNAP — long press for grid size + major line freq
        if (!self._editorTubeMode) {
        if (self._editorSnapGridBtn) {
          var sgb=self._editorSnapGridBtn;
          if (_px>=sgb.x&&_px<=sgb.x+sgb.w&&_py>=sgb.y&&_py<=sgb.y+sgb.h) {
            _startLongPress('gridsnap', 600, function() {
              var curSize = window._snapGridSize || 20;
              var curMajor = window._snapGridMajor || 5;
              self._neonPrompt('Grid size (px)\nCurrent: '+curSize+'px', String(curSize), function(r) {
                if (r !== null && r.trim() !== '') {
                  var sz = parseInt(r.trim());
                  if (!isNaN(sz) && sz > 0) { window._snapGridSize = sz; window._snapToGrid = true; }
                  self._neonPrompt('Major line every N cells\nCurrent: every '+curMajor, String(curMajor), function(r2) {
                    if (r2 !== null && r2.trim() !== '') {
                      var mj = parseInt(r2.trim());
                      if (!isNaN(mj) && mj > 0) window._snapGridMajor = mj;
                    }
                    if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2);
                  });
                }
              });
            });
            window._snapToGrid=!window._snapToGrid;
            if(window.Sound&&Sound.uiToggle)Sound.uiToggle(window._snapToGrid); return;
          }
        }
        // MOV / STAT
        if (self._editorMovInlineRect) {
          var mi2=self._editorMovInlineRect;
          if (_px>=mi2.x&&_px<=mi2.x+mi2.w&&_py>=mi2.y&&_py<=mi2.y+mi2.h) {
            if (self._editorSelected) {
              self._editorSelected._movable=!self._editorSelected._movable;
              self._editorMovable=self._editorSelected._movable;
            } else { self._editorMovable=!self._editorMovable; }
            if(window.Sound&&Sound.uiToggle)Sound.uiToggle(self._editorMovable); return;
          }
        }
        // ↔ROT / ⊕ROT
        if (self._editorTransRect) {
          var tr2=self._editorTransRect;
          if (_px>=tr2.x&&_px<=tr2.x+tr2.w&&_py>=tr2.y&&_py<=tr2.y+tr2.h) {
            if (self._editorSelected) {
              self._editorSelected._translateOnRotate=!(self._editorSelected._translateOnRotate!==false);
              self._editorTranslate=self._editorSelected._translateOnRotate;
            } else { self._editorTranslate=!(self._editorTranslate!==false); }
            if(window.Sound&&Sound.uiToggle)Sound.uiToggle(self._editorTranslate); return;
          }
        }
        // Pivot rects
        if (self._editorPivotRects) {
          for (var piv=0; piv<self._editorPivotRects.length; piv++) {
            var pr2=self._editorPivotRects[piv];
            if (pr2.enabled&&_px>=pr2.x&&_px<=pr2.x+pr2.w&&_py>=pr2.y&&_py<=pr2.y+pr2.h) {
              if (self._editorSelected) self._editorSelected._pivot=pr2.val;
              self._editorPivot=pr2.val;
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.15); return;
            }
          }
        }
        // Note button
        if (self._editorNoteBtn&&self._editorSelected) {
          var nb2=self._editorNoteBtn;
          if (_px>=nb2.x&&_px<=nb2.x+nb2.w&&_py>=nb2.y&&_py<=nb2.y+nb2.h) {
            self._editorNotePopup=!self._editorNotePopup;
            if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2); return;
          }
        }
        // Panel headers — toggle collapse (blocked in default mode)
        if (self._editorPanelHeaders) {
          for (var phi=0; phi<self._editorPanelHeaders.length; phi++) {
            var ph=self._editorPanelHeaders[phi];
            if (!ph) continue;
            if (_px>=ph.x&&_px<=ph.x+ph.w&&_py>=ph.y&&_py<=ph.y+ph.h) {
              if (self._editorDefaultMode) {
                // In default mode: reset that section instead of collapsing
                if (ph.key==='transform') self._applyDefaults(['blen','bwid','rot']);
                else if (ph.key==='brickset') self._applyDefaults(['hp','regen','dens']);
                else if (ph.key==='brickphys') self._applyDefaults(['dist','decel','rotspd','rotdec','wbounce','spinDist']);
                self._editorDefaultMode=false;
              } else {
                window['_edCollapse_'+ph.key]=!ph.collapsed;
                if(window.Sound&&Sound.uiTap)Sound.uiTap(0.15);
              }
              return;
            }
          }
        }
        // DEFAULT button
        if (self._editorDefaultBtn) {
          var def=self._editorDefaultBtn;
          if (_px>=def.x&&_px<=def.x+def.w&&_py>=def.y&&_py<=def.y+def.h) {
            self._editorDefaultMode=!self._editorDefaultMode;
            if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2); return;
          }
        }
        // DEFAULT ALL button (only visible in default mode)
        if (self._editorDefaultMode && self._editorDefaultAllBtn) {
          var dab=self._editorDefaultAllBtn;
          if (_px>=dab.x&&_px<=dab.x+dab.w&&_py>=dab.y&&_py<=dab.y+dab.h) {
            self._applyDefaults(['blen','bwid','rot','hp','regen','dens','dist','decel','rotspd','rotdec','wbounce','spinDist']);
            self._editorDefaultMode=false; return;
          }
        }
        // DEFAULT mode: tap individual VAL to reset just that slider
        if (self._editorDefaultMode) {
          var _defKeys=['blen','bwid','rot','hp','regen','dens','dist','decel','rotspd','rotdec','wbounce','spinDist'];
          for (var dki=0; dki<_defKeys.length; dki++) {
            var dksl=self._editorSliders&&self._editorSliders[_defKeys[dki]];
            if (!dksl||!dksl.valX) continue;
            if (_px>=dksl.valX&&_px<=dksl.valX+dksl.valW&&_py>=dksl.valY&&_py<=dksl.valY+dksl.valH) {
              self._applyDefaults([_defKeys[dki]]);
              return;
            }
          }
        }
        // LOAD/SAVE preset
        if (self._editorLoadPresetBtn) {
          var lp=self._editorLoadPresetBtn;
          if (_px>=lp.x&&_px<=lp.x+lp.w&&_py>=lp.y&&_py<=lp.y+lp.h) {
            // Load preset list from localStorage
            var savedPresets = {};
            try { savedPresets = JSON.parse(localStorage.getItem('_pb_brick_presets')||'{}'); } catch(e){}
            var names = Object.keys(savedPresets);
            if (names.length === 0) {
              self._neonAlert('No saved presets yet.\nUse SAVE to save current settings as a preset.');
            } else {
              var list = names.map(function(n,i){return (i+1)+'. '+n;}).join('\n');
              self._neonPresetLoad(savedPresets, names, function(picked) {
                if (picked && savedPresets[picked]) {
                  var p = savedPresets[picked];
                  window.BrickDefaults = window.BrickDefaults || {};
                  var bd = window.BrickDefaults;
                  if (p.rectW    !== undefined) bd.rectW    = p.rectW;
                  if (p.rectH    !== undefined) bd.rectH    = p.rectH;
                  if (p.rectHP   !== undefined) bd.rectHP   = p.rectHP;
                  if (p.density  !== undefined) bd.density  = p.density;
                  if (p.maxTravel!== undefined) bd.maxTravel= p.maxTravel;
                  if (p.decel    !== undefined) bd.decel    = p.decel;
                  if (p.rotSpeed !== undefined) bd.rotSpeed = p.rotSpeed;
                  if (p.rotDecel !== undefined) bd.rotDecel = p.rotDecel;
                  if (p.wallBounce!==undefined) bd.wallBounce=p.wallBounce;
                  if (p.spinDist !== undefined) bd.spinDist = p.spinDist;
                  self._editorCurrentPreset = picked;
                  if(window.Sound&&Sound.uiTap)Sound.uiTap(0.3);
                }
              });
            }
            return;
          }
        }
        if (self._editorSavePresetBtn) {
          var sp2=self._editorSavePresetBtn;
          if (_px>=sp2.x&&_px<=sp2.x+sp2.w&&_py>=sp2.y&&_py<=sp2.y+sp2.h) {
            var defName = self._editorCurrentPreset && self._editorCurrentPreset !== '— none —' ? self._editorCurrentPreset : '';
            self._neonPrompt('Save preset as:', defName, function(pname) {
            if (pname !== null && pname.trim() !== '') {
              var bd2 = window.BrickDefaults || {};
              var savedPresets2 = {};
              try { savedPresets2 = JSON.parse(localStorage.getItem('_pb_brick_presets')||'{}'); } catch(e){}
              savedPresets2[pname.trim()] = {
                rectW:     bd2.rectW     || 70,
                rectH:     bd2.rectH     || 22,
                rectHP:    bd2.rectHP    || 100,
                density:   bd2.density   || 1.0,
                maxTravel: bd2.maxTravel || 60,
                decel:     bd2.decel     || 0.88,
                rotSpeed:  bd2.rotSpeed  || 0.30,
                rotDecel:  bd2.rotDecel  || 0.88,
                wallBounce:bd2.wallBounce|| 0.45,
                spinDist:  bd2.spinDist  || 0.5,
              };
              localStorage.setItem('_pb_brick_presets', JSON.stringify(savedPresets2));
              self._editorCurrentPreset = pname.trim();
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.3);
            }
            });
            return;
          }
        }
        // ∞ HP / ✕ REGEN
        if (self._editorInfHPBtn) {
          var ih=self._editorInfHPBtn;
          if (_px>=ih.x&&_px<=ih.x+ih.w&&_py>=ih.y&&_py<=ih.y+ih.h) {
            if (self._editorSelected) self._editorSelected._invincible=!self._editorSelected._invincible;
            if(window.Sound&&Sound.uiToggle)Sound.uiToggle(false); return;
          }
        }
        if (self._editorNoRegenBtn) {
          var nr2=self._editorNoRegenBtn;
          if (_px>=nr2.x&&_px<=nr2.x+nr2.w&&_py>=nr2.y&&_py<=nr2.y+nr2.h) {
            if (self._editorSelected) self._editorSelected._noRegen=!self._editorSelected._noRegen;
            if(window.Sound&&Sound.uiToggle)Sound.uiToggle(false); return;
          }
        }
        } // end !editorTubeMode guard for brick-only panel handlers
        // Tube mode buttons
        if (self._editorTubeMode && self._tubeModeBtns) {
          for (var tmbI2=0; tmbI2<self._tubeModeBtns.length; tmbI2++) {
            var tmb2=self._tubeModeBtns[tmbI2];
            if (_px>=tmb2.x-4&&_px<=tmb2.x+tmb2.w+4&&_py>=tmb2.y-6&&_py<=tmb2.y+tmb2.h+6) {
              self._tubeToolMode=tmb2.id;
              self._tubeSelectMode=(tmb2.id!=='build');
              self._tubeSelected=null; self._tubeRotateState=null; self._tubeLengthState=null;
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2); return;
            }
          }
        }
        // Tube type buttons (STR/90°/45° etc)
        if (self._editorTubeMode && self._tubeBtns) {
          for (var ti5=0; ti5<self._tubeBtns.length; ti5++) {
            var tb5=self._tubeBtns[ti5];
            if (_px>=tb5.x-2&&_px<=tb5.x+tb5.w+2&&_py>=tb5.y-6&&_py<=tb5.y+tb5.h+6) {
              self._tubeType=tb5.val;
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2); return;
            }
          }
        }
        // BBox toggle button
        // Tube style buttons
        if (self._editorTubeMode && self._tubeStyleBtns) {
          for (var si5=0; si5<self._tubeStyleBtns.length; si5++) {
            var sb5=self._tubeStyleBtns[si5];
            if (_px>=sb5.x&&_px<=sb5.x+sb5.w&&_py>=sb5.y-4&&_py<=sb5.y+sb5.h+4) {
              self._tubeStyle=sb5.val;
              if(self._tubeSelected)self._tubeSelected.style=sb5.val;
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2); return;
            }
          }
        }
        // Tube layer buttons
        if (self._editorTubeMode && self._tubeLayerBtns) {
          for (var li5=0; li5<self._tubeLayerBtns.length; li5++) {
            var lb5=self._tubeLayerBtns[li5];
            if (_px>=lb5.x&&_px<=lb5.x+lb5.w&&_py>=lb5.y-4&&_py<=lb5.y+lb5.h+4) {
              self._tubeLayer=lb5.val;
              if(self._tubeSelected)self._tubeSelected.layer=lb5.val;
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2); return;
            }
          }
        }
        // Tube anchor buttons
        if (self._editorTubeMode && self._tubeAnchorBtns) {
          for (var ai5=0; ai5<self._tubeAnchorBtns.length; ai5++) {
            var ab5=self._tubeAnchorBtns[ai5];
            if (_px>=ab5.x&&_px<=ab5.x+ab5.w&&_py>=ab5.y-4&&_py<=ab5.y+ab5.h+4) {
              self._tubeAnchor=ab5.val;
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.15); return;
            }
          }
        }
        // Tube DEL button
        if (self._editorTubeMode && self._tubeDelBtn) {
          var tdb2=self._tubeDelBtn;
          if (_px>=tdb2.x&&_px<=tdb2.x+tdb2.w&&_py>=tdb2.y-4&&_py<=tdb2.y+tdb2.h+4) {
            self._tubeDeleteMode=!self._tubeDeleteMode;
            if(window.Sound&&Sound.uiToggle)Sound.uiToggle(self._tubeDeleteMode); return;
          }
        }
        // Tube sliders
        if (self._editorTubeMode) {
          var tubeSliders2 = [
            { sl:self._tubeSliderLen, cb:function(v){self._tubeLength=v;if(self._tubeSelected){self._tubeSelected.length=v;self._tubeSelected.rebuild();}} },
            { sl:self._tubeSliderSpd, cb:function(v){self._tubeSpeedMod=v;if(self._tubeSelected)self._tubeSelected.speedMod=v;} },
            { sl:self._tubeSliderRot, cb:function(v){if(self._tubeSelected){self._tubeSelected.rotation=v*Math.PI/180;self._tubeSelected.rebuild();}} },
          ];
          for (var tsi3=0; tsi3<tubeSliders2.length; tsi3++) {
            var tsl3=tubeSliders2[tsi3];
            if (!tsl3.sl) continue;
            if (_px>=tsl3.sl.trackX-16&&_px<=tsl3.sl.trackX+tsl3.sl.trackW+16&&
                _py>=tsl3.sl.y-8&&_py<=tsl3.sl.y+tsl3.sl.h+8) {
              var tt5=Math.max(0,Math.min(1,(_px-tsl3.sl.trackX)/tsl3.sl.trackW));
              tsl3.cb(tsl3.sl.min+tt5*(tsl3.sl.max-tsl3.sl.min));
              self._draggingTubeSlider=true; self._dragTubeSliderCb=tsl3.cb; self._dragTubeSliderDef=tsl3.sl;
              if(window.Sound&&Sound.uiSlider)Sound.uiSlider(); return;
            }
          }
        }
        // ── Sliders ────────────────────────────────────────────────────────────
        var sliderDefs = [
          { key:'blen',    apply:function(v){if(self._editorSelected){self._editorSelected.w=v;}window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.rectW=v;} },
          { key:'bwid',    apply:function(v){if(self._editorSelected){self._editorSelected.h=v;}window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.rectH=v;} },
          { key:'rot',     apply:function(v){if(self._editorSelected)self._editorSelected._rotation=v*Math.PI/180;} },
          { key:'hp',      apply:function(v){if(self._editorSelected){self._editorSelected.maxHealth=v;self._editorSelected.health=v;}window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.rectHP=v;} },
          { key:'regen',   apply:function(v){if(self._editorSelected)self._editorSelected.regenAfter=v;} },
          { key:'dens',    apply:function(v){if(self._editorSelected)self._editorSelected._density=v;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.density=v;} },
          { key:'dist',    apply:function(v){if(self._editorSelected)self._editorSelected._maxTravel=v;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.maxTravel=v;} },
          { key:'decel',   apply:function(v){var dv=1-v;if(self._editorSelected)self._editorSelected._decel=dv;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.decel=dv;} },
          { key:'rotspd',  apply:function(v){if(self._editorSelected)self._editorSelected._rotSpeed=v;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.rotSpeed=v;} },
          { key:'rotdec',  apply:function(v){var dv=1-v;if(self._editorSelected)self._editorSelected._rotDecel=dv;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.rotDecel=dv;} },
          { key:'wbounce', apply:function(v){if(self._editorSelected)self._editorSelected._wallBounce=v;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.wallBounce=v;} },
          { key:'spinDist',apply:function(v){if(self._editorSelected)self._editorSelected._spinDist=v;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.spinDist=v;} },
        ];
        // ── VAL window tap-to-type ────────────────────────────────────────────
        var _sliderDefsForVal = [
          { key:'blen',  min:5,    max:900,   label:'Length (px)',      fmt:function(v){return Math.round(v);},    parse:function(s){return parseFloat(s);} },
          { key:'bwid',  min:2,    max:200,   label:'Width (px)',       fmt:function(v){return Math.round(v);},    parse:function(s){return parseFloat(s);} },
          { key:'rot',   min:-180, max:180,   label:'Rotation (°)',     fmt:function(v){return Math.round(v);},    parse:function(s){return parseFloat(s);} },
          { key:'hp',    min:10,   max:400,   label:'HP (10-400)',      fmt:function(v){return Math.round(v);},    parse:function(s){return parseFloat(s);} },
          { key:'regen', min:200,  max:10000, label:'Regen ms (200-10000)', fmt:function(v){return Math.round(v);}, parse:function(s){return parseFloat(s);} },
          { key:'dens',  min:0.5,  max:5.0,   label:'Density (0.5-5)', fmt:function(v){return v.toFixed(1);},    parse:function(s){return parseFloat(s);} },
          { key:'dist',  min:0,    max:900,   label:'Distance (px)',    fmt:function(v){return Math.round(v);},    parse:function(s){return parseFloat(s);} },
          { key:'decel', min:0.01, max:0.5,   label:'Decel (0.01-0.5)',fmt:function(v){return v.toFixed(2);},    parse:function(s){return parseFloat(s);} },
          { key:'rotspd',min:0,    max:1.0,   label:'Spin (0-1)',       fmt:function(v){return v.toFixed(2);},    parse:function(s){return parseFloat(s);} },
          { key:'rotdec',min:0.05, max:0.95,  label:'Spin decel (0.05-0.95)', fmt:function(v){return v.toFixed(2);}, parse:function(s){return parseFloat(s);} },
          { key:'wbounce',min:0,   max:1.0,   label:'Bounce (0-1)',     fmt:function(v){return v.toFixed(2);},    parse:function(s){return parseFloat(s);} },
          { key:'spinDist',min:0,  max:1.0,   label:'Spin/Dist (0-1)', fmt:function(v){return Math.round(v*100)+'%';}, parse:function(s){return parseFloat(s.replace('%',''))/100;} },
        ];
        for (var vdi=0; vdi<_sliderDefsForVal.length; vdi++) {
          var vd=_sliderDefsForVal[vdi];
          var vsl=self._editorSliders&&self._editorSliders[vd.key];
          if (!vsl || !vsl.valX) continue;
          if (_px>=vsl.valX&&_px<=vsl.valX+vsl.valW&&_py>=vsl.valY&&_py<=vsl.valY+vsl.valH) {
            // Get current value
            var sb_v = self._editorSelected;
            var bd_v = window.BrickDefaults||{};
            var curVals = {
              blen: sb_v?(sb_v.w||70):(bd_v.rectW||70),
              bwid: sb_v?(sb_v.h||22):(bd_v.rectH||22),
              rot:  sb_v?((sb_v._rotation||0)*180/Math.PI):0,
              hp:   sb_v?(sb_v.maxHealth||100):(bd_v.rectHP||100),
              regen:sb_v?(sb_v.regenAfter||2000):(bd_v.rectRegen||2000),
              dens: sb_v?(sb_v._density||1.0):(bd_v.density||1.0),
              dist: sb_v?(sb_v._maxTravel||60):(bd_v.maxTravel||60),
              decel:sb_v?(1-(sb_v._decel||0.88)):(1-(bd_v.decel||0.88)),
              rotspd:sb_v?(sb_v._rotSpeed||0.3):(bd_v.rotSpeed||0.3),
              rotdec:sb_v?(1-(sb_v._rotDecel||0.88)):(1-(bd_v.rotDecel||0.88)),
              wbounce:sb_v?(sb_v._wallBounce||0.45):(bd_v.wallBounce||0.45),
              spinDist:sb_v?(sb_v._spinDist||0.5):(bd_v.spinDist||0.5),
            };
            var curVal = curVals[vd.key];
            var _vd = vd, _curVal = curVal;
            (function(vd2, curVal2) {
              self._neonPrompt(vd2.label + '  [' + vd2.min + ' - ' + vd2.max + ']', vd2.fmt(curVal2), function(result) {
                if (result !== null && result.trim() !== '') {
                  var parsed = vd2.parse(result.trim());
                  if (!isNaN(parsed)) {
                    parsed = Math.max(vd2.min, Math.min(vd2.max, parsed));
                    var applyFns = {
                      blen:    function(v){if(self._editorSelected){self._editorSelected.w=v;}window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.rectW=v;},
                      bwid:    function(v){if(self._editorSelected){self._editorSelected.h=v;}window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.rectH=v;},
                      rot:     function(v){if(self._editorSelected)self._editorSelected._rotation=v*Math.PI/180;},
                      hp:      function(v){if(self._editorSelected){self._editorSelected.maxHealth=v;self._editorSelected.health=v;}window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.rectHP=v;},
                      regen:   function(v){if(self._editorSelected)self._editorSelected.regenAfter=v;},
                      dens:    function(v){if(self._editorSelected)self._editorSelected._density=v;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.density=v;},
                      dist:    function(v){if(self._editorSelected)self._editorSelected._maxTravel=v;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.maxTravel=v;},
                      decel:   function(v){var dv=1-v;if(self._editorSelected)self._editorSelected._decel=dv;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.decel=dv;},
                      rotspd:  function(v){if(self._editorSelected)self._editorSelected._rotSpeed=v;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.rotSpeed=v;},
                      rotdec:  function(v){var dv=1-v;if(self._editorSelected)self._editorSelected._rotDecel=dv;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.rotDecel=dv;},
                      wbounce: function(v){if(self._editorSelected)self._editorSelected._wallBounce=v;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.wallBounce=v;},
                      spinDist:function(v){if(self._editorSelected)self._editorSelected._spinDist=v;window.BrickDefaults=window.BrickDefaults||{};window.BrickDefaults.spinDist=v;},
                    };
                    if (applyFns[vd2.key]) applyFns[vd2.key](parsed);
                    if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2);
                  }
                }
              });
            })(_vd, _curVal);
            return;
          }
        }

        if (!self._editorTubeMode) {
        for (var sdi=0; sdi<sliderDefs.length; sdi++) {
          var sd2=sliderDefs[sdi];
          var sl2=self._editorSliders&&self._editorSliders[sd2.key];
          if (!sl2) continue;
          if (_px>=sl2.trackX-10&&_px<=sl2.trackX+sl2.trackW+10&&_py>=sl2.y-8&&_py<=sl2.y+sl2.h+8) {
            var t2=Math.max(0,Math.min(1,(_px-sl2.trackX)/sl2.trackW));
            var v2=sl2.min+t2*(sl2.max-sl2.min);
            sd2.apply(v2);
            self._editorDraggingSlider={key:sd2.key,apply:sd2.apply,sl:sl2};
            if(window.Sound&&Sound.uiSlider)Sound.uiSlider();
            return;
          }
        }
        } // end !editorTubeMode guard for brick sliders
        // Tube sliders
        var tubeSliders2 = [
          { sl:self._tubeSliderLen, cb:function(v){self._tubeLength=v;if(self._tubeSelected){self._tubeSelected.length=v;self._tubeSelected.rebuild();}} },
          { sl:self._tubeSliderSpd, cb:function(v){self._tubeSpeedMod=v;if(self._tubeSelected)self._tubeSelected.speedMod=v;} },
          { sl:self._tubeSliderRot, cb:function(v){if(self._tubeSelected){self._tubeSelected.rotation=v*Math.PI/180;self._tubeSelected.rebuild();}} },
        ];
        for (var tsi2=0; tsi2<tubeSliders2.length; tsi2++) {
          var tsl2=tubeSliders2[tsi2];
          if (!tsl2.sl) continue;
          if (_px>=tsl2.sl.trackX-16&&_px<=tsl2.sl.trackX+tsl2.sl.trackW+16&&
              _py>=tsl2.sl.y-8&&_py<=tsl2.sl.y+tsl2.sl.h+8) {
            var tt2=Math.max(0,Math.min(1,(_px-tsl2.sl.trackX)/tsl2.sl.trackW));
            tsl2.cb(tsl2.sl.min+tt2*(tsl2.sl.max-tsl2.sl.min));
            self._draggingTubeSlider=true; self._dragTubeSliderIdx=tsi2;
            if(window.Sound&&Sound.uiSlider)Sound.uiSlider(); return;
          }
        }
        // Note popup
        if (self._editorNotePopup&&self._editorSelected) {
          var sb3=self._editorSelected;
          var handled=self._handleNotePopupTap&&self._handleNotePopupTap(_px,_py,sb3);
          if (handled) return;
        }
        // Brick delete mode tap
        if (self._editorBrickDeleteMode&&!inPanel) {
          for (var bdi=self.bricks.length-1; bdi>=0; bdi--) {
            var br2=self.bricks[bdi];
            if (Math.hypot(_px-br2.x,_py-br2.y)<(br2.w||br2.r||30)+12) {
              self._undoPush(); self.bricks.splice(bdi,1);
              if (self._editorSelected===br2) self._editorSelected=null;
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.3); return;
            }
          }
          // Also delete tubes in delete mode
          var _tubes = self.tubes.tubes;
          for (var tdi=_tubes.length-1; tdi>=0; tdi--) {
            var _dt=_tubes[tdi], _dp=_dt._path;
            if (!_dp) continue;
            for (var dpi=0; dpi<_dp.length; dpi++) {
              if (Math.hypot(_px-_dp[dpi].x,_py-_dp[dpi].y)<_dt.radius+16) {
                self._undoPush(); self.tubes.remove(_dt);
                if (self._tubeSelected===_dt) self._tubeSelected=null;
                if(window.Sound&&Sound.uiTap)Sound.uiTap(0.3); return;
              }
            }
          }
        }
        // Scroll handle — chute strip (right side, full height when editor open)
        var chuteX2 = self.W - 55;
        if (pos.x >= chuteX2) {
          self._editorScrollPending=true; self._editorScrollDragging=false;
          self._editorScrollStart=self._editorScrollY||0;
          self._editorScrollDragY=pos.y; return;
        }
        // World taps (not in panel) — route to tube or brick editor
        if (!inPanel) {
          if (self._editorTubeMode) {
            self._tubeEditorOnDown({x:_px, y:_py});
          } else {
            self._editorOnDown({x:_px, y:_py});
          }
        }
        // Tap landed in panel but hit nothing — start scroll
        if (inPanel) {
          self._editorScrollPending=true; self._editorScrollDragging=false;
          self._editorScrollStart=self._editorScrollY||0;
          self._editorScrollDragY=pos.y;
        }
        return;
      }


      // ── HUD canvas sliders — grab on touch down ────────────────────────────
      if (!self._editorMode) {
        var _hudSliders = [
          { rect: self._sliderRect,      flag: '_draggingSlider' },
          { rect: self._brickSliderRect,  flag: '_draggingBrickSlider' },
          { rect: self._zoneSliderRect,   flag: '_draggingZoneSlider' },
          { rect: self._tubeSliderRect,   flag: '_draggingTubeSlider' },
        ];
        for (var hsi = 0; hsi < _hudSliders.length; hsi++) {
          var hs = _hudSliders[hsi];
          if (!hs.rect) continue;
          if (pos.x >= hs.rect.x - 8 && pos.x <= hs.rect.x + hs.rect.w + 8 &&
              pos.y >= hs.rect.y - 4 && pos.y <= hs.rect.y + hs.rect.h + 4) {
            self[hs.flag] = true;
            return;
          }
        }
      }

      // SAVE/LOAD level taps (outside editor)
      if (!self._editorMode) {
        if (self._hudSaveLevelBtn) {
          var slb=self._hudSaveLevelBtn;
          if (pos.x>=slb.x&&pos.x<=slb.x+slb.w&&pos.y>=slb.y&&pos.y<=slb.y+slb.h) {
            self._saveCustomLevel();
            return;
          }
        }
        if (self._hudLoadLevelBtn) {
          var llb=self._hudLoadLevelBtn;
          if (pos.x>=llb.x&&pos.x<=llb.x+llb.w&&pos.y>=llb.y&&pos.y<=llb.y+llb.h) {
            self._showLoadLevelOverlay();
            if(window.Sound&&Sound.uiTap)Sound.uiTap(0.2);
            return;
          }
        }
      }
      // ── Chute ball buttons — drop balls ────────────────────────────────────
      if (self._chuteButtonRects) {
        for (var cbi2 = 0; cbi2 < self._chuteButtonRects.length; cbi2++) {
          var cbr2 = self._chuteButtonRects[cbi2];
          if (pos.x >= cbr2.x && pos.x <= cbr2.x + cbr2.w &&
              pos.y >= cbr2.y && pos.y <= cbr2.y + cbr2.h) {
            self._btnPressFlash = { type: cbr2.type, frame: self.frame };
            if (window.Sound && Sound.uiTap) Sound.uiTap(0.28);
            self._chuteDropBall(cbr2.type);
            return;
          }
        }
      }
      // ── Chute delete toggle ────────────────────────────────────────────────
      if (self._chuteDeleteRect) {
        var dr = self._chuteDeleteRect;
        if (pos.x >= dr.x && pos.x <= dr.x + dr.w &&
            pos.y >= dr.y && pos.y <= dr.y + dr.h) {
          self._toggleDeleteMode();
          if (window.Sound && Sound.uiToggle) Sound.uiToggle(self._deleteMode);
          return;
        }
      }
      // ── Ball selection: resting balls + balls within sling zone ────────────
      var zoneH2   = self._slingZoneH !== undefined ? self._slingZoneH : 100;
      var zoneTop  = self.floorY() - zoneH2;

      // ── Delete mode: tap a ball to remove it ─────────────────────────────
      if (self._deleteMode) {
        if (self._tryDeleteBall(_worldPos.x, _worldPos.y)) return;
      }

      // ── Sticky ball flick — tap/drag a wall-stuck sticky to pop it off ──────
      var FLICK_SPEED = 7;  // always same speed
      for (var si = 0; si < self.objects.length; si++) {
        var sobj = self.objects[si];
        if (!sobj || sobj.dead || sobj.exploded) continue;
        if (sobj.type !== BALL_TYPES.STICKY) continue;
        if (sobj.stuckTo !== '_wall_') continue;
        var sdx = _worldPos.x - sobj.x, sdy = _worldPos.y - sobj.y;
        if (Math.hypot(sdx, sdy) < sobj.r * 2.8) {
          // Start a pending sticky flick — wait for finger lift
          self._pendingStickyFlick = {
            obj: sobj,
            touchX: _worldPos.x, touchY: _worldPos.y,
          };
          return;
        }
      }

      var best = null, bestDist = 9999;
      for (var i = 0; i < self.objects.length; i++) {
        var obj = self.objects[i];
        if (obj.dead || obj.exploded) continue;
        if (obj.stuckTo && obj.stuckTo !== '_wall_') continue;
        if (obj.stuckTo === '_wall_') continue;
        var inZone = obj.y >= zoneTop - obj.r;
        var hardCap = self.floorY() - (self._slingZoneH || 100) - 60;
        if (obj.inFlight && (!inZone || obj.y < hardCap)) continue;
        var dx = _worldPos.x - obj.x, dy = _worldPos.y - obj.y;
        var hit = false;
        if (self._aimMode === 'push') {
          hit = Math.hypot(dx, dy) < obj.r * 3.5;
        } else {
          hit = Math.abs(dx) < obj.r * 2.8 && dy >= -obj.r;
        }
        if (hit) {
          var d2 = Math.hypot(dx, dy);
          if (d2 < bestDist) { bestDist = d2; best = obj; }
        }
      }
      if (best) {
        var onFloor = !best.inFlight && best.y + best.r >= self.floorY() - 4;
        if (onFloor) {
          // Floor ball: begin as a "pending" interaction.
          // If finger moves > 8px it becomes a sling drag.
          // If finger lifts without moving (pure tap), it pops.
          self._pendingFloorBall = { obj: best, touchX: pos.x, touchY: pos.y, zoneTop: zoneTop };
          best.vx = 0; best.vy = 0; best.pinned = true;
          self.sling = { obj: best, anchorX: best.x, anchorY: best.y,
                         startX: _worldPos.x, startY: _worldPos.y, pullX: _worldPos.x, pullY: _worldPos.y };
        } else {
          best.vx = 0; best.vy = 0; best.pinned = true;
          self.sling = { obj: best, anchorX: best.x, anchorY: best.y,
                         startX: _worldPos.x, startY: _worldPos.y, pullX: _worldPos.x, pullY: _worldPos.y };
        }
      }
    }

    function onMove(e) {
      e.preventDefault();
      var pos = getPos(e);
      // Track sticky flick finger position
      if (self._pendingStickyFlick) {
        self._pendingStickyFlick._lastX = pos.x;
        self._pendingStickyFlick._lastY = pos.y;
      }
      // Tube slider drag (old path via _tubeDragSlider)
      if (self._tubeDragSlider) {
        var tsl2 = self._tubeDragSlider.sl;
        var t3 = Math.max(0, Math.min(1, (pos.x - tsl2.trackX) / tsl2.trackW));
        var v3 = tsl2.min + t3 * (tsl2.max - tsl2.min);
        self._tubeDragSlider.cb(v3);
        return;
      }
      // Tube slider drag (new path via _draggingTubeSlider)
      if (self._draggingTubeSlider && self._dragTubeSliderDef && self._dragTubeSliderCb) {
        var tsl4 = self._dragTubeSliderDef;
        var t4 = Math.max(0, Math.min(1, (pos.x - tsl4.trackX) / tsl4.trackW));
        self._dragTubeSliderCb(tsl4.min + t4 * (tsl4.max - tsl4.min));
        if(window.Sound&&Sound.uiSlider)Sound.uiSlider();
        return;
      }
      // Tube piece drag
      // Two-finger tube manipulation
      // Two-finger: tube pinch (handled below via _tubeHandleTouch)
      // Two-finger pinch on play area = zoom in/out
      if (e.touches && e.touches.length >= 2 && !self._editorMode) {
        var pt0 = e.touches[0], pt1 = e.touches[1];
        var pinchDist = Math.hypot(pt1.clientX - pt0.clientX, pt1.clientY - pt0.clientY);
        if (self._playPinchStartDist) {
          var zoomDelta = pinchDist / self._playPinchStartDist;
          var newZoom = Math.max(0.25, Math.min(1.0, self._playPinchStartZoom * zoomDelta));
          self._viewZoom = newZoom;
        }
        return;
      }
      if (self._tubeDragging && e.touches && e.touches.length >= 2 && !self._editorMode) {
        // handled below
      }
      // Two-finger tube pinch — must check BEFORE single-finger drag handler
      if (self._editorMode && self._editorTubeMode && self._tubeDragging && e.touches && e.touches.length >= 2) {
        var _td2f = self._tubeDragging;
        if (_td2f.connectedA || _td2f.connectedB) {
          // Connected tube with two fingers → upgrade to group drag/rotate
          var _grp2f = self.tubes.getConnectedGroup(_td2f);
          for (var _ghi3 = 0; _ghi3 < _grp2f.length; _ghi3++) _grp2f[_ghi3]._groupHighlight = true;
          var _gcx2f = _grp2f.reduce(function(s,t){return s+t.x;},0)/_grp2f.length;
          var _gcy2f = _grp2f.reduce(function(s,t){return s+t.y;},0)/_grp2f.length;
          self._tubeGroupDrag = {
            group: _grp2f,
            startX: pos.x, startY: pos.y,
            origins: _grp2f.map(function(t) { return { x: t.x, y: t.y }; }),
            cx: _gcx2f, cy: _gcy2f, snapCandidate: null,
          };
          self._tubeGroupPinchStart = null;  // will init on next move frame
          self._tubeDragging = null;
          self._tubePivotState = null;
          self._tubePinchStart = null;
        } else {
          self._tubeHandleTouch(e.touches);
        }
        return;
      }
      if (self._tubeRotateState || self._tubeLengthState) {
        var _tSY3 = self._editorScrollY || 0;
        var _twy3 = pos.y - _tSY3;
        if (self._tubeRotateState) {
          var trs = self._tubeRotateState;
          var curAngleT = Math.atan2(_twy3 - trs.tube.y, pos.x - trs.tube.x);
          trs.tube.rotation = trs.origRot + (curAngleT - trs.startAngle);
          trs.tube.rebuild();
          return;
        }
        if (self._tubeLengthState) {
          var tls = self._tubeLengthState;
          var delta = Math.hypot(pos.x - tls.startX, _twy3 - tls.startY);
          var sign = ((pos.x - tls.startX) * Math.cos(tls.tube.rotation) +
                      (_twy3 - tls.startY) * Math.sin(tls.tube.rotation)) > 0 ? 1 : -1;
          tls.tube.length = Math.max(20, Math.min(600, tls.origLen + sign * delta));
          tls.tube.rebuild();
          return;
        }
      }
      // Group drag: move all connected tubes together (one or two fingers)
      if (self._tubeGroupDrag) {
        var gd = self._tubeGroupDrag;
        // Two-finger: rotate + translate whole group
        if (e && e.touches && e.touches.length >= 2) {
          var rect2 = self.canvas.getBoundingClientRect();
          var _gscX = self.canvas.width / rect2.width, _gscY = self.canvas.height / rect2.height;
          var gf0 = { x: (e.touches[0].clientX - rect2.left) * _gscX, y: (e.touches[0].clientY - rect2.top) * _gscY };
          var gf1 = { x: (e.touches[1].clientX - rect2.left) * _gscX, y: (e.touches[1].clientY - rect2.top) * _gscY };
          if (!self._tubeGroupPinchStart) {
            self._tubeGroupPinchStart = {
              angle: Math.atan2(gf1.y - gf0.y, gf1.x - gf0.x),
              mx: (gf0.x + gf1.x) * 0.5, my: (gf0.y + gf1.y) * 0.5,
            };
          } else {
            var gps = self._tubeGroupPinchStart;
            var newAngle = Math.atan2(gf1.y - gf0.y, gf1.x - gf0.x);
            var dAngle = newAngle - gps.angle;
            var newMx = (gf0.x + gf1.x) * 0.5, newMy = (gf0.y + gf1.y) * 0.5;
            var dMx = newMx - gps.mx, dMy = newMy - gps.my;
            var cosA = Math.cos(dAngle), sinA = Math.sin(dAngle);
            // Pivot = current finger midpoint. Rotate each tube around it, then shift by midpoint translation.
            for (var gi2 = 0; gi2 < gd.group.length; gi2++) {
              var t2 = gd.group[gi2];
              var rx = t2.x - gps.mx, ry = t2.y - gps.my;
              t2.x = gps.mx + rx*cosA - ry*sinA + dMx;
              t2.y = gps.my + rx*sinA + ry*cosA + dMy;
              t2.rotation += dAngle;
              t2.rebuild();
            }
            // Advance pivot state for next frame delta
            gps.angle = newAngle;
            gps.mx = newMx; gps.my = newMy;
            gd.hasMoved = true;
            gd.snapCandidate = self.tubes.checkSnapGroup(gd.group);
          }
          return;
        }
        // One-finger: translate only
        self._tubeGroupPinchStart = null;
        gd.hasMoved = true;
        var _gdSY = self._editorScrollY || 0;
        var dx2 = pos.x - gd.startX;
        var dy2 = (pos.y - _gdSY) - gd.startY;
        for (var gi = 0; gi < gd.group.length; gi++) {
          gd.group[gi].x = gd.origins[gi].x + dx2;
          gd.group[gi].y = gd.origins[gi].y + dy2;
          gd.group[gi].rebuild();
        }
        gd.snapCandidate = self.tubes.checkSnapGroup(gd.group);
        return;
      }
      if (self._tubeDragging) {
        var td = self._tubeDragging;
        var conn = td.connectedA || td.connectedB;
        var _tSY = self._editorScrollY || 0;
        var _tWorldY = pos.y - _tSY;
        if (conn && self._tubePivotState) {
          var _connPos = { x: pos.x, y: _tWorldY };
          self.tubes.dragConnected(td, _connPos, self._tubePivotState);
        } else {
          td.x = pos.x - (self._tubeDragOffX || 0);
          td.y = _tWorldY - (self._tubeDragOffY || 0);
          td.rebuild();
          self.tubes.checkSnap(td);
        }
        return;
      }
      if (self._editorMode) {
        // Multi-touch: pinch/rotate bricks (or tubes if tube selected)
        if (e.touches && e.touches.length >= 2) {
          if (self._editorTubeMode && self._tubeDragging) {
            self._tubeHandleTouch(e.touches);
          } else if (!self._editorTubeMode) {
            self._editorHandleTouch(e.touches);
          }
          return;
        }
        self._editorPinchStart = null;
        self._tubePinchStart = null;
        // Universal scroll — promote pending to active after 6px, then scroll
        if (self._editorScrollPending || self._editorScrollDragging) {
          var dragDelta = pos.y - self._editorScrollDragY;
          if (!self._editorScrollDragging && Math.abs(dragDelta) > 6) {
            self._editorScrollDragging = true;
            self._editorScrollPending  = false;
          }
          if (self._editorScrollDragging) {
            var rawScroll = self._editorScrollStart + dragDelta;
            var maxScroll = -(self.H * 0.7);  // scroll up enough to see full editor
            self._editorScrollY = Math.max(maxScroll, Math.min(0, rawScroll));
            return;
          }
        }
        // New slider drag (v15)
        if (self._editorDraggingSlider) {
          var ds = self._editorDraggingSlider;
          var t4 = Math.max(0, Math.min(1, (pos.x - ds.sl.trackX) / ds.sl.trackW));
          var v4 = ds.sl.min + t4 * (ds.sl.max - ds.sl.min);
          ds.apply(v4);
          if (window.Sound && Sound.uiSlider) Sound.uiSlider();
          return;
        }
        var _vSY2 = self._editorScrollY || 0;
        self._editorOnMove({x: pos.x, y: pos.y - _vSY2}); return;
      }
      // If dragging from a floor ball, check if it's a real drag (> 8px = sling, not pop)
      if (self._pendingFloorBall) {
        var pfb = self._pendingFloorBall;
        if (Math.hypot(pos.x - pfb.touchX, pos.y - pfb.touchY) > 8) {
          self._pendingFloorBall = null;  // committed to sling drag
        }
      }
      if (self._draggingTubeSlider && self._tubeSliderRect) {
        var tsr3 = self._tubeSliderRect;
        var tt3 = Math.max(0, Math.min(1, (pos.x - tsr3.x) / tsr3.w));
        window._tubeSpeedMult = 0.01 + tt3 * 1.99;
        return;
      }
      if (self._draggingZoneSlider && self._zoneSliderRect) {
        var zr2 = self._zoneSliderRect;
        var zt2 = Math.max(0, Math.min(1, (pos.x - zr2.x) / zr2.w));
        self._slingZoneH = Math.round(40 + zt2 * 260);
        return;
      }
      if (self._draggingBrickSlider && self._brickSliderRect) {
        var br2 = self._brickSliderRect;
        self.brickSpeedMult = Math.max(0, Math.min(1, (pos.x - br2.x) / br2.w));
        return;
      }
      if (!self._editorBlockSliders && self._draggingSlider && self._sliderRect) {
        var sr = self._sliderRect;
        var t  = Math.max(0, Math.min(1, (pos.x - sr.x) / sr.w));
        self.speedMult = t;
        return;
      }
      if (!self.sling) return;
      var pos = getPos(e);
      self.sling.pullX = pos.x; self.sling.pullY = pos.y;
      var dx = self.sling.anchorX - pos.x, dy = self.sling.anchorY - pos.y;
      var dist = Math.hypot(dx, dy);
      if (dist > SLING_MIN_OFFSET && window.Sound) Sound.stretch(Math.min(dist, SLING_MAX_PULL) / SLING_MAX_PULL);
    }

    // Long press state
    var _lpTimer = null, _lpTarget = null;
    var _clrPressState = null;  // { target, startTime, duration, col, btn } for fill-bar feedback
    self._clrPressState = null; // mirror on self for _drawEditor access
    function _startLongPress(target, delay, cb) {
      _lpTimer = setTimeout(function() {
        cb();
        if (_clrPressState && _clrPressState.target === target) { _clrPressState = null; self._clrPressState = null; }
        _lpTimer = null; _lpTarget = null;
      }, delay || 600);
      _lpTarget = target;
    }
    function _cancelLongPress() {
      if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; _lpTarget = null; }
      _clrPressState = null; self._clrPressState = null;
    }
    // Rising tone during hold — starts quiet/low, grows louder/higher
    var _clrToneNode = null, _clrToneGain = null;
    function _startClrTone(col) {
      var c = window.Sound && Sound.getCtx && Sound.getCtx();
      if (!c) return;
      _stopClrTone();
      var vol = (window.AudioSettings && window.AudioSettings.masterVol) || 1;
      var osc = c.createOscillator(); var gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, c.currentTime);
      osc.frequency.linearRampToValueAtTime(520, c.currentTime + 0.7);
      gain.gain.setValueAtTime(0.0, c.currentTime);
      gain.gain.linearRampToValueAtTime(0.18 * vol, c.currentTime + 0.7);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(); _clrToneNode = osc; _clrToneGain = gain;
    }
    function _stopClrTone() {
      if (_clrToneNode) { try { _clrToneNode.stop(); } catch(e){} _clrToneNode = null; _clrToneGain = null; }
    }
    function _playClrConfirm() {
      _stopClrTone();
      var c = window.Sound && Sound.getCtx && Sound.getCtx();
      if (!c) return;
      var vol = (window.AudioSettings && window.AudioSettings.masterVol) || 1;
      var now = c.currentTime;
      [600, 900, 1200].forEach(function(f, i) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'square'; o.frequency.value = f;
        var t = now + i * 0.04;
        g.gain.setValueAtTime(0.15 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.12);
      });
    }

    function onUp(e) {
      e.preventDefault();
      _cancelLongPress();
      _stopClrTone();
      self._draggingSlider = false;
      self._draggingBrickSlider = false;
      self._editorDraggingSlider = null;
      self._draggingZoneSlider = false;
      self._draggingTubeSlider = false;
      // Release tube drag — apply snap if close enough
      if (self._tubeGroupDrag) {
        var gd2 = self._tubeGroupDrag;
        // Clear group highlight on all tubes
        for (var _ghc = 0; _ghc < gd2.group.length; _ghc++) gd2.group[_ghc]._groupHighlight = false;
        if (gd2.snapCandidate && gd2.snapCandidate.dist < self.tubes.SNAP_DIST) {
          self.tubes.applySnapGroup(gd2.group, gd2.snapCandidate);
          // Weld sound
          if (window.Sound && Sound.getCtx) {
            var sc2 = Sound.getCtx();
            if (sc2) {
              var g2w = sc2.createGain(); g2w.connect(sc2.destination);
              g2w.gain.setValueAtTime(0.18, sc2.currentTime);
              g2w.gain.exponentialRampToValueAtTime(0.001, sc2.currentTime + 0.18);
              var o1w = sc2.createOscillator(); o1w.connect(g2w);
              o1w.type = 'square'; o1w.frequency.setValueAtTime(880, sc2.currentTime);
              o1w.frequency.exponentialRampToValueAtTime(440, sc2.currentTime + 0.06);
              o1w.start(sc2.currentTime); o1w.stop(sc2.currentTime + 0.18);
              var o2w = sc2.createOscillator(); o2w.connect(g2w);
              o2w.type = 'sine'; o2w.frequency.setValueAtTime(1320, sc2.currentTime);
              o2w.frequency.exponentialRampToValueAtTime(660, sc2.currentTime + 0.1);
              o2w.start(sc2.currentTime); o2w.stop(sc2.currentTime + 0.1);
            }
          }
        } else {
          // Clear any lingering highlights
          for (var gc = 0; gc < gd2.group.length; gc++) gd2.group[gc]._snapHighlight = null;
        }
        self._tubeGroupDrag = null;
        self._tubeGroupPinchStart = null;
      }

      if (self._tubeDragging) {
        var snapResult = self.tubes.checkSnap(self._tubeDragging);
        if (snapResult && snapResult.dist < self.tubes.SNAP_DIST) {
          self.tubes.applySnap(self._tubeDragging, snapResult, false);
          // Weld sound — metallic click
          if (window.Sound && Sound.getCtx) {
            var sc = Sound.getCtx();
            if (sc) {
              var g = sc.createGain(); g.connect(sc.destination);
              g.gain.setValueAtTime(0.18, sc.currentTime);
              g.gain.exponentialRampToValueAtTime(0.001, sc.currentTime + 0.18);
              var o1 = sc.createOscillator(); o1.connect(g);
              o1.type = 'square'; o1.frequency.setValueAtTime(880, sc.currentTime);
              o1.frequency.exponentialRampToValueAtTime(440, sc.currentTime + 0.06);
              o1.start(sc.currentTime); o1.stop(sc.currentTime + 0.18);
              var o2 = sc.createOscillator(); o2.connect(g);
              o2.type = 'sine'; o2.frequency.setValueAtTime(1320, sc.currentTime);
              o2.frequency.exponentialRampToValueAtTime(660, sc.currentTime + 0.1);
              o2.start(sc.currentTime); o2.stop(sc.currentTime + 0.1);
            }
          }
        }
        if (self._tubeDragging) self._tubeDragging._groupHighlight = false;
        self._tubeDragging = null;
        self._tubePivotState = null;
        self._tubeRotateState = null;
        self._tubeLengthState = null;
        self._lastPinchAngle = undefined;
        self._tubePinchStart = null;
        self._playPinchStartDist = null;
      }
      self._tubeDragSlider = null;

      // Quick tap on floor ball → pop it up (no drag happened)
      if (self._pendingStickyFlick) {
        var psf = self._pendingStickyFlick;
        self._pendingStickyFlick = null;
        var sball = psf.obj;
        var FLICK_SPD = 7;
        var endX = psf._lastX !== undefined ? psf._lastX : psf.touchX;
        var endY = psf._lastY !== undefined ? psf._lastY : psf.touchY;
        var fdx = endX - psf.touchX;
        var fdy = endY - psf.touchY;
        var fdist = Math.hypot(fdx, fdy);
        sball.stuckTo = null;
        sball.pinned  = false;
        sball.inFlight = true;
        if (fdist > 6) {
          // Directional flick
          sball.vx = (fdx / fdist) * FLICK_SPD;
          sball.vy = (fdy / fdist) * FLICK_SPD;
        } else {
          // Pure tap — random direction, slightly upward bias
          var randAngle = Math.random() * Math.PI * 2;
          sball.vx = Math.cos(randAngle) * FLICK_SPD;
          sball.vy = Math.sin(randAngle) * FLICK_SPD - 2;
        }
        if (window.Sound && Sound.uiTap) Sound.uiTap(0.25);
        return;
      }

      // Quick tap on floor ball → pop it up (no drag happened)
      if (self._pendingFloorBall) {
        var pfb2 = self._pendingFloorBall;
        self._pendingFloorBall = null;
        var bPop = pfb2.obj;
        bPop.pinned  = false;
        self.sling   = null;
        // Calculate pop velocity to reach just below zone line
        var targetY2 = pfb2.zoneTop + 10;
        var dPop     = bPop.y - targetY2;
        var gPop     = 0.4 * (window.Settings ? Settings.gravityMult : 1.0);
        var popVY2   = -Math.sqrt(Math.max(0, 2 * gPop * dPop));
        bPop.vy      = Math.min(popVY2, -2);
        bPop.vx      = 0;
        bPop.inFlight= true;
        if (bPop.type === BALL_TYPES.SQUIGGLY) {
          bPop._sqStartX = bPop.x; bPop._sqStartY = bPop.y;
          bPop._sqTotalDist = 600;
        }
        return;
      }
      if (self._editorMode) {
        self._editorPinchStart = null;
        self._editorScrollDragging = false;
        self._editorScrollPending  = false;
        self._editorScrollStart    = undefined;
        self._tubePinchStart = null;
        self._editorOnUp();
        return;
      }
      if (!self.sling) return;
      var s = self.sling, obj = s.obj;
      var dx, dy, dist;

      if (self._aimMode === 'push') {
        // Push mode: direction = from touch-start toward current finger position
        // Ball stays on ground; fires in the direction you dragged
        dx   = s.pullX - s.startX;
        dy   = s.pullY - s.startY;
        dist = Math.hypot(dx, dy);
        if (dist > SLING_MIN_OFFSET) {
          var bs    = BallSettings[obj.type] || BallSettings.bouncer;
          var power = Math.min(dist, SLING_MAX_PULL) * SLING_POWER * (bs.velocity || 1.0);
          obj.vx = (dx / dist) * power;
          obj.vy = (dy / dist) * power;
          obj.inFlight = true;
          obj._fromChute = false;   // now active — bounces count, splits trigger
          if (obj.type === BALL_TYPES.GRAVITY) { obj.gravActive = true; obj._slungIds = []; }
          if (obj.type === BALL_TYPES.SQUIGGLY) { obj._sqStartX=obj.x; obj._sqStartY=obj.y; obj._sqTotalDist=Math.hypot(obj.vx,obj.vy)*80+400; obj._ghostX=obj.x; obj._ghostY=obj.y; obj._ghostVx=obj.vx; obj._ghostVy=obj.vy; }
          if (window.Sound) Sound.snap(Math.min(dist, SLING_MAX_PULL) / SLING_MAX_PULL);
        }
      } else {
        // Pull mode: classic — vector is from finger to anchor (rubber-band)
        dx   = s.anchorX - s.pullX;
        dy   = s.anchorY - s.pullY;
        dist = Math.hypot(dx, dy);
        if (dist > SLING_MIN_OFFSET) {
          var bs    = BallSettings[obj.type] || BallSettings.bouncer;
          var power = Math.min(dist, SLING_MAX_PULL) * SLING_POWER * (bs.velocity || 1.0);
          obj.vx = (dx / dist) * power;
          obj.vy = (dy / dist) * power;
          obj.inFlight = true;
          obj._fromChute = false;   // now active
          if (obj.type === BALL_TYPES.GRAVITY) { obj.gravActive = true; obj._slungIds = []; }
          if (obj.type === BALL_TYPES.SQUIGGLY) { obj._sqStartX=obj.x; obj._sqStartY=obj.y; obj._sqTotalDist=Math.hypot(obj.vx,obj.vy)*80+400; obj._ghostX=obj.x; obj._ghostY=obj.y; obj._ghostVx=obj.vx; obj._ghostVy=obj.vy; }
          if (window.Sound) Sound.snap(Math.min(dist, SLING_MAX_PULL) / SLING_MAX_PULL);
        }
      }
      obj.pinned = false;
      self.sling = null;
    }

    canvas.addEventListener('mousedown',   onDown);
    canvas.addEventListener('mousemove',   onMove);
    canvas.addEventListener('mouseup',     onUp);
    canvas.addEventListener('mouseleave',  onUp);
    canvas.addEventListener('touchstart',  onDown, { passive: false });
    canvas.addEventListener('touchmove',   onMove, { passive: false });
    canvas.addEventListener('touchend',    onUp,   { passive: false });
    canvas.addEventListener('touchcancel', onUp,   { passive: false });
    canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }

  // ── Main loop ──────────────────────────────────────────────────────────────

  _loop() {
    this._rafId = requestAnimationFrame(this._loop);
    this.frame++;
    var i, j, floorY = this.floorY();
    try {

    window._gameSparks = this.sparks;
    window._gameBrickSpeedMult = this.brickSpeedMult;

    // Gravity wells — only active when gravActive is set (manually slung)
    for (i = 0; i < this.objects.length; i++) {
      var gw = this.objects[i];
      if (gw.type === BALL_TYPES.GRAVITY && gw.gravActive) applyGravityWell(gw, this.objects);
      // When it lands, turn off gravity
      if (gw.type === BALL_TYPES.GRAVITY && gw.gravActive && !gw.inFlight) resetGravityWell(gw);
    }

    // Phase 2: Update interactive objects
    var dt = 16 * this.speedMult;
    for (i = 0; i < this.buttons.length;    i++) this.buttons[i].update();
    for (i = 0; i < this.ports.length;      i++) this.ports[i].update();
    for (i = 0; i < this.turnstiles.length; i++) this.turnstiles[i].update(dt);
    for (i = 0; i < this.spawners.length;   i++) this.spawners[i].update(dt);
    for (i = 0; i < this.bricks.length; i++) {
      this.bricks[i].updateRegen(dt);
      var mbrick = this.bricks[i];
      if (mbrick._movable && (Math.abs(mbrick._vx||0) > 0.05 || Math.abs(mbrick._vy||0) > 0.05 || Math.abs(mbrick._angularV||0) > 0.001)) {
        var decel = mbrick._decel || 0.88;
        var bsm   = this.brickSpeedMult !== undefined ? this.brickSpeedMult : 0.5;
        mbrick.x += (mbrick._vx || 0) * bsm * 2;
        mbrick.y += (mbrick._vy || 0) * bsm * 2;
        var prevRot = mbrick._rotation || 0;
        var da2 = mbrick._angularV || 0;
        mbrick._rotation = prevRot + da2;

        // Pivot rotation physics
        // translateOnRotate=true  → fixed pivot: brick ONLY rotates, pivot point never moves
        // translateOnRotate=false → free: brick translates AND rotates (pivot drifts with brick)
        var pivStr2 = mbrick._pivot || 'CM';
        if (mbrick._translateOnRotate !== false) {
          // ── FIXED PIVOT MODE ─────────────────────────────────────────────
          // Determine pivot offset in brick-local space
          var pivCol = pivStr2.charAt(0) || 'C';
          var pivRow = pivStr2.charAt(1) || 'M';
          var pivOffX = pivCol === 'L' ? -(mbrick.w || 60) / 2
                      : pivCol === 'R' ?  (mbrick.w || 60) / 2 : 0;
          var pivOffY = pivRow === 'T' ? -(mbrick.h || 22) / 2
                      : pivRow === 'B' ?  (mbrick.h || 22) / 2 : 0;
          // Transform pivot offset by current rotation to get world-space pivot
          var cA = Math.cos(prevRot), sA = Math.sin(prevRot);
          var pivWX = mbrick.x + cA * pivOffX - sA * pivOffY;
          var pivWY = mbrick.y + sA * pivOffX + cA * pivOffY;
          // Rotate brick center around world-space pivot
          if (da2 !== 0) {
            var cos2 = Math.cos(da2), sin2 = Math.sin(da2);
            var relX = mbrick.x - pivWX, relY = mbrick.y - pivWY;
            mbrick.x = pivWX + relX * cos2 - relY * sin2;
            mbrick.y = pivWY + relX * sin2 + relY * cos2;
          } else {
            // No rotation this frame — keep pivot anchored by cancelling any drift
            mbrick.x = pivWX + (cA * (-pivOffX) - sA * (-pivOffY));
            mbrick.y = pivWY + (sA * (-pivOffX) + cA * (-pivOffY));
          }
          // In fixed-pivot mode, zero all linear velocity — position is fully controlled by pivot math
          mbrick._vx = 0; mbrick._vy = 0;
        } else {
          // ── FREE ROTATION + TRANSLATION MODE ─────────────────────────────
          mbrick._vx = (mbrick._vx || 0) * decel;
          mbrick._vy = (mbrick._vy || 0) * decel;
        }
        var rotDecel = mbrick._rotDecel !== undefined ? mbrick._rotDecel : decel;
        mbrick._angularV = (mbrick._angularV || 0) * rotDecel;

        // Travel clamp
        if (mbrick._startX !== undefined) {
          var travelMax = mbrick._maxTravel || 60;
          var traveled  = Math.hypot(mbrick.x - mbrick._startX, mbrick.y - mbrick._startY);
          if (traveled > travelMax) {
            var tAngle = Math.atan2(mbrick.y - mbrick._startY, mbrick.x - mbrick._startX);
            mbrick.x = mbrick._startX + Math.cos(tAngle) * travelMax;
            mbrick.y = mbrick._startY + Math.sin(tAngle) * travelMax;
            mbrick._vx = (mbrick._vx || 0) * -0.3;
            mbrick._vy = (mbrick._vy || 0) * -0.3;
          }
        }

        // Screen edge bounce — use rotated AABB extent so long rotated bricks can't clip
        var bWallBounce = mbrick._wallBounce !== undefined ? mbrick._wallBounce : 0.45;
        var bRot2 = mbrick._rotation || 0;
        var bW2 = mbrick.w || (mbrick.r || 10) * 2;
        var bH2 = mbrick.h || (mbrick.r || 10) * 2;
        // Axis-aligned bounding radius of rotated rect
        var bHWall = (Math.abs(Math.cos(bRot2)) * bW2 + Math.abs(Math.sin(bRot2)) * bH2) / 2;
        var bHHall = (Math.abs(Math.sin(bRot2)) * bW2 + Math.abs(Math.cos(bRot2)) * bH2) / 2;
        var bFloor = this.floorY();
        if (mbrick.x - bHWall < 0) {
          mbrick.x = bHWall;
          mbrick._vx = Math.abs(mbrick._vx || 0) * bWallBounce;
          mbrick._angularV = (mbrick._angularV || 0) * -0.55;
        } else if (mbrick.x + bHWall > this.W) {
          mbrick.x = this.W - bHWall;
          mbrick._vx = -Math.abs(mbrick._vx || 0) * bWallBounce;
          mbrick._angularV = (mbrick._angularV || 0) * -0.55;
        }
        if (mbrick.y - bHHall < 0) {
          mbrick.y = bHHall;
          mbrick._vy = Math.abs(mbrick._vy || 0) * bWallBounce;
          mbrick._angularV = (mbrick._angularV || 0) * -0.4;
        } else if (mbrick.y + bHHall > bFloor) {
          mbrick.y = bFloor - bHHall;
          mbrick._vy = -Math.abs(mbrick._vy || 0) * bWallBounce * 0.9;
          mbrick._angularV = (mbrick._angularV || 0) * -0.3;
        }
        // Bounce off chute left wall
        var chuteLeftX = this.W - 46;
        if (mbrick.x + bHWall > chuteLeftX) {
          mbrick.x = chuteLeftX - bHWall;
          mbrick._vx = -Math.abs(mbrick._vx || 0) * bWallBounce;
          mbrick._angularV = (mbrick._angularV || 0) * -0.5;
        }

        // Brick-brick collision — check if this moving brick overlaps any other brick
        var bSpeed = Math.hypot(mbrick._vx || 0, mbrick._vy || 0);
        if (bSpeed > 0.15) {
          for (var bi2 = 0; bi2 < this.bricks.length; bi2++) {
            if (bi2 === i) continue;
            var other = this.bricks[bi2];
            if (!other.isAlive()) continue;
            // AABB overlap — use actual half-extents
            var ox = Math.abs(mbrick.x - other.x);
            var oy = Math.abs(mbrick.y - other.y);
            var hw1 = (mbrick.w || mbrick.r * 2) / 2 + 4;
            var hh1 = (mbrick.h || mbrick.r * 2) / 2 + 4;
            var hw2 = (other.w  || other.r  * 2) / 2;
            var hh2 = (other.h  || other.r  * 2) / 2;
            if (ox < hw1 + hw2 && oy < hh1 + hh2) {
              var coolK = '_bb_' + other.id;
              if (!mbrick[coolK] || mbrick[coolK] <= 0) {
                // Brick-on-brick damage — much less than ball damage
                var bbDmg = Math.round(bSpeed * 3);
                other.takeDamage(bbDmg);
                if (mbrick.isAlive()) mbrick.takeDamage(Math.round(bbDmg * 0.5));
                mbrick[coolK] = 30;
                if (window.Sound) Sound.brickOnBrick(bSpeed);
              }
            }
            if (mbrick[coolK] > 0) mbrick[coolK]--;
          }
        }
      }
    }

    // Chute feed
    this._updateChute(dt);
    this._updateSplats(dt);

    // Physics step
    var sm = this.speedMult;
    var g2 = this._chuteGeom();  // used for sticky-chute-wall detection
    for (i = 0; i < this.objects.length; i++) {
      var obj = this.objects[i];
      if (obj.dead) continue;
      if (obj.stuckTo) {
        // '_wall_' = stuck to wall/floor/ceiling — just stay put
        if (obj.stuckTo === '_wall_') continue;
        obj.x = obj.stuckTo.x + (obj._stickOffX||0);
        obj.y = obj.stuckTo.y + (obj._stickOffY||0);
        continue;
      }
      if (!obj.pinned) {
        var bs = BallSettings[obj.type] || BallSettings.bouncer;
        // Dynamic sub-stepping: split fast-moving balls into smaller steps to prevent tunneling
        var ballSpeed = Math.hypot(obj.vx, obj.vy) * sm;
        var maxSubSteps = (window.Settings && window.Settings.maxSubSteps) || 3;
        var subSteps = Math.min(maxSubSteps, Math.max(1, Math.ceil(ballSpeed / (obj.r * 0.8))));
        var subSm = sm / subSteps;
        // Store position before this frame's movement for swept collision detection
        obj._prevX = obj.x; obj._prevY = obj.y;
        for (var _ss = 0; _ss < subSteps; _ss++) {
          Physics.stepObject(obj, this.W, floorY, this.sparks, { gravityMult: Settings.gravityMult * subSm, bounceMult: bs.bounciness, speedMult: subSm });
        }
        // Sticky: only try to stick if ball is actually touching a wall or floor
        if (obj.type === BALL_TYPES.STICKY && !obj._fromChute && !obj.stuckTo) {
          // Knock immunity — can't re-stick for N frames after being knocked off
          if (obj._knockImmune > 0) { obj._knockImmune--; }
          else {
            var touchingFloor  = obj.y + obj.r >= floorY - 1;
            var touchingWall   = obj.x - obj.r <= 1 || obj.x + obj.r >= this.W - 1;
            var touchingTop    = obj.y - obj.r <= 1;
            var touchingChute  = obj.y >= g2.TOP_Y && obj.x + obj.r >= g2.LEFT_X - 1;
            if ((touchingWall || touchingTop || touchingChute) && !touchingFloor) {
              this._checkStickyWall(obj);
            }
          }
        }
      }
      if (obj.inFlight && Math.abs(obj.vy) < 1.2 * sm && Math.abs(obj.vx) < 1.2 * sm) {
        obj.inFlight = false;
        // Sticky landing on floor: clear fromChute so it can be re-slung
        if (obj.type === BALL_TYPES.STICKY && obj._fromChute) {
          var onFloor = obj.y + obj.r >= floorY - 2;
          if (onFloor) obj._fromChute = false;
        }
      }
      // Tick wall bounce cooldown and check explode flag
      if (obj._wallBounceCooldown > 0) obj._wallBounceCooldown--;
      if (obj._needsExplodeCheck) {
        obj._needsExplodeCheck = false;
        if (obj.type === BALL_TYPES.EXPLODER && !obj.exploded && obj.bouncesLeft <= 0) {
          triggerExplosion(obj, this.objects, this.sparks);
        }
      }
    }

    // ── Cap + piston physics ─────────────────────────────────────────────────
    if (this._pistonCapY !== undefined) {
      var capLeft2 = this.W - 46;
      // Store prev positions BEFORE iterating so delta is valid for all balls
      var _pistonPrevY1 = this._pistonPrevY1 !== undefined ? this._pistonPrevY1 : this._pistonY1;
      var _pistonPrevY2 = this._pistonPrevY2 !== undefined ? this._pistonPrevY2 : this._pistonY2;
      this._pistonPrevY1 = this._pistonY1;
      this._pistonPrevY2 = this._pistonY2;
      for (i = 0; i < this.objects.length; i++) {
        var pObj = this.objects[i];
        if (pObj.dead || pObj._inChute) continue;

        // Cap body wall — only applies to balls FULLY inside the chute column
        // (pObj.x > capLeft2 means it's inside the shaft, not just near it)
        if (pObj.x - pObj.r > capLeft2 - 2) {
          if (pObj.y - pObj.r < this._pistonCapY && pObj.y + pObj.r > this._pistonCapY - 58) {
            pObj.y = this._pistonCapY + pObj.r + 1;
            if (pObj.vy < 0) pObj.vy = Math.abs(pObj.vy) * 0.45;
          }
        }

        // Piston head collision — both pistons, rising stroke kicks upward
        var pHitR = pObj.r + 5;
        if (Math.abs(pObj.x - this._piston1X) < pHitR) {
          var pTip1 = this._pistonY1;
          if (pObj.y + pObj.r > pTip1 - 1 && pObj.y < this._pistonCapY) {
            var pVel1 = pTip1 - _pistonPrevY1;
            pObj.y = pTip1 - pObj.r;
            if (pVel1 < -0.3) { pObj.vy = pVel1 * 7 - 3; pObj.inFlight = true; }
            else { if (pObj.vy > 0) pObj.vy = 0; }
          }
        }
        if (Math.abs(pObj.x - this._piston2X) < pHitR) {
          var pTip2 = this._pistonY2;
          if (pObj.y + pObj.r > pTip2 - 1 && pObj.y < this._pistonCapY) {
            var pVel2 = pTip2 - _pistonPrevY2;
            pObj.y = pTip2 - pObj.r;
            if (pVel2 < -0.3) { pObj.vy = pVel2 * 7 - 3; pObj.inFlight = true; }
            else { if (pObj.vy > 0) pObj.vy = 0; }
          }
        }
      }
    }

    // Update tube routing
    if (this.tubes) this.tubes.update(this.objects);

    // Enforce chute left wall as physics boundary
    this._enforceChuteWall();

    if (this.target) this.target.update();
    Physics.stepSparks(this.sparks);

    // ── Per-ball special physics (squiggly, cube rotation) ───────────────────
    for (i = 0; i < this.objects.length; i++) {
      var obj2 = this.objects[i];
      if (obj2.dead) continue;

      // Cube: update rotation matrix
      if (obj2.type === BALL_TYPES.CUBE && !obj2._fromChute) {
        var rx = obj2._cubeRX || 0, ry = obj2._cubeRY || 0, rz = obj2._cubeRZ || 0;
        var spMult = (window.Settings && window.Settings.cube && window.Settings.cube.spin) || 1.0;
        rx *= spMult; ry *= spMult; rz *= spMult;
        var m = obj2._cubeRot || [1,0,0,0,1,0,0,0,1];
        var cx2=Math.cos(rx),sx2=Math.sin(rx);
        var m1=[m[0],m[1],m[2], m[3]*cx2+m[6]*sx2,m[4]*cx2+m[7]*sx2,m[5]*cx2+m[8]*sx2, -m[3]*sx2+m[6]*cx2,-m[4]*sx2+m[7]*cx2,-m[5]*sx2+m[8]*cx2];
        var cy2=Math.cos(ry),sy2=Math.sin(ry);
        var m2=[m1[0]*cy2-m1[6]*sy2,m1[1]*cy2-m1[7]*sy2,m1[2]*cy2-m1[8]*sy2, m1[3],m1[4],m1[5], m1[0]*sy2+m1[6]*cy2,m1[1]*sy2+m1[7]*cy2,m1[2]*sy2+m1[8]*cy2];
        var cz2=Math.cos(rz),sz2=Math.sin(rz);
        var m3=[m2[0]*cz2+m2[3]*sz2,m2[1]*cz2+m2[4]*sz2,m2[2]*cz2+m2[5]*sz2, -m2[0]*sz2+m2[3]*cz2,-m2[1]*sz2+m2[4]*cz2,-m2[2]*sz2+m2[5]*cz2, m2[6],m2[7],m2[8]];
        obj2._cubeRot = m3;
        // Wall/floor/ceiling bounce spin detection
        if (!obj2._fromChute && !obj2._cubeShattering) {
          var _pvx2 = obj2._prevVx !== undefined ? obj2._prevVx : obj2.vx;
          var _pvy2 = obj2._prevVy !== undefined ? obj2._prevVy : obj2.vy;
          var _flipX = (obj2.vx * _pvx2 < -0.4);
          var _flipY = (obj2.vy * _pvy2 < -0.4);
          if ((_flipX || _flipY) && !(obj2._cubeWallCool > 0)) {
            var _impMag = Math.hypot(_pvx2, _pvy2);
            if (_impMag > 0.5) {
              if (_flipX) {
                obj2._cubeRY = (Math.random()-0.5) * _impMag * 0.06;
                obj2._cubeRZ = (Math.random()-0.5) * _impMag * 0.03;
              }
              if (_flipY) {
                obj2._cubeRX = (Math.random()-0.5) * _impMag * 0.06;
                obj2._cubeRZ = (Math.random()-0.5) * _impMag * 0.03;
                if (_pvy2 < 0) obj2._cubeRZ += obj2.vx * 0.018; // rolling
              }
              this._cubeOnHit(obj2, _impMag * 0.1);
              obj2._cubeHP = (obj2._cubeHP||1) - Math.max(0.1, _impMag*0.02);
              if (obj2._cubeHP <= 0) this._cubeShatter(obj2);
              obj2._cubeWallCool = 8;
            }
          }
          obj2._prevVx = obj2.vx;
          obj2._prevVy = obj2.vy;
          if (obj2._cubeWallCool > 0) obj2._cubeWallCool--;
        }
        // Spin decay — slows when near rest on ground
        var _flY2 = this.floorY ? this.floorY() : 9999;
        var _nearFloor = (obj2.y + obj2.r >= _flY2 - 4);
        var _spd2 = Math.hypot(obj2.vx || 0, obj2.vy || 0);
        var _spinDecay;
        if (_nearFloor && _spd2 < 2.0) {
          // Slowing to rest — spin decays with speed
          _spinDecay = 0.85 + (_spd2 / 2.0) * 0.14;
        } else {
          _spinDecay = 0.999;
        }
        obj2._cubeRX = (obj2._cubeRX||0) * _spinDecay;
        obj2._cubeRY = (obj2._cubeRY||0) * _spinDecay;
        obj2._cubeRZ = (obj2._cubeRZ||0) * _spinDecay;
      }

      // Squiggly: ghost-trajectory approach
      // Ghost follows a normal-ball arc. Ball is placed offset from ghost perpendicularly.
      // Tick down splat cooldown
      if (obj2._splatCooldown > 0) obj2._splatCooldown--;
      if (obj2._brickBounceImmune > 0) obj2._brickBounceImmune--;
      // Apply splat gravity boost
      if (obj2._splatGravFrames > 0) {
        obj2._splatGravFrames--;
        var _sg = obj2._splatGravMult || 1;
        var _grav = 0.4 * ((window.Settings && Settings.gravityMult) || 1.0);
        obj2.vy += _grav * (_sg - 1);  // extra gravity on top of normal
        if (obj2._splatGravFrames <= 0) obj2._splatGravMult = 1;
      }
      if (obj2.type === BALL_TYPES.SQUIGGLY && obj2.inFlight && !obj2.stuckTo && !obj2._fromChute) {
        var sqT2 = (obj2._sqT || 0) + 1;
        obj2._sqT = sqT2;
        var _sqSet3 = (window.Settings && window.Settings.squiggly) || {};
        var sqAmp2  = _sqSet3.amp   !== undefined ? _sqSet3.amp   : 18;
        var sqFreq2 = _sqSet3.freq  !== undefined ? _sqSet3.freq  : 0.08;
        var sqFade2 = _sqSet3.fade  !== undefined ? _sqSet3.fade  : 0;
        var sqDelay2= _sqSet3.delay !== undefined ? _sqSet3.delay : 0;
        var sqWave2 = _sqSet3.wave  !== undefined ? _sqSet3.wave  : 'sine';

        // Step ghost ball (pure physics, no wiggle)
        var grav2 = 0.4 * (window.Settings ? Settings.gravityMult : 1.0);
        var bs2 = BallSettings.squiggly || BallSettings.bouncer;
        var floorY2 = this.floorY();
        var W2 = this.W;
        obj2._ghostVy = (obj2._ghostVy||0) + grav2;
        obj2._ghostVx = (obj2._ghostVx||0);
        obj2._ghostX  = (obj2._ghostX||obj2.x) + obj2._ghostVx;
        obj2._ghostY  = (obj2._ghostY||obj2.y) + obj2._ghostVy;
        var bd2 = bs2.bounceDecay !== undefined ? bs2.bounceDecay : 0.52;
        var gf2 = bs2.groundFriction !== undefined ? bs2.groundFriction : 0.82;
        // Ghost wall bounces
        if (obj2._ghostX - obj2.r < 0)   { obj2._ghostX = obj2.r;      obj2._ghostVx = Math.abs(obj2._ghostVx) * 0.75; }
        if (obj2._ghostX + obj2.r > W2)   { obj2._ghostX = W2-obj2.r;  obj2._ghostVx = -Math.abs(obj2._ghostVx) * 0.75; }
        if (obj2._ghostY - obj2.r < 0)    { obj2._ghostY = obj2.r;     obj2._ghostVy = Math.abs(obj2._ghostVy) * bd2; }
        if (obj2._ghostY + obj2.r >= floorY2) {
          obj2._ghostY = floorY2 - obj2.r;
          obj2._ghostVy = -Math.abs(obj2._ghostVy) * bd2;
          obj2._ghostVx *= gf2;
          if (Math.abs(obj2._ghostVy) < 1.5) { obj2._ghostVy = 0; }
        }

        // Compute wiggle offset perpendicular to ghost velocity
        var gspd = Math.hypot(obj2._ghostVx, obj2._ghostVy);
        var tDist2 = Math.hypot(obj2._ghostX-(obj2._sqStartX||obj2._ghostX), obj2._ghostY-(obj2._sqStartY||obj2._ghostY));
        var progress2 = Math.min(1, tDist2/(obj2._sqTotalDist||400));
        var offset = 0;
        if (progress2 >= sqDelay2 && gspd > 0.1) {
          var localT2 = (progress2-sqDelay2)/Math.max(0.01,1-sqDelay2);
          var fadeScale2 = 1 - sqFade2*localT2;
          var phase2 = sqT2*sqFreq2*Math.PI*2;
          var waveVal2=0;
          if (sqWave2==='sine') waveVal2=Math.sin(phase2);
          else if (sqWave2==='zigzag') waveVal2=(phase2%(Math.PI*2)<Math.PI)?1:-1;
          else if (sqWave2==='square') { var sq2b=Math.sin(phase2); waveVal2=sq2b>0.3?1:(sq2b<-0.3?-1:0); }
          else if (sqWave2==='chaos') waveVal2=Math.sin(phase2)+0.5*Math.sin(phase2*2.7+1.3)+0.25*(Math.random()-0.5);
          offset = waveVal2 * sqAmp2 * fadeScale2;
        }
        // Perpendicular direction to ghost velocity
        if (gspd > 0.1) {
          var perpX2 = -obj2._ghostVy/gspd, perpY2 = obj2._ghostVx/gspd;
          obj2.x = obj2._ghostX + perpX2 * offset;
          obj2.y = obj2._ghostY + perpY2 * offset;
          // Ball velocity = ghost velocity (for proper collision response)
          obj2.vx = obj2._ghostVx;
          obj2.vy = obj2._ghostVy;
        } else {
          obj2.x = obj2._ghostX; obj2.y = obj2._ghostY;
          obj2.vx = obj2._ghostVx; obj2.vy = obj2._ghostVy;
        }
      }
    }

    // Collisions
    var toAdd = [];
    for (i = 0; i < this.objects.length; i++) {
      for (j = i + 1; j < this.objects.length; j++) {
        var a = this.objects[i], b = this.objects[j];
        if (a.dead || b.dead) continue;
        var hit = Physics.resolveCollision(a, b, this.sparks);
        if (hit) {
          this.collisions++;
          this.ui.setCollisions(this.collisions);
          // ── Splatter ball: hits walls/floor/ceiling ──────────────────────────
        if (obj.type === BALL_TYPES.SPLATTER && obj.inFlight && !obj._splattered && !obj._fromChute) {
          var g3 = this._chuteGeom();
          var hitWall = false, splatX = obj.x, splatY = obj.y, splatNX = 0, splatNY = -1;
          // Floor
          if (obj.y + obj.r >= this.floorY() - 2) {
            hitWall=true; splatX=obj.x; splatY=this.floorY(); splatNX=0; splatNY=-1;
          }
          // Left wall
          else if (obj.x - obj.r <= 1) {
            hitWall=true; splatX=0; splatY=obj.y; splatNX=1; splatNY=0;
          }
          // Right wall (chute left edge)
          else if (obj.x + obj.r >= g3.LEFT_X - 1) {
            hitWall=true; splatX=g3.LEFT_X; splatY=obj.y; splatNX=-1; splatNY=0;
          }
          // Ceiling
          else if (obj.y - obj.r <= 1) {
            hitWall=true; splatX=obj.x; splatY=0; splatNX=0; splatNY=1;
          }
          if (hitWall) {
            this._createSplat(splatX, splatY, splatNX, splatNY, null);
            obj._splattered = true; obj.dead = true;
          }
        }
        // cube wall spin: moved to per-object loop
        // Sticky knock — check if a fast ball hits a wall-stuck sticky
          // Apply splat effects at this collision point
          if (this.splats && this.splats.length > 0) {
            var cHX = (a.x + b.x) / 2, cHY = (a.y + b.y) / 2;
            for (var spi2 = 0; spi2 < this.splats.length; spi2++) {
              var sp2 = this.splats[spi2];
              if (!sp2 || sp2.dead) continue;
              // Splat attached to brick — use brick's current position
              var spWX = sp2.brick ? (sp2.brick.x + sp2.offX) : sp2.wx;
              var spWY = sp2.brick ? (sp2.brick.y + sp2.offY) : sp2.wy;
              var spDist = Math.hypot(cHX - spWX, cHY - spWY);
              var _bbZone = (sp2.type === 'goo') ? sp2.coreR * 0.4 : sp2.coreR;
              if (spDist > _bbZone) continue;
              // Apply effect to whichever ball is not the splatter
              var affBall = (a.type !== BALL_TYPES.SPLATTER) ? a : b;
              this._applySplatEffect(sp2, affBall);
            }
          }
          if (a.type === BALL_TYPES.STICKY && a.stuckTo === '_wall_') {
            this._tryKnockSticky(a, Math.hypot(b.vx, b.vy), b.type);
          }
          if (b.type === BALL_TYPES.STICKY && b.stuckTo === '_wall_') {
            this._tryKnockSticky(b, Math.hypot(a.vx, a.vy), a.type);
          }
          // Exploder countdown — only after manually slung
          // Cube hit by any ball — spin + damage
          if (a.type === BALL_TYPES.CUBE && !a._fromChute && !a._cubeShattering) {
            var impactSpd = Math.hypot(b.vx - a.vx, b.vy - a.vy);
            this._cubeOnHit(a, impactSpd * 0.12);
            a._cubeHP = (a._cubeHP || 1) - Math.max(0.3, impactSpd * 0.06);
            if (a._cubeHP <= 0) this._cubeShatter(a);
          }
          if (b.type === BALL_TYPES.CUBE && !b._fromChute && !b._cubeShattering) {
            var impactSpdB = Math.hypot(a.vx - b.vx, a.vy - b.vy);
            this._cubeOnHit(b, impactSpdB * 0.12);
            b._cubeHP = (b._cubeHP || 1) - Math.max(0.3, impactSpdB * 0.06);
            if (b._cubeHP <= 0) this._cubeShatter(b);
          }
          if (a.type === BALL_TYPES.SPLATTER && !a._splattered && !a._fromChute) {
            // Splatter hitting a ball: apply effect directly, create short world-space splat
            var sNX2 = (a.x - b.x), sNY2 = (a.y - b.y);
            var sND = Math.hypot(sNX2, sNY2) || 1;
            var _spx2 = (a.x + b.x)/2, _spy2 = (a.y + b.y)/2;
            this._createSplat(_spx2, _spy2, sNX2/sND, sNY2/sND, null);  // null = no brick, world-space
            this._applySplatEffect(this.splats[this.splats.length-1], b);
            a._splattered = true; a.dead = true;
          }
          if (b.type === BALL_TYPES.SPLATTER && !b._splattered && !b._fromChute) {
            var sNX3 = (b.x - a.x), sNY3 = (b.y - a.y);
            var sND3 = Math.hypot(sNX3, sNY3) || 1;
            this._createSplat(a.x, a.y, sNX3/sND3, sNY3/sND3, null);  // null = no brick
            this._applySplatEffect(this.splats[this.splats.length-1], a);
            b._splattered = true; b.dead = true;
          }
          if (a.type === BALL_TYPES.EXPLODER && !a.exploded && !a._fromChute) {
            a.bouncesLeft = (a.bouncesLeft || 1) - 1;
            if (a.bouncesLeft <= 0) triggerExplosion(a, this.objects, this.sparks);
          }
          if (b.type === BALL_TYPES.EXPLODER && !b.exploded && !b._fromChute) {
            b.bouncesLeft = (b.bouncesLeft || 1) - 1;
            if (b.bouncesLeft <= 0) triggerExplosion(b, this.objects, this.sparks);
          }
          this._tryStick(a, b); this._tryStick(b, a);
          // Splitter: splits on every collision after being slung (infinite splits)
          // but NOT the gravity ball — gravity ball passes through
          if (a.type === BALL_TYPES.SPLITTER && !a._fromChute && !a.isSplitChild &&
              b.type !== BALL_TYPES.GRAVITY) {
            toAdd = toAdd.concat(makeSplitChildren(a, BallSettings.splitter.splitCount));
          }
          if (b.type === BALL_TYPES.SPLITTER && !b._fromChute && !b.isSplitChild &&
              a.type !== BALL_TYPES.GRAVITY) {
            toAdd = toAdd.concat(makeSplitChildren(b, BallSettings.splitter.splitCount));
          }
        }
      }
    }
    for (i = 0; i < toAdd.length; i++) this.objects.push(toAdd[i]);

    // Brick overlap separation — AABB-based, only when editor is NOT open
    if (!this._editorMode) {
      for (i = 0; i < this.bricks.length; i++) {
        for (j = i + 1; j < this.bricks.length; j++) {
          var ba = this.bricks[i], bb = this.bricks[j];
          if (!ba.isAlive() || !bb.isAlive()) continue;
          var dx2 = bb.x - ba.x, dy2 = bb.y - ba.y;
          // Use actual half-extents for each axis
          var haWx = (ba instanceof CircularBrick) ? ba.r : ba.w / 2;
          var haWy = (ba instanceof CircularBrick) ? ba.r : ba.h / 2;
          var hbWx = (bb instanceof CircularBrick) ? bb.r : bb.w / 2;
          var hbWy = (bb instanceof CircularBrick) ? bb.r : bb.h / 2;
          var overlapX = (haWx + hbWx) - Math.abs(dx2);
          var overlapY = (haWy + hbWy) - Math.abs(dy2);
          // Only separate if actually overlapping on BOTH axes
          if (overlapX > 0 && overlapY > 0) {
            var push = 0.06;
            // Push along the axis with less overlap (minimum penetration)
            if (overlapX < overlapY) {
              var dirX = dx2 >= 0 ? 1 : -1;
              ba.x -= dirX * overlapX * push; bb.x += dirX * overlapX * push;
            } else {
              var dirY = dy2 >= 0 ? 1 : -1;
              ba.y -= dirY * overlapY * push; bb.y += dirY * overlapY * push;
            }
          }
        }
      }
    }
    // Button presses
    for (i = 0; i < this.buttons.length; i++) {
      var btn = this.buttons[i];
      for (j = 0; j < this.objects.length; j++) {
        var ball = this.objects[j];
        if (!ball.dead && btn.overlaps(ball)) {
          if (!btn.pressed) {
            btn.onPressed();
            EventManager.dispatch(btn.id + '_triggered');
          }
        }
      }
    }

    // Brick damage
    for (i = 0; i < this.bricks.length; i++) {
      var brick = this.bricks[i];
      if (!brick.isAlive()) continue;
      for (j = 0; j < this.objects.length; j++) {
        var ball = this.objects[j];
        if (ball.dead || ball.stuckTo === '_wall_') continue;  // stuck ball = no more damage
        if (ball._invincTimer > 0) { ball._invincTimer--; continue; } // inner ball invincible
        // Check splat effects at this ball position (brick-ball contact)
        if (this.splats && this.splats.length > 0 && !ball._splatCooldown) {
          for (var _spi = 0; _spi < this.splats.length; _spi++) {
            var _sp = this.splats[_spi];
            if (!_sp || !_sp.brick) continue;  // only brick-attached splats matter here
            var _sbrot = (_sp.brick._rotation) || 0;
            var _swx = _sp.brick.x + _sp.offX * Math.cos(_sbrot) - _sp.offY * Math.sin(_sbrot);
            var _swy = _sp.brick.y + _sp.offX * Math.sin(_sbrot) + _sp.offY * Math.cos(_sbrot);
            var _sdist = Math.hypot(ball.x - _swx, ball.y - _swy);
            // Goo: only stick if ball is actually touching the brick edge (tight zone)
            // Dead/boost: slightly wider tolerance
            var _sZone = (_sp.type === 'goo') ? _sp.coreR * 0.5 : _sp.coreR + ball.r;
            if (_sdist > _sZone + ball.r) continue;
            this._applySplatEffect(_sp, ball);
            break;
          }
        }
        // Squiggly: sync ghost to actual velocity after brick collision
        if (ball.type === BALL_TYPES.SQUIGGLY && ball._ghostX !== undefined) {
          ball._ghostX = ball.x; ball._ghostY = ball.y;
          ball._ghostVx = ball.vx; ball._ghostVy = ball.vy;
        }

        // Splatter ball hits brick — create splat and die
        if (ball.type === BALL_TYPES.SPLATTER && !ball._splattered && !ball._fromChute) {
          if (brick.overlaps(ball)) {
            var bkdx2 = ball.x - brick.x, bkdy2 = ball.y - brick.y;
            var bkD2 = Math.hypot(bkdx2, bkdy2) || 1;
            this._createSplat(brick.x, brick.y, bkdx2/bkD2, bkdy2/bkD2, brick);
            ball._splattered = true; ball.dead = true;
            continue;
          }
        }

        // Per-ball-per-brick contact cooldown — suppresses damage re-trigger
        var coolKey = '_brickCool_' + brick.id;
        var onCooldown = ball[coolKey] > 0;
        if (onCooldown) { ball[coolKey]--; }  // keep counting down but still eject below

        // Swept collision: if ball moved far this frame, check the path too
        if (onCooldown && !brick.overlaps(ball)) continue;  // already separated, skip
        var prevBX = (ball._prevX !== undefined) ? ball._prevX : ball.x - ball.vx;
        var prevBY = (ball._prevY !== undefined) ? ball._prevY : ball.y - ball.vy;
        var ballMoved = Math.hypot(ball.vx, ball.vy);
        if (ballMoved > ball.r * 0.8 && !brick.overlaps(ball)) {
          // Cast ray from prev→current position, check AABB intersection
          var bHW = (brick instanceof CircularBrick) ? brick.r : brick.w / 2;
          var bHH = (brick instanceof CircularBrick) ? brick.r : brick.h / 2;
          var segDX = ball.x - prevBX, segDY = ball.y - prevBY;
          var tMin = 0, tMax = 1;
          for (var ax = 0; ax < 2; ax++) {
            var segD = ax === 0 ? segDX : segDY;
            var relPrev = (ax === 0 ? prevBX - brick.x : prevBY - brick.y);
            var halfExt = (ax === 0 ? bHW : bHH) + ball.r;
            if (Math.abs(segD) < 0.0001) {
              if (Math.abs(relPrev) > halfExt) { tMin = 2; break; }
            } else {
              var t1 = (-halfExt - relPrev) / segD;
              var t2 = ( halfExt - relPrev) / segD;
              if (t1 > t2) { var tmp = t1; t1 = t2; t2 = tmp; }
              tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2);
              if (tMin > tMax) { tMin = 2; break; }
            }
          }
          if (tMin > 1) continue;  // no intersection along path
          // Hit detected via sweep — move ball back to contact point
          ball.x = prevBX + segDX * tMin;
          ball.y = prevBY + segDY * tMin;
        } else if (!brick.overlaps(ball)) {
          continue;
        }

        // Short cooldown (6 frames) prevents double-damage; ejection still happens above
        if (!onCooldown) ball[coolKey] = 6;
        if (onCooldown) continue;  // already processed this collision; eject already done above

        // Push ball out of brick (handles both rect and circular bricks)
        var bEdgeX, bEdgeY, bndx, bndy, bndist, bnx, bny;
        if (brick instanceof CircularBrick) {
          // Circle: push directly away from center
          bndx   = ball.x - brick.x;
          bndy   = ball.y - brick.y;
          bndist = Math.hypot(bndx, bndy) || 1;
          bnx = bndx / bndist; bny = bndy / bndist;
          var overlap2 = (brick.r + ball.r) - bndist;
          if (overlap2 > 0) { ball.x += bnx * (overlap2 + 0.5); ball.y += bny * (overlap2 + 0.5); }
        } else {
          // Rotated rect: transform ball into brick-local space, find closest point, transform normal back
          var bRot  = brick._rotation || 0;
          var cosR  = Math.cos(-bRot), sinR = Math.sin(-bRot);
          var relBX = ball.x - brick.x, relBY = ball.y - brick.y;
          // Ball centre in brick-local space
          var localX = cosR * relBX - sinR * relBY;
          var localY = sinR * relBX + cosR * relBY;
          var hw = brick.w / 2, hh = brick.h / 2;
          // Closest point on unrotated rect to ball centre
          var clamX = Math.max(-hw, Math.min(localX, hw));
          var clamY = Math.max(-hh, Math.min(localY, hh));
          var dLX = localX - clamX, dLY = localY - clamY;
          bndist = Math.hypot(dLX, dLY) || 0.001;
          // Local-space normal
          var lnx = dLX / bndist, lny = dLY / bndist;
          // Transform normal back to world space
          var cosF = Math.cos(bRot), sinF = Math.sin(bRot);
          bnx = cosF * lnx - sinF * lny;
          bny = sinF * lnx + cosF * lny;
          var overlap3 = ball.r - bndist;
          if (overlap3 > 0) { ball.x += bnx * (overlap3 + 0.5); ball.y += bny * (overlap3 + 0.5); }
        }
        // Reflect velocity — ONLY if this hit doesn't destroy the brick
        // Pre-check: will this hit destroy?
        var bsBall2   = BallSettings[ball.type] || BallSettings.bouncer;
        var speed2    = Math.hypot(ball.vx, ball.vy);
        var velFactor2= Math.max(0.5, Math.min(speed2 / 8, 3.0));
        var dmgPreview= Math.round((bsBall2.baseDamage || 20) * (bsBall2.density || 1.0) * velFactor2);
        var willDestroy = !brick._invincible && (brick.health - dmgPreview) <= 0;

        if (!willDestroy) {
          var dot = ball.vx * bnx + ball.vy * bny;
          if (dot < 0) {
            ball.vx -= 2 * dot * bnx;
            ball.vy -= 2 * dot * bny;
            ball.vx *= 0.82;
            ball.vy *= 0.82;
          }
        }

        // Damage = baseDamage × density × velocity factor
        var bsBall    = BallSettings[ball.type] || BallSettings.bouncer;
        var speed     = Math.hypot(ball.vx, ball.vy);
        var velFactor = Math.max(0.5, Math.min(speed / 8, 3.0));
        var dmg       = Math.round((bsBall.baseDamage || 20) * (bsBall.density || 1.0) * velFactor);
        var destroyed = brick.takeDamage(dmg);

        // Spawn floating damage number
        if (dmg > 0) {
          var _dnAngle = Math.random() * Math.PI * 2;
          var _dnSpd   = 3.5 + Math.random() * 2.5;
          this._dmgNumbers.push({
            x: ball.x + bnx * (ball.r + 2), y: ball.y + bny * (ball.r + 2),
            vx: Math.cos(_dnAngle) * _dnSpd, vy: Math.sin(_dnAngle) * _dnSpd - 1.5,
            val: dmg, age: 0, maxAge: 55,  // ~0.9s at 60fps
          });
        }

        if (window.spawnBrickShards) spawnBrickShards(this.sparks, brick, ball);
        // Play brick note if configured, otherwise normal impact sound
        if (brick._noteConfig && window.BrickNote) {
          var nc3 = brick._noteConfig;
          window.BrickNote.playNote(nc3.note||'C', nc3.octave||4, nc3.timbre||'marimba', nc3.vol !== undefined ? nc3.vol : 0.6);
        } else if (window.Sound) {
          Sound.brickShatter(dmg * 0.01);
        }

        if (ball.type === BALL_TYPES.STICKY) {
          var _wasStuck = ball.stuckTo;
          this._checkStickyWall(ball);
          if (ball.stuckTo === '_wall_') {
            // Just stuck — store normal
            ball._stickNx = bnx;
            ball._stickNy = bny;
          } else if (!_wasStuck) {
            // Bounced off brick without sticking — set brief immunity to prevent
            // sticking on the far side of the same brick
            ball._brickBounceImmune = 8;
          }
        }
        // If hitter ball hits a sticky that's stuck to this brick, try knocking it off
        if (ball.type !== BALL_TYPES.STICKY) {
          var _impSpd = Math.hypot(ball.vx, ball.vy);
          for (var _ski = 0; _ski < this.objects.length; _ski++) {
            var _stkBall = this.objects[_ski];
            if (_stkBall.type !== BALL_TYPES.STICKY) continue;
            if (_stkBall.stuckTo !== '_wall_') continue;
            if (Math.hypot(_stkBall.x - brick.x, _stkBall.y - brick.y) > brick.w + _stkBall.r + 4) continue;
            if (Math.hypot(_stkBall.x - ball.x, _stkBall.y - ball.y) < _stkBall.r + ball.r + 6) {
              this._tryKnockSticky(_stkBall, _impSpd, ball.type);
            }
          }
        }

        // Exploder: count brick hit
        if (ball.type === BALL_TYPES.EXPLODER && !ball.exploded) {
          ball.bouncesLeft = (ball.bouncesLeft || 1) - 1;
          if (ball.bouncesLeft <= 0) triggerExplosion(ball, this.objects, this.sparks);
        }

        // Splitter: always spawn children on brick hit (no _fromChute guard — brick is a valid trigger)
        if (ball.type === BALL_TYPES.SPLITTER && !ball.isSplitChild) {
          if (!ball._brickSplitCooldown || ball._brickSplitCooldown <= 0) {
            var splitKids = makeSplitChildren(ball, BallSettings.splitter.splitCount);
            for (var sk = 0; sk < splitKids.length; sk++) this.objects.push(splitKids[sk]);
            ball._brickSplitCooldown = 20;
          }
        }

        if (destroyed) {
          // Freeze brick in place — no physics on last hit
          brick._vx = 0; brick._vy = 0; brick._angularV = 0;
          EventManager.dispatch(brick.id + '_triggered');
          // Detach any sticky balls near this brick
          for (var di = 0; di < this.objects.length; di++) {
            var dball = this.objects[di];
            if (dball.type === BALL_TYPES.STICKY && dball.stuckTo === '_wall_') {
              if (Math.hypot(dball.x - brick.x, dball.y - brick.y) < brick.w + dball.r) {
                dball.stuckTo  = null;
                dball.inFlight = true;
                dball.vy = -1.5;
                dball.vx = (Math.random() - 0.5) * 2;
              }
            }
            // Free any goo-stuck balls attached to this brick's splats
            if (dball.stuckTo === '_wall_' && dball._gooPermStuck) {
              if (Math.hypot(dball.x - brick.x, dball.y - brick.y) < (brick.w || 60) + dball.r + 20) {
                dball.stuckTo = null; dball.inFlight = true;
                dball._gooPermStuck = false; dball._knockImmune = 0;
                dball.vy = -2; dball.vx = (Math.random()-0.5) * 3;
              }
            }
          }
          // Remove splats attached to this brick
          if (this.splats) {
            for (var sdi = this.splats.length - 1; sdi >= 0; sdi--) {
              if (this.splats[sdi].brick === brick) this.splats.splice(sdi, 1);
            }
          }
        }

        // Movable brick physics — translate + rotate around chosen pivot
        if (brick._movable && !destroyed) {
          var brickDensity = brick._density || 1.0;
          var ballSpeed    = Math.hypot(ball.vx, ball.vy);
          // Base force: generous scale so bricks travel visibly
          var baseForce    = (ballSpeed * 0.8) / Math.max(0.1, brickDensity);

          // Hit offset from brick center (normalized 0=center, 1=edge)
          var brickHalfW = (brick.w || 60) / 2;
          var brickHalfH = (brick.h || 22) / 2;
          var hitOffXraw = ball.x - brick.x;
          var hitOffYraw = ball.y - brick.y;
          // Normalized: 0 at center, 1 at far edge
          var edgeFrac   = Math.min(1, Math.max(Math.abs(hitOffXraw) / brickHalfW,
                                                 Math.abs(hitOffYraw) / brickHalfH));
          // Center hit = max linear movement, no rotation
          // Edge hit = mix of linear + rotation
          // linearFrac: 1.0 at center, 0.5 at edge
          var linearFrac  = 1.0 - edgeFrac * 0.5;
          var rotateFrac  = edgeFrac;

          // Linear impulse
          brick._vx = (brick._vx || 0) - bnx * baseForce * linearFrac;
          brick._vy = (brick._vy || 0) - bny * baseForce * rotateFrac;

          // Angular impulse — scaled by edge fraction so center hits barely spin
          // When ↔ROT (translateOnRotate) ON: use selected pivot
          // When ⊕ROT OFF: use center as pivot always (free spin + translate)
          var pivotStr = brick._pivot || 'C';
          var pivotOff = (brick._translateOnRotate !== false)
            ? (pivotStr === 'L' ? -brickHalfW : pivotStr === 'R' ? brickHalfW : 0)
            : 0;
          var hitPivX = hitOffXraw - pivotOff;
          var hitPivY = hitOffYraw;
          var torque  = (hitPivX * (-bny) - hitPivY * (-bnx)) * baseForce * 0.018 * rotateFrac;
          var rspd = brick._rotSpeed !== undefined ? brick._rotSpeed * 0.5 : 0.25;  // global spin /4
          brick._angularV = (brick._angularV || 0) + torque * rspd;

          if (brick._startX === undefined) { brick._startX = brick.x; brick._startY = brick.y; }
          if (window.Sound) Sound.brickShatter(baseForce * 0.2);
        }
        this.collisions++;
        this.ui.setCollisions(this.collisions);
      }
      // Tick brick split cooldown
      for (j = 0; j < this.objects.length; j++) {
        if (this.objects[j]._brickSplitCooldown > 0) this.objects[j]._brickSplitCooldown--;
      }
    }

    // Turnstile bounces
    for (i = 0; i < this.turnstiles.length; i++) {
      var turnstile = this.turnstiles[i];
      for (j = 0; j < this.objects.length; j++) {
        var ball = this.objects[j];
        if (!ball.dead && !ball.stuckTo) {
          if (turnstile.bounceOffArm(ball)) {
            this.collisions++;
            this.ui.setCollisions(this.collisions);
          }
        }
      }
    }

    // Electrical ports
    for (i = 0; i < this.ports.length; i++) {
      var port = this.ports[i];
      for (j = 0; j < this.objects.length; j++) {
        var ball = this.objects[j];
        if (!ball.dead && port.overlaps(ball) && port.canAccept(ball)) {
          if (!port.occupied) {
            port.occupied = ball;
            ball.inFlight = false;
            ball.vx = 0; ball.vy = 0;
            EventManager.dispatch(port.id + '_triggered');
          }
        }
      }
    }

    // Remove dead balls (no sky-drop respawn)
    for (i = this.objects.length - 1; i >= 0; i--) {
      if (this.objects[i].dead) this.objects.splice(i, 1);
    }

    // Obstacle hits
    for (i = 0; i < this.obstacles.length; i++) {
      for (j = 0; j < this.objects.length; j++) {
        var o = this.objects[j];
        if (o.dead || o.stuckTo) continue;
        var oh = Physics.bounceOffObstacle(o, this.obstacles[i], this.sparks);
        if (oh && o.type === BALL_TYPES.EXPLODER && !o.exploded) {
          o.bouncesLeft = (o.bouncesLeft || 1) - 1;
          if (o.bouncesLeft <= 0) triggerExplosion(o, this.objects, this.sparks);
        }
      }
    }

    // Barrier
    for (i = 0; i < this.objects.length; i++) {
      if (!this.objects[i].dead && !this.objects[i].stuckTo) Physics.bounceOffBarrier(this.objects[i], this.barrier);
    }

    // Objective checks
    this._checkObjectives();

    this._draw();
    } catch(err) {
      // Surface errors visibly instead of silently killing the loop
      console.error('PuzzBalls _loop error:', err);
      var ctx = this.ctx;
      if (ctx) {
        ctx.fillStyle = '#030a18'; ctx.fillRect(0,0,this.W,this.H);
        ctx.fillStyle = '#ff4444'; ctx.font = "12px 'Share Tech Mono',monospace";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('ERROR: ' + err.message, this.W/2, this.H/2 - 16);
        ctx.fillStyle = '#ff8888'; ctx.font = "9px 'Share Tech Mono',monospace";
        ctx.fillText('Check console. Tap ⟳ to reset.', this.W/2, this.H/2 + 10);
      }
    }
  }

  _checkObjectives() {
    if (this.won) return;
    for (var i = 0; i < this.objectives.length; i++) {
      var obj = this.objectives[i];
      if (obj.met) continue;
      if (obj.type === 'ballInZone') {
        for (var j = 0; j < this.objects.length; j++) {
          var ball = this.objects[j];
          if (ball.type !== obj.ballType || ball.dead) continue;
          var dx = ball.x - this.target.x, dy = ball.y - this.target.y;
          if (this.target && Math.hypot(dx, dy) < this.target.r + ball.r) {
            obj.met = true;
            this.ui.setObjectives(this.objectives);
          }
        }
      }

      // Phase 2 objective types
      if (obj.type === 'portActivated') {
        for (var j = 0; j < this.ports.length; j++) {
          if (this.ports[j].id === obj.portId && this.ports[j].occupied) {
            obj.met = true;
            this.ui.setObjectives(this.objectives);
            break;
          }
        }
      }

      if (obj.type === 'brickDestroyed') {
        for (var j = 0; j < this.bricks.length; j++) {
          if (this.bricks[j].id === obj.brickId && !this.bricks[j].isAlive()) {
            obj.met = true;
            this.ui.setObjectives(this.objectives);
            break;
          }
        }
      }
    }
    // Win if all objectives met
    var allMet = this.objectives.every(function(o) { return o.met; });
    if (allMet && this.objectives.length > 0) this._triggerWin();
  }

  _tryStick(sticky, other) {
    // Sticky never sticks to other balls — ball-to-ball always bounces
    return;
  }

  // Called after wall/floor/brick bounce — check if sticky should stick
  // Only sticks if it has JUST hit a surface (touching floor/wall) AND is slow enough
  _checkStickyWall(obj) {
    if (obj.type !== BALL_TYPES.STICKY) return;
    if (obj.stuckTo || obj._fromChute) return;
    if (obj._knockImmune > 0) return;  // recently knocked off — don't re-stick
    if (obj._brickBounceImmune > 0) { obj._brickBounceImmune--; return; }  // just bounced through brick
    var threshold = (window.BallSettings && BallSettings.sticky.stickThreshold) || 6;
    var speed = Math.hypot(obj.vx, obj.vy);
    if (speed < threshold) {
      var touchingFloor = obj.y + obj.r >= this.floorY() - 2;
      if (touchingFloor) return;
      obj.vx = 0; obj.vy = 0;
      obj.inFlight = false;
      obj.stuckTo  = '_wall_';
      // Store surface normal so tap-bounce launches perpendicular to surface
      var nx = 0, ny = -1;
      var g3 = this._chuteGeom();
      if (obj.x + obj.r >= g3.LEFT_X - 2)   { nx = -1; ny =  0; } // chute left wall → launch left
      else if (obj.x - obj.r <= 2)           { nx =  1; ny =  0; } // left wall → launch right
      else if (obj.x + obj.r >= this.W - 2)  { nx = -1; ny =  0; } // right wall → launch left → launch left
      else if (obj.y - obj.r <= 2)            { nx =  0; ny =  1; } // ceiling → launch down
      else                                    { nx =  0; ny = -1; } // default → launch up
      obj._stickNx = nx;
      obj._stickNy = ny;
      if (window.Sound) Sound.thud(4);
    }
  }

  _getPivotOffset(brick, pivot) {
    // Returns {x,y} offset from brick center to pivot point
    var hw = (brick.w || 40) / 2, hh = (brick.h || 22) / 2;
    var pMap = {
      'TL':{x:-hw,y:-hh},'TC':{x:0,y:-hh},'TR':{x:hw,y:-hh},
      'ML':{x:-hw,y:0},  'CM':{x:0,y:0},   'MR':{x:hw,y:0},
      'BL':{x:-hw,y:hh}, 'BC':{x:0,y:hh},  'BR':{x:hw,y:hh},
    };
    return pMap[pivot] || {x:0, y:0};
  }

  // Try to unstick a sticky ball that was hit by another ball
  _applySplatEffect(sp, ball) {
    if (!sp || !ball || ball._splatCooldown) return;
    var sq = (window.Settings && window.Settings.splatter) || {};
    if (sp.type === 'dead') {
      // Gravity bomb: spike gravity on the ball temporarily
      var gravMult = sq.deadGravMult !== undefined ? sq.deadGravMult : 8;
      var gravDur  = sq.deadGravDur  !== undefined ? sq.deadGravDur  : 90;
      ball._splatGravMult    = gravMult;
      ball._splatGravFrames  = gravDur > 0 ? gravDur : 9999;
      // Kill horizontal momentum proportionally
      ball.vx *= Math.max(0, 1 - gravMult * 0.06);
      ball._splatCooldown = 25;
    } else if (sp.type === 'boost') {
      var boostMult = sq.boostMult !== undefined ? sq.boostMult : 2.2;
      var spd = Math.hypot(ball.vx, ball.vy);
      if (spd > 0.1) { ball.vx *= boostMult; ball.vy *= boostMult; }
      ball._splatCooldown = 25;
    } else if (sp.type === 'goo') {
      var permanent = sq.gooPermanent !== undefined ? sq.gooPermanent : false;
      ball.stuckTo   = '_wall_';
      ball.vx = 0; ball.vy = 0; ball.inFlight = false;
      if (permanent) {
        ball._gooPermStuck = true;  // flag: gravity well can't pull it off
        ball._knockImmune  = 99999;
      } else {
        ball._gooStickiness = sq.gooStickiness !== undefined ? sq.gooStickiness : 50;
      }
      ball._splatCooldown = 60;
    }
  }

  _tryKnockSticky(sticky, impactSpeed, hitterType) {
    if (sticky.type !== BALL_TYPES.STICKY || sticky.stuckTo !== '_wall_') return;
    // Use goo stickiness if ball was stuck by splat goo
    var stickiness = sticky._gooStickiness !== undefined
      ? sticky._gooStickiness
      : ((window.BallSettings && BallSettings.sticky && BallSettings.sticky.stickiness !== undefined)
        ? BallSettings.sticky.stickiness : 50);
    var hDensity = (hitterType && window.BallSettings && BallSettings[hitterType])
      ? (BallSettings[hitterType].density || 1.0) : 1.0;
    var knockForce = impactSpeed * hDensity;
    var knockThreshold = stickiness >= 100 ? 99999 : (2 + (stickiness / 100) * 28);

    if (knockForce > knockThreshold) {
      sticky.stuckTo  = null;
      sticky.inFlight = true;

      // Detect which surface it's stuck to and pop it away from that surface
      var floorY2 = this.floorY();
      var g3 = this._chuteGeom();
      var popAmt = sticky.r * 2.5 + 4;  // enough to clear the wall

      // Pop direction = away from whichever surface it's touching
      var popVX = 0, popVY = 0;
      if (sticky.x - sticky.r <= 2)           { sticky.x += popAmt; popVX =  1; } // left wall
      else if (sticky.x + sticky.r >= g3.LEFT_X - 2) { sticky.x -= popAmt; popVX = -1; } // chute wall
      else if (sticky.y - sticky.r <= 2)       { sticky.y += popAmt; popVY =  1; } // ceiling
      else                                      { popVY = -1; }                      // default: up

      // Minimum ejection speed so it actually leaves
      var minSpeed = 5;
      var ejectSpeed = Math.max(minSpeed, knockForce * 0.5);
      sticky.vx = popVX * ejectSpeed * (0.8 + Math.random() * 0.4) + (Math.random()-0.5) * 2;
      sticky.vy = popVY * ejectSpeed * (0.8 + Math.random() * 0.4) - 1;

      // Immunity: can't re-stick for 45 frames (~0.75 seconds)
      sticky._knockImmune = 45;

      if (window.Sound) Sound.thud(ejectSpeed);
    } else {
      sticky._wiggleTimer = 15;
      sticky._wiggleAmt   = Math.min(6, knockForce);
      if (window.Sound) this._playStickyWiggle();
    }
  }

  _playStickyWiggle() {
    if (!window.Sound || !Sound.getCtx) return;
    var c = Sound.getCtx(); if (!c) return;
    var now = c.currentTime;
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.setValueAtTime(320, now + 0.05);
    osc.frequency.setValueAtTime(260, now + 0.10);
    osc.frequency.setValueAtTime(300, now + 0.15);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
    osc.connect(g); g.connect(c.destination);
    osc.start(now); osc.stop(now + 0.20);
  }

  _spawnFallingExploder() {
    var bs = BallSettings.exploder, r = bs.size;
    var obj = new PhysObj((0.2 + Math.random() * 0.6) * this.W, -r * 3, r, r/10, bs.color, bs.glow, 'EXP');
    obj.type = BALL_TYPES.EXPLODER; obj.inFlight = true; obj.pinned = false;
    obj.exploded = false; obj.dead = false; obj.hasStuck = false; obj.hasSplit = false; obj.stuckTo = null;
    obj.vx = (Math.random() - 0.5) * 3; obj.vy = 2;
    this.objects.push(obj);
  }

  // ── Chute system ───────────────────────────────────────────────────────────
  // Right wall = screen edge (W), straight down.
  // Left wall  = W - CHUTE_W, straight down then RIGHT-opening quarter-arc:
  //   arc center = (leftX + turnR, floorY)
  //   ball enters from top of arc at (leftX, floorY - turnR) going down
  //   exits at bottom-right of arc at (leftX + turnR, floorY) ... wait that's wrong
  //
  // Looking at sketch: the J opens to the LEFT. The bottom of the J curves
  // the ball from going DOWN into going LEFT along the floor.
  // Correct geometry:
  //   left wall straight down → at floorY - turnR, arc center = (leftX, floorY)
  //   ball travels DOWN the inside-right of the arc:
  //     start angle = 0 (ball at leftX + turnR, floorY — right of center, but that's in shaft)
  //   
  // SIMPLEST CORRECT APPROACH matching the sketch red lines:
  //   - Right wall: screen edge straight down (already correct)
  //   - Left wall: straight down, then a quarter-circle that scoops to the LEFT
  //     Arc: center at (leftX, floorY), radius=turnR
  //     Going from angle=0 (right, at leftX+turnR, floorY) → sweep to -π/2 ... no
  //
  // The ball comes DOWN the shaft center (shaftCX = leftX + CHUTE_W/2)
  // At bottom: arc center = (leftX + turnR, floorY - turnR) i.e. inside the J curve
  // Ball goes from (leftX + turnR, floorY - 2*turnR+approx) curving to exit LEFT
  //
  // FINAL CORRECT:
  //   Arc center = (leftX, floorY - turnR)  ← center is inside the curve
  //   Ball at angle=0 → (leftX + turnR, floorY - turnR) = bottom of shaft
  //   Ball at angle=π/2 → (leftX, floorY) = floor exit LEFT of shaft ← no, exits below
  //   Ball at angle=-π/2 → (leftX, floorY - 2*turnR) = top ... 
  //
  // Try: center = (leftX + turnR, floorY)
  //   angle π   → (leftX, floorY)          = left exit at floor ✓
  //   angle π/2 → (leftX+turnR, floorY+turnR) = below floor ✗
  //   angle π/2 CCW from top → ... 
  //
  // DEFINITIVE: draw a simple smooth curve using bezierCurveTo instead of arc:
  //   From (leftX, floorY - turnR) curving to (leftX - turnR, floorY) 
  //   Control point: (leftX, floorY)  ← corner of the J

  // ── Cube ball: 3D rendering + hit/shatter ────────────────────────────────

  _cubeOnHit(obj, impactMag) {
    var chaos = obj._cubeChaos || 0.6;
    var r = Math.random;
    var mag = 0.02 + impactMag * chaos;
    // Randomly redistribute spin across axes
    var roll = r();
    if (roll < 0.35) {
      // Dominant single axis spin
      var axis = Math.floor(r()*3);
      obj._cubeRX = axis===0 ? (r()-0.5)*mag*4 : obj._cubeRX*(1-chaos*0.7);
      obj._cubeRY = axis===1 ? (r()-0.5)*mag*4 : obj._cubeRY*(1-chaos*0.7);
      obj._cubeRZ = axis===2 ? (r()-0.5)*mag*2 : obj._cubeRZ*(1-chaos*0.7);
    } else if (roll < 0.6) {
      // Nearly stop — slow thud
      obj._cubeRX *= 0.15; obj._cubeRY *= 0.15; obj._cubeRZ *= 0.15;
      setTimeout(function() {
        obj._cubeRX = (Math.random()-0.5)*mag*5;
        obj._cubeRY = (Math.random()-0.5)*mag*5;
      }, 200 + Math.random()*300);
    } else {
      // Chaotic multi-axis
      obj._cubeRX += (r()-0.5)*mag*3;
      obj._cubeRY += (r()-0.5)*mag*3;
      obj._cubeRZ += (r()-0.5)*mag*1.5;
    }
    // Tink sound
    if (window.Sound && Sound.getCtx) {
      var sc = Sound.getCtx();
      if (sc) {
        var vel = Math.min(1, impactMag * 3 + 0.2);
        var freq = 1200 + Math.random() * 800;
        var g = sc.createGain(); g.connect(sc.destination);
        g.gain.setValueAtTime(vel * 0.25, sc.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, sc.currentTime + 0.18);
        var o = sc.createOscillator(); o.connect(g);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, sc.currentTime);
        o.frequency.exponentialRampToValueAtTime(freq*0.7, sc.currentTime+0.15);
        o.start(sc.currentTime); o.stop(sc.currentTime+0.18);
        // Second harmonic
        var g2 = sc.createGain(); g2.connect(sc.destination);
        g2.gain.setValueAtTime(vel*0.1, sc.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001, sc.currentTime+0.08);
        var o2 = sc.createOscillator(); o2.connect(g2);
        o2.type = 'sine';
        o2.frequency.setValueAtTime(freq*2.1, sc.currentTime);
        o2.start(sc.currentTime); o2.stop(sc.currentTime+0.08);
      }
    }
  }

  _cubeShatter(obj) {
    obj._cubeShattering = true;
    obj.dead = false; // stay alive for shards animation
    var shards = [];
    var numShards = 5 + Math.floor(Math.random()*4);
    for (var i=0; i<numShards; i++) {
      var ang = (i/numShards)*Math.PI*2 + (Math.random()-0.5)*0.8;
      var spd = 3 + Math.random()*5;
      shards.push({
        x: obj.x, y: obj.y,
        vx: obj.vx*0.4 + Math.cos(ang)*spd,
        vy: obj.vy*0.4 + Math.sin(ang)*spd,
        rot: Math.random()*Math.PI*2,
        rotV: (Math.random()-0.5)*0.4,
        size: 4 + Math.random()*6,
        alpha: 1,
        age: 0, maxAge: 35 + Math.random()*25,
      });
    }
    obj._cubeShards = shards;
    obj._cubeHP = 0;
    // Shatter sound — glass crash
    if (window.Sound && Sound.getCtx) {
      var sc = Sound.getCtx();
      if (sc) {
        for (var ti=0; ti<6; ti++) {
          var g = sc.createGain(); g.connect(sc.destination);
          var delay = ti*0.02;
          g.gain.setValueAtTime(0, sc.currentTime+delay);
          g.gain.linearRampToValueAtTime(0.2, sc.currentTime+delay+0.005);
          g.gain.exponentialRampToValueAtTime(0.001, sc.currentTime+delay+0.3);
          var o = sc.createOscillator(); o.connect(g);
          o.type = 'sine';
          o.frequency.setValueAtTime(1500+Math.random()*2000, sc.currentTime+delay);
          o.start(sc.currentTime+delay); o.stop(sc.currentTime+delay+0.3);
        }
        // White noise burst
        var bufSize = sc.sampleRate * 0.15;
        var buf = sc.createBuffer(1, bufSize, sc.sampleRate);
        var data = buf.getChannelData(0);
        for (var ni=0; ni<bufSize; ni++) data[ni]=(Math.random()*2-1)*0.4;
        var src = sc.createBufferSource(); src.buffer=buf;
        var gn = sc.createGain(); gn.connect(sc.destination);
        gn.gain.setValueAtTime(0.3, sc.currentTime);
        gn.gain.exponentialRampToValueAtTime(0.001, sc.currentTime+0.15);
        src.connect(gn); src.start(sc.currentTime); src.stop(sc.currentTime+0.15);
      }
    }
    Physics.spawnSparks(this.sparks, obj.x, obj.y, '#00ffff', 20);
    Physics.spawnSparks(this.sparks, obj.x, obj.y, '#030a18', 12);

    // ── Spawn inner ball ──────────────────────────────────────────────────
    var cset2 = (window.Settings && window.Settings.cube) || {};
    var innerType  = cset2.innerBallType || 'gravity';
    var innerSzMult= cset2.innerBallSize !== undefined ? cset2.innerBallSize : 0.55;
    var speedBoost = cset2.innerSpeedBoost !== undefined ? cset2.innerSpeedBoost : 1.4;
    var invincFrames = cset2.innerInvinc !== undefined ? Math.round(cset2.innerInvinc) : 30;

    var bs2 = BallSettings[innerType] || BallSettings.bouncer;
    var innerR = Math.max(4, Math.round((bs2.size || bs2.r || 12) * innerSzMult));
    var innerBall = new PhysObj(obj.x, obj.y, innerR,
      innerR/10 * ((bs2.density||1.0)),
      bs2.color, bs2.glow, bs2.label ? bs2.label.slice(0,3) : 'GRV');
    innerBall.type      = innerType;
    innerBall.inFlight  = true;
    innerBall.pinned    = false;
    innerBall.dead      = false;
    innerBall.exploded  = false;
    innerBall.hasStuck  = false;
    innerBall.hasSplit  = false;
    innerBall.stuckTo   = null;
    innerBall._fromChute= false;
    // Inherit cube velocity + speed boost
    var cubeSpd = Math.hypot(obj.vx, obj.vy);
    var boostMult = speedBoost > 0 ? speedBoost : 1.0;
    if (cubeSpd > 0.1) {
      innerBall.vx = (obj.vx / cubeSpd) * cubeSpd * boostMult;
      innerBall.vy = (obj.vy / cubeSpd) * cubeSpd * boostMult;
    } else {
      innerBall.vx = (Math.random()-0.5) * 4;
      innerBall.vy = -3;
    }
    // Gravity well setup
    if (innerType === 'gravity') {
      innerBall.gravActive = true;
      innerBall._slungIds  = [];
    }
    // Invincibility timer — can't take damage for N frames
    innerBall._invincTimer = invincFrames;
    this.objects.push(innerBall);
    this.ui.attachObjects(this.objects);
  }

  _drawCube(obj) {
    var ctx = this.ctx;
    var cx = obj.x, cy = obj.y;
    var s = obj.r * 1.1;  // half-size
    var m = obj._cubeRot || [1,0,0,0,1,0,0,0,1];
    var DIST = 180;  // perspective distance

    // Draw shards if shattering
    if (obj._cubeShards) {
      // Update shard physics here since obj may be dead
      var allDone = true;
      for (var si=0; si<obj._cubeShards.length; si++) {
        var sh = obj._cubeShards[si];
        sh.x += sh.vx; sh.y += sh.vy; sh.vy += 0.25;
        sh.vx *= 0.99;
        sh.rot += sh.rotV; sh.age++;
        sh.alpha = Math.max(0, 1 - sh.age/sh.maxAge);
        if (sh.age < sh.maxAge) allDone = false;
      }
      if (allDone) { obj._cubeShards = null; obj.dead = true; return; }
      for (var si=0; si<obj._cubeShards.length; si++) {
        var sh = obj._cubeShards[si];
        if (sh.alpha <= 0) continue;
        ctx.save();
        ctx.translate(sh.x, sh.y);
        ctx.rotate(sh.rot);
        ctx.globalAlpha = sh.alpha;
        ctx.strokeStyle = '#00ffff';
        ctx.fillStyle = 'rgba(0,220,255,0.15)';
        ctx.lineWidth = 1.2;
        ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(-sh.size, -sh.size*0.5);
        ctx.lineTo(sh.size*0.8, -sh.size*0.3);
        ctx.lineTo(sh.size*0.2, sh.size);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      return;
    }

    // Project 3D point to 2D with perspective
    function proj(x3, y3, z3) {
      // Apply rotation matrix
      var rx = m[0]*x3 + m[1]*y3 + m[2]*z3;
      var ry = m[3]*x3 + m[4]*y3 + m[5]*z3;
      var rz = m[6]*x3 + m[7]*y3 + m[8]*z3;
      var scale = DIST / (DIST + rz + s);
      return { x: cx + rx*scale, y: cy + ry*scale, z: rz };
    }

    // 8 corners of cube
    var corners = [
      proj(-s,-s,-s), proj( s,-s,-s), proj( s, s,-s), proj(-s, s,-s),
      proj(-s,-s, s), proj( s,-s, s), proj( s, s, s), proj(-s, s, s),
    ];

    // 6 faces: [corner indices, normal direction]
    var faces = [
      { idx:[0,1,2,3], nz:-1 },  // back
      { idx:[4,5,6,7], nz: 1 },  // front
      { idx:[0,1,5,4], ny:-1 },  // top
      { idx:[2,3,7,6], ny: 1 },  // bottom
      { idx:[0,3,7,4], nx:-1 },  // left
      { idx:[1,2,6,5], nx: 1 },  // right
    ];

    // Sort faces back to front by average Z
    faces.forEach(function(f) {
      f.avgZ = f.idx.reduce(function(s2,i) { return s2+corners[i].z; },0)/4;
    });
    faces.sort(function(a,b) { return b.avgZ - a.avgZ; });

    // HP-based color tint — cracks appear as cube takes damage
    var hpFrac = Math.max(0, Math.min(1, (obj._cubeHP||0) / (obj._cubeMaxHP||4)));
    var crackAlpha = (1 - hpFrac) * 0.6;

    // Orb settings
    var _cset = (window.Settings && window.Settings.cube) || {};
    var _orbSz   = _cset.orbSize  !== undefined ? _cset.orbSize  : 0.35; // fraction of s
    var _orbColHex = _cset.orbColor || '#ff3300';
    var _oR = parseInt(_orbColHex.slice(1,3),16)||255;
    var _oG = parseInt(_orbColHex.slice(3,5),16)||51;
    var _oB = parseInt(_orbColHex.slice(5,7),16)||0;
    var orbR = s * _orbSz;

    // Precompute face visibility
    var _faceData = faces.map(function(f) {
      var pts = f.idx.map(function(i){ return corners[i]; });
      var v0=pts[0],v1=pts[1],v2=pts[2];
      var ex=v1.x-v0.x, ey=v1.y-v0.y, fx2=v2.x-v0.x, fy2=v2.y-v0.y;
      var cross = ex*fy2 - ey*fx2;
      var isFront = cross <= 0;
      var shade = 0.5;
      if (f.nz) shade = f.nz > 0 ? 0.9 : 0.3;
      if (f.ny) shade = f.ny > 0 ? 0.45 : 0.75;
      if (f.nx) shade = 0.6;
      return { f:f, pts:pts, isFront:isFront, shade:shade };
    });

    function drawFace(fd) {
      var pts=fd.pts, isFront=fd.isFront, shade=fd.shade, f=fd.f;
      var drawShade = isFront ? shade : shade * 0.12;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var pi=1; pi<pts.length; pi++) ctx.lineTo(pts[pi].x, pts[pi].y);
      ctx.closePath();
      if (isFront) {
        ctx.fillStyle = 'rgba(0,200,240,' + (drawShade * 0.08) + ')';
        ctx.fill();
      }
      ctx.strokeStyle = isFront
        ? 'rgba(0,220,255,' + (drawShade * 0.85) + ')'
        : 'rgba(0,180,220,0.10)';
      ctx.lineWidth = isFront ? 1.6 : 0.6;
      if (isFront) { ctx.shadowColor = '#00ffff'; ctx.shadowBlur = drawShade * 10; }
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (isFront && crackAlpha > 0.1) {
        ctx.strokeStyle = 'rgba(255,80,80,' + crackAlpha * drawShade + ')';
        ctx.lineWidth = 0.8; ctx.setLineDash([2,3]);
        ctx.beginPath();
        var cx2=(pts[0].x+pts[2].x)/2, cy2=(pts[0].y+pts[2].y)/2;
        ctx.moveTo(pts[0].x,pts[0].y);
        ctx.lineTo(cx2+(Math.random()-0.5)*4, cy2);
        ctx.lineTo(pts[2].x,pts[2].y);
        ctx.stroke(); ctx.setLineDash([]);
      }
    }

    // PASS 1: back faces
    _faceData.forEach(function(fd) { if (!fd.isFront) drawFace(fd); });

    // PASS 2: orb — sits between back and front faces
    ctx.save();
    ctx.shadowColor = 'rgba('+_oR+','+_oG+','+_oB+',0.9)';
    ctx.shadowBlur = orbR * 3;
    var _og = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR);
    _og.addColorStop(0,   'rgba('+Math.min(255,_oR+100)+','+Math.min(255,_oG+80)+','+Math.min(255,_oB+60)+',1.0)');
    _og.addColorStop(0.4, 'rgba('+_oR+','+_oG+','+_oB+',0.95)');
    _og.addColorStop(0.8, 'rgba('+Math.max(0,_oR-60)+','+Math.max(0,_oG-20)+','+Math.max(0,_oB-20)+',0.7)');
    _og.addColorStop(1,   'rgba('+Math.max(0,_oR-80)+',0,0,0)');
    ctx.fillStyle = _og;
    ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI*2); ctx.fill();
    // Specular highlight
    ctx.shadowBlur = 0;
    var _hl = ctx.createRadialGradient(cx-orbR*0.25, cy-orbR*0.3, 0, cx, cy, orbR*0.7);
    _hl.addColorStop(0, 'rgba(255,255,255,0.5)');
    _hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = _hl;
    ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // PASS 3: front faces — overdraw orb where cube edges are in front
    _faceData.forEach(function(fd) { if (fd.isFront) drawFace(fd); });

    // HP bar — tiny, above cube when damaged
    if (hpFrac < 1 && hpFrac > 0) {
      var barW = s*1.5, barH = 3;
      var barX = cx - barW/2, barY = cy - s - 10;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 1); ctx.fill();
      ctx.fillStyle = hpFrac > 0.5 ? '#00ff88' : (hpFrac > 0.25 ? '#ffaa00' : '#ff3300');
      ctx.beginPath(); ctx.roundRect(barX, barY, barW*hpFrac, barH, 1); ctx.fill();
    }
  }

  _createSplat(wx, wy, nx, ny, brick) {
    var sqSet = (window.Settings && window.Settings.splatter) || {};
    var type     = sqSet.type      || 'goo';
    var coreR    = sqSet.size      || 11;
    var numDrips = Math.round(sqSet.drips    || 3);
    var rawDur   = sqSet.duration  !== undefined ? sqSet.duration : 0;
    var duration = rawDur === 0 ? 999999 : rawDur * 60;  // 0=infinite
    var maxSplats= sqSet.maxSplats !== undefined ? sqSet.maxSplats : 20;
    this.splats  = this.splats || [];
    while (this.splats.length >= maxSplats) this.splats.shift();

    var isCircular = brick && (typeof CircularBrick !== 'undefined') && (brick instanceof CircularBrick);
    var brickW  = (!isCircular && brick) ? (brick.w || 80) : 0;
    var brickH  = (!isCircular && brick) ? (brick.h || 22) : 0;
    var brickRot= (brick && brick._rotation) || 0;
    var brickR  = isCircular ? (brick.r || 22) : 0;

    // Determine which face was hit by converting normal to brick-local space
    var lnx = nx * Math.cos(-brickRot) - ny * Math.sin(-brickRot);
    var lny = nx * Math.sin(-brickRot) + ny * Math.cos(-brickRot);

    // Impact point relative to brick center, in brick-local space
    var offX = brick ? (wx - brick.x) : 0;
    var offY = brick ? (wy - brick.y) : 0;
    if (brick && brickRot) {
      var br = -brickRot;
      var rx2 = offX * Math.cos(br) - offY * Math.sin(br);
      var ry2 = offX * Math.sin(br) + offY * Math.cos(br);
      offX = rx2; offY = ry2;
    }
    // Snap offY to correct edge using local normal direction
    // offX (along brick length) is preserved as the actual impact position
    if (!isCircular && brick && (brickW > 0 || brickH > 0)) {
      var halfShort = Math.min(brickW, brickH) * 0.5;
      var halfLong  = Math.max(brickW, brickH) * 0.5;
      // Determine if hit is on long edge (lny dominant) or short edge (lnx dominant)
      if (Math.abs(lny) >= Math.abs(lnx)) {
        // Top or bottom hit — offY snaps to ±halfShort, offX preserved (clamped to long edge)
        offY = (lny >= 0 ? 1 : -1) * halfShort;
        offX = Math.max(-halfLong, Math.min(halfLong, offX));
      } else {
        // Left or right hit — offX snaps to ±halfLong, offY preserved (clamped to short edge)
        offX = (lnx >= 0 ? 1 : -1) * halfLong;
        offY = Math.max(-halfShort, Math.min(halfShort, offY));
      }
    }

    // Build drips centered at impact point along edge
    var halfLen = isCircular ? brickR * 0.8 : Math.max(brickW, brickH) * 0.5;
    var spread  = Math.min(coreR * 1.4, halfLen * 0.85);
    // hitFromTop = local normal Y is negative (ball came from above in local space)
    var hitFromTop = (lny < -0.3);
    var hitFromBottom = (lny > 0.3);
    var dripArr = [];
    for (var di = 0; di < numDrips; di++) {
      var t = numDrips > 1 ? (di / (numDrips - 1) - 0.5) : 0;
      var localDripX = t * spread * 1.2 + (Math.random()-0.5) * coreR * 0.2;
      // Rotate drip spread offset to world space along the long axis of the brick
      // oy is kept 0 — drips always start at the edge world position (wy) and fall down
      var worldDripX = localDripX * Math.cos(brickRot);
      var worldDripY = localDripX * Math.sin(brickRot);
      dripArr.push({
        ox: worldDripX,
        oy: worldDripY,  // lateral offset along edge in world space (not vertical)
        startBelow: !hitFromTop,  // true = drip hangs below edge; false = starts at edge
        vy: 0.5 + Math.random() * 0.6,
        len: coreR * (0.8 + Math.random() * 1.0),
        age: 0, maxAge: 100 + Math.random() * 80,
        r: 2.5 + Math.random() * 2.5,
        hitFromTop: hitFromTop,
      });
    }

    this.splats.push({
      wx: wx, wy: wy, offX: offX, offY: offY,
      nx: nx, ny: ny, lnx: lnx, lny: lny,
      brick: brick || null,
      isCircular: isCircular,
      brickW: brickW, brickH: brickH, brickR: brickR, brickRot: brickRot,
      hitFromTop: hitFromTop, hitFromBottom: hitFromBottom,
      type: type, coreR: coreR, spread: spread,
      // Wall/ball splats fade faster than brick splats
      timer: brick ? duration : Math.min(duration, 8 * 60),
      maxTimer: brick ? duration : Math.min(duration, 8 * 60),
      drips: dripArr,
    });

    if (window.Sound && Sound.getCtx) {
      var sc3 = Sound.getCtx();
      if (sc3) {
        var g3s = sc3.createGain(); g3s.connect(sc3.destination);
        g3s.gain.setValueAtTime(0.28, sc3.currentTime);
        g3s.gain.exponentialRampToValueAtTime(0.001, sc3.currentTime + 0.35);
        var o3 = sc3.createOscillator(); o3.connect(g3s);
        o3.type = 'sawtooth';
        o3.frequency.setValueAtTime(90, sc3.currentTime);
        o3.frequency.exponentialRampToValueAtTime(30, sc3.currentTime + 0.35);
        o3.start(sc3.currentTime); o3.stop(sc3.currentTime + 0.35);
      }
    }
  }

  _updateSplats(dt) {
    if (!this.splats) return;
    for (var i = this.splats.length - 1; i >= 0; i--) {
      var sp = this.splats[i];
      sp.timer--;
      if (sp.timer <= 0) { this.splats.splice(i, 1); continue; }
      // Update drips
      if (sp.drips) {
        for (var di = 0; di < sp.drips.length; di++) {
          var d = sp.drips[di];
          d.age++;
          d.oy += d.vy;
          d.vy += 0.04;  // gravity on drip
          d.len = Math.max(0, d.len - 0.03);
        }
      }
    }
  }

  _drawSplats() {
    if (!this.splats || this.splats.length === 0) return;
    var ctx = this.ctx;

    var PAL = {
      dead:  { core:'#cc7722', hi:'#ffcc66', lo:'#441100', glow:'#ff8833', bulb:'#ff9944' },
      boost: { core:'#ddcc00', hi:'#ffff88', lo:'#554400', glow:'#ffee00', bulb:'#ffdd22' },
      goo:   { core:'#44bb11', hi:'#aaff55', lo:'#0a2200', glow:'#66ff22', bulb:'#55dd22' },
    };

    function hexRGB(h) { return [parseInt(h.slice(1,3),16)||0,parseInt(h.slice(3,5),16)||0,parseInt(h.slice(5,7),16)||0]; }
    function rgba(h, a) { var c=hexRGB(h); return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a.toFixed(3)+')'; }

    for (var si = 0; si < this.splats.length; si++) {
      var sp = this.splats[si];
      var pal = PAL[sp.type] || PAL.goo;
      var brot = (sp.brick && sp.brick._rotation) || 0;

      // World position of splat (impact point on brick edge)
      var wx = sp.brick
        ? sp.brick.x + sp.offX * Math.cos(brot) - sp.offY * Math.sin(brot)
        : sp.wx;
      var wy = sp.brick
        ? sp.brick.y + sp.offX * Math.sin(brot) + sp.offY * Math.cos(brot)
        : sp.wy;

      var fadeIn  = Math.min(1, (sp.maxTimer - sp.timer) / 6);
      var fadeOut = Math.min(1, sp.timer / Math.min(sp.maxTimer * 0.25, 35));
      var alpha   = fadeIn * fadeOut;
      if (alpha <= 0.01) continue;

      var cr   = sp.coreR;
      var spread = sp.spread || cr * 1.4;

      // lny in current brick space (brick may have rotated since splat was created)
      var lny2 = sp.lny !== undefined ? sp.lny : 1;
      var hitFromTop = sp.hitFromTop;

      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(brot);  // align X axis with brick long axis

      // Detect short-edge hit and rotate 90° so splat spreads along that edge
      var _hitShort = false;
      if (!sp.isCircular && sp.brickW > 0 && sp.brickH > 0) {
        var _absLnx = Math.abs(sp.lnx || 0), _absLny = Math.abs(sp.lny || 1);
        var _bw = sp.brickW, _bh = sp.brickH;
        // For any brick: short edge hit = normal mostly along long axis direction
        // Long axis is X in local space. If |lnx| > |lny|, ball hit the end caps.
        _hitShort = (_absLnx > _absLny);
        if (_hitShort) {
          ctx.rotate(Math.PI / 2);
          // Spread along short edge (the height of the brick)
          spread = Math.min(cr * 1.4, Math.min(_bw, _bh) * 0.48);
          // After 90° rotate, lny2 swaps meaning — use lnx sign for normalSign
          lny2 = -(sp.lnx || 1);  // flip to get correct inward direction
        }
      }

      // In rotated local space:
      // X = along brick length, Y = away from surface (in direction of normal)
      // For bottom hit: normal points down (+Y world) → goo extends upward (-Y local = into brick)
      //   and droops downward (+Y local = free space)
      // For top hit: normal points up (-Y world) → goo extends downward (+Y local = into brick)
      //   and drips fall over the brick face (also +Y local but limited by brick width)

      var numPts = 22;
      var seed   = si * 7.3;

      // Profile: height of goo at each X position (distance from edge, going INTO surface)
      var maxIn   = 4;   // max pixels goo creeps onto brick face
      var droopOut= 3;   // max pixels goo hangs off edge (free space side)
      var profile = [];
      for (var pi2 = 0; pi2 <= numPts; pi2++) {
        var t2    = pi2 / numPts;
        var xPos  = (t2 - 0.5) * spread * 2;
        var env   = Math.pow(Math.max(0, 1 - Math.abs(xPos) / spread), 0.55);
        var noise = 0.5 + 0.5 * Math.sin(t2 * 11.3 + seed) * Math.sin(t2 * 7.1 + seed * 1.7);
        profile.push({ x: xPos, h: env * maxIn * (0.5 + 0.5 * noise), env: env });
      }

      if (sp.isCircular && sp.brickR > 0) {
        // Arc splat for circular bricks
        var arcR = sp.brickR;
        var impAngle = Math.atan2(sp.ny, sp.nx);
        var arcSpread = spread / arcR;
        ctx.restore(); ctx.save();
        var cx2 = wx - sp.nx * arcR, cy2 = wy - sp.ny * arcR;
        for (var lay = 0; lay < 3; lay++) {
          var la2 = alpha * [0.45,0.75,0.92][lay];
          var lIn  = arcR - [cr*0.1, 0, -cr*0.15][lay];
          var lOut = arcR + [droopOut+2, droopOut, 1][lay];
          var lSp  = arcSpread * [1.0, 0.72, 0.45][lay];
          var lCol = [pal.lo, pal.core, pal.hi][lay];
          ctx.beginPath();
          ctx.arc(cx2, cy2, lOut, impAngle-lSp, impAngle+lSp);
          ctx.arc(cx2, cy2, lIn,  impAngle+lSp, impAngle-lSp, true);
          ctx.closePath();
          ctx.fillStyle = rgba(lCol, la2);
          if (lay===2){ctx.shadowColor=pal.glow;ctx.shadowBlur=5;}
          ctx.fill(); ctx.shadowBlur=0;
        }
      } else {
        // Rectangular / wall splat
        // Sign of Y: normal in local space
        // lny2 > 0 means normal points in +local-Y (bottom hit: goo droops in +Y = down)
        // lny2 < 0 means normal points in -local-Y (top hit: goo droops in -Y but brick is there)
        var normalSign = (lny2 >= 0) ? 1 : -1;  // +1 = bottom hit, -1 = top hit

        // For top hit, "inward" means toward +Y (down, into brick face)
        // "outward" means toward -Y (up, above brick = free space above... wait, that's above the brick)
        // Actually for top hit: ball came from ABOVE, so surface is the TOP face
        // Inward = into brick (+Y down), outward = above brick (-Y up, free space)
        // BUT we want drips to go DOWN over the brick face
        // So for top hit: drips go in +Y direction (downward), covering the brick face

        // Draw 3 color layers
        for (var layer2 = 0; layer2 < 3; layer2++) {
          var la3 = alpha * [0.55, 0.85, 0.72][layer2];
          var inMult  = [0.45, 1.0, 0.6][layer2];
          var outMult = [1.3, 1.0, 0.45][layer2];
          var lCol2   = [pal.lo, pal.core, pal.hi][layer2];

          ctx.beginPath();
          // Outer edge (away from brick surface = drooping/free side)
          // For bottom hit: outward = +Y. For top hit: outward = -Y.
          ctx.moveTo(profile[0].x, normalSign * droopOut * outMult * 0.3);
          for (var pi3 = 0; pi3 <= numPts; pi3++) {
            var pt = profile[pi3];
            var dh = pt.h > 0.5 ? droopOut * outMult * Math.pow(pt.h / maxIn, 0.65) : droopOut * outMult * 0.12;
            ctx.lineTo(pt.x, normalSign * dh);
          }
          // Inner edge (into brick face)
          for (var pi4 = numPts; pi4 >= 0; pi4--) {
            var pt2 = profile[pi4];
            ctx.lineTo(pt2.x, -normalSign * pt2.h * inMult);
          }
          ctx.closePath();
          ctx.fillStyle = rgba(lCol2, la3);
          if (layer2===1){ctx.shadowColor=pal.glow;ctx.shadowBlur=6;}
          ctx.fill(); ctx.shadowBlur=0;
        }

        // Impact streaks
        var numSt = 3 + (si % 3);
        for (var sti = 0; sti < numSt; sti++) {
          var stA = (sti/numSt - 0.5) * Math.PI * 0.85;
          var stLen = spread * (0.5 + 0.5*Math.sin(sti*1.9+seed));
          ctx.beginPath();
          ctx.moveTo(Math.cos(stA)*cr*0.08, Math.sin(stA)*cr*0.04*normalSign);
          ctx.lineTo(Math.cos(stA)*stLen, Math.sin(stA)*stLen*0.15*normalSign);
          ctx.strokeStyle=rgba(pal.core, alpha*0.5);
          ctx.lineWidth=1+Math.sin(sti)*0.7; ctx.lineCap='round'; ctx.stroke();
        }

        // Specular dot
        ctx.beginPath();
        ctx.arc(-spread*0.1, -normalSign * maxIn * 0.3, cr * 0.1, 0, Math.PI*2);
        ctx.fillStyle = rgba(pal.hi, alpha * 0.7); ctx.fill();

        // Globule drips — drawn in WORLD space so they always hang downward
        // We'll draw these after ctx.restore() using world coords
      }

      ctx.restore();

      // ── Globule drips in world space (always hang downward) ──────────────
      if (!sp.isCircular && sp.brickW > 0) {
        var _numG = 2 + Math.floor(spread / 16);
        var _brot2 = brot + (_hitShort ? Math.PI/2 : 0);
        for (var _gi = 0; _gi < _numG; _gi++) {
          var _gt = _numG > 1 ? (_gi/(_numG-1) - 0.5) : 0;
          // Position along edge in world space
          var _gLocalX = _gt * spread * 1.25 + (Math.random()-0.5)*spread*0.15;
          var _gpx = wx + _gLocalX * Math.cos(_brot2);
          var _gpy = wy + _gLocalX * Math.sin(_brot2);
          var _env4 = Math.pow(Math.max(0, 1 - Math.abs(_gLocalX)/spread), 0.5);
          if (_env4 < 0.1) continue;
          var _gsz = (2 + _env4 * 4.5) * (0.7 + 0.3*Math.sin(_gi*2.9+seed));
          // Stem going straight down
          var _stemY = _gsz * 1.1;
          ctx.beginPath();
          ctx.moveTo(_gpx, _gpy);
          ctx.lineTo(_gpx + (Math.random()-0.5)*_gsz*0.3, _gpy + _stemY);
          ctx.lineWidth = _gsz * 0.4;
          ctx.strokeStyle = rgba(pal.core, alpha * 0.65 * _env4);
          ctx.lineCap = 'round'; ctx.stroke();
          // Teardrop bulb at bottom
          ctx.beginPath();
          ctx.ellipse(_gpx, _gpy + _stemY + _gsz*0.5, _gsz*0.5, _gsz*0.75, 0, 0, Math.PI*2);
          ctx.fillStyle = rgba(pal.bulb, alpha * 0.85 * _env4);
          ctx.shadowColor = pal.glow; ctx.shadowBlur = 3;
          ctx.fill(); ctx.shadowBlur = 0;
        }
      }

      // Falling drips in world space (for bottom hits = dangle free; top hits = fall over brick)
      for (var di2 = 0; di2 < sp.drips.length; di2++) {
        var d2   = sp.drips[di2];
        var dAge = Math.min(1, d2.age / d2.maxAge);
        var dAlpha = alpha * (1 - dAge * dAge);
        if (dAlpha <= 0.02) continue;
        // Drip X = lateral offset along edge, Y = start at edge world position
        var dpx = wx + d2.ox;
        // For top hit: drip starts at wy (top edge) and falls DOWN (positive Y)
        // For bottom hit: drip starts at wy (bottom edge) and falls DOWN
        // Always start at the surface edge, always fall downward
        var dpy = wy;  // wy is already the world edge position
        var stemLen = d2.len * dAlpha;
        if (stemLen > 1.5) {
          var sg = ctx.createLinearGradient(dpx, dpy, dpx, dpy + stemLen);
          sg.addColorStop(0, rgba(pal.core, dAlpha * 0.9));
          sg.addColorStop(0.6, rgba(pal.core, dAlpha * 0.45));
          sg.addColorStop(1, rgba(pal.lo, 0));
          ctx.beginPath();
          ctx.moveTo(dpx - d2.r*0.3, dpy);
          ctx.quadraticCurveTo(dpx + d2.r*0.2, dpy + stemLen*0.5, dpx, dpy + stemLen);
          ctx.lineWidth = d2.r * (1 - dAge * 0.5);
          ctx.strokeStyle = sg; ctx.lineCap = 'round'; ctx.stroke();
        }
        var bulbR3 = d2.r * (0.6 + 0.4*Math.sin(d2.age*0.22)) * dAlpha;
        if (bulbR3 > 0.8) {
          ctx.shadowColor = pal.glow; ctx.shadowBlur = 3;
          ctx.beginPath();
          ctx.ellipse(dpx, dpy+stemLen+bulbR3*0.4, bulbR3*0.6, bulbR3, 0, 0, Math.PI*2);
          ctx.fillStyle = rgba(pal.bulb, dAlpha * 0.9); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }
  }

  _chuteGeom() {
    var W        = this.W;
    var floorY   = this.floorY();
    var CHUTE_W  = 46;
    var TURN_R   = 30;
    var LEFT_X   = W - CHUTE_W;
    var CENTER_X = W - CHUTE_W / 2;
    var TOP_Y    = 140;  // shaft starts here; cap drawn above this
    var DIAG_Y   = TOP_Y;
    return { W, floorY, CHUTE_W, TURN_R, LEFT_X, CENTER_X, TOP_Y, DIAG_Y };
  }

  // Called from physics loop — enforce left wall as hard boundary
  _enforceChuteWall() {
    var g = this._chuteGeom();
    for (var i = 0; i < this.objects.length; i++) {
      var obj = this.objects[i];
      if (obj.dead || obj._inChute) continue;
      // Only enforce below the diagonal start — above that, full screen width is open
      if (obj.y < g.TOP_Y + 30) continue;  // allow some overlap at top
      if (obj.x + obj.r > g.LEFT_X) {
        obj.x = g.LEFT_X - obj.r;
        if (obj.vx > 0) {
          obj.vx = -obj.vx * 0.65;
          if (window.Sound && Math.abs(obj.vx) > 1.5) Sound.wallClick(Math.abs(obj.vx));
        }
      }
    }
  }

  _updateChute(dt) {
    var g       = this._chuteGeom();
    var shaftCX = g.CENTER_X;
    var topY    = g.TOP_Y;
    var turnR   = g.TURN_R;
    var floorY  = g.floorY;
    var leftX   = g.LEFT_X;

    // Drain queue: drop next ball as soon as shaft is clear
    while (this._chuteQueue && this._chuteQueue.length > 0) {
      var shaftBusy = false;
      if (this._chuteActive) {
        for (var ci = 0; ci < this._chuteActive.length; ci++) {
          if (this._chuteActive[ci]._inChute === 'down') { shaftBusy = true; break; }
        }
      }
      if (shaftBusy) break;
      var type = this._chuteQueue.shift();
      var ball = this._makeBall(type, shaftCX);
      ball.x = shaftCX; ball.y = topY;
      ball.vy = 5; ball.vx = 0;
      ball.inFlight   = true;
      ball._inChute   = 'down';
      ball._fromChute = true;
      this._chuteActive = this._chuteActive || [];
      this._chuteActive.push(ball);
      if (window.Sound) Sound.chuteSlide();
    }

    if (!this._chuteActive) return;
    var toRelease = [];

    for (var i = this._chuteActive.length - 1; i >= 0; i--) {
      var b = this._chuteActive[i];

      if (b._inChute === 'down') {
        b.vy = Math.min(b.vy + 0.35, 8);
        b.y += b.vy;
        b.x  = shaftCX;
        // Start arc when ball enters the curve zone
        if (b.y >= floorY - turnR) {
          b.y          = floorY - turnR;
          b._inChute   = 'turn';
          b._turnAngle = 0;
          b._turnSpeed = Math.min(b.vy * 0.06, 0.12);
          b.vy = 0; b.vx = 0;
        }

      } else if (b._inChute === 'turn') {
        // Quadratic bezier animation: from (shaftCX, floorY-turnR) → (leftX-turnR, floorY)
        // Control point at corner (leftX, floorY)
        b._turnAngle += b._turnSpeed + 0.055;
        if (b._turnAngle > 1) b._turnAngle = 1;
        var t  = b._turnAngle;
        var mt = 1 - t;
        // P0 = start, P1 = control, P2 = end
        var p0x = shaftCX,       p0y = floorY - turnR;
        var p1x = leftX,          p1y = floorY;
        var p2x = leftX - turnR,  p2y = floorY - b.r;
        b.x = mt*mt*p0x + 2*mt*t*p1x + t*t*p2x;
        b.y = mt*mt*p0y + 2*mt*t*p1y + t*t*p2y;

        if (b._turnAngle >= 1) {
          b._inChute = 'exit';
          b.x = p2x;
          b.y = p2y;
          var minV = (leftX * 0.25) / 28;
          var maxV = (leftX * 0.80) / 20;
          b.vx = -(minV + Math.random() * (maxV - minV));
          b.vy = -(0.5 + Math.random() * 1.0);
          // Give trapdoor angular velocity to swing open (CCW)
          this._trapdoorAngV = 0.18;  // positive = outward (CCW from vertical)
          if (window.Sound) Sound.chuteExit();
        }

      } else if (b._inChute === 'exit') {
        b._inChute = null;
        b.inFlight = true;
        toRelease.push(i);
      }
    }

    for (var k = 0; k < toRelease.length; k++) {
      var ball2 = this._chuteActive.splice(toRelease[k], 1)[0];
      this.objects.push(ball2);
      this.ui.attachObjects(this.objects);
    }
  }

  _chuteDropBall(type) {
    var onField = this.objects.filter(function(o) { return !o.dead; }).length
                + (this._chuteActive ? this._chuteActive.length : 0)
                + (this._chuteQueue  ? this._chuteQueue.length  : 0);
    if (onField >= 15) return;  // max 15
    this._chuteQueue = this._chuteQueue || [];
    this._chuteQueue.push(type);
  }

  _toggleDeleteMode() { this._deleteMode = !this._deleteMode; }

  _tryDeleteBall(px, py) {
    if (!this._deleteMode) return false;
    var best = null, bestDist = 9999;
    for (var i = 0; i < this.objects.length; i++) {
      var obj = this.objects[i];
      if (obj.dead || obj.exploded) continue;
      var d = Math.hypot(px - obj.x, py - obj.y);
      if (d < obj.r + 14 && d < bestDist) { bestDist = d; best = i; }
    }
    if (best !== null) {
      var obj2 = this.objects[best];
      Physics.spawnSparks(this.sparks, obj2.x, obj2.y, '#ff4444', 18);
      if (window.Sound) Sound.thud(10);
      this.objects.splice(best, 1);
      this.ui.attachObjects(this.objects);
      return true;
    }
    return false;
  }

  _drawChute() {
    var ctx   = this.ctx;
    var g     = this._chuteGeom();
    var W     = g.W, floorY = g.floorY;
    var leftX = g.LEFT_X, turnR = g.TURN_R, topY = g.TOP_Y;
    var CW    = g.CHUTE_W;

    ctx.save();

    // ── 3D TUBE BODY ─────────────────────────────────────────────────────────
    // Dark fill with edge gradients to simulate cylindrical depth
    var shaftH = floorY - topY;
    var edgeW  = Math.floor(CW * 0.20);

    // Left dark edge
    var gL = ctx.createLinearGradient(leftX, 0, leftX + edgeW, 0);
    gL.addColorStop(0,   'rgba(0,4,14,0.90)');
    gL.addColorStop(0.6, 'rgba(0,18,45,0.55)');
    gL.addColorStop(1,   'rgba(0,18,45,0.00)');
    ctx.fillStyle = gL;
    ctx.fillRect(leftX, topY, edgeW, shaftH);

    // Right dark edge
    var gR = ctx.createLinearGradient(W - edgeW, 0, W, 0);
    gR.addColorStop(0,   'rgba(0,18,45,0.00)');
    gR.addColorStop(0.4, 'rgba(0,18,45,0.55)');
    gR.addColorStop(1,   'rgba(0,4,14,0.90)');
    ctx.fillStyle = gR;
    ctx.fillRect(W - edgeW, topY, edgeW, shaftH);

    // Center body fill
    ctx.fillStyle = 'rgba(0,12,32,0.48)';
    ctx.fillRect(leftX + edgeW, topY, CW - edgeW * 2, shaftH);

    // Left inner gloss streak (near-side of tube catches light)
    var gG = ctx.createLinearGradient(leftX + 3, 0, leftX + 3 + Math.floor(CW * 0.22), 0);
    gG.addColorStop(0,   'rgba(140,220,255,0.00)');
    gG.addColorStop(0.35,'rgba(160,235,255,0.22)');
    gG.addColorStop(1,   'rgba(100,200,255,0.00)');
    ctx.fillStyle = gG;
    ctx.fillRect(leftX + 3, topY, Math.floor(CW * 0.22), shaftH);

    // Faint right-side secondary gloss (rim light on far side)
    var gG2 = ctx.createLinearGradient(W - Math.floor(CW * 0.18), 0, W, 0);
    gG2.addColorStop(0,   'rgba(80,160,220,0.00)');
    gG2.addColorStop(0.6, 'rgba(80,160,220,0.10)');
    gG2.addColorStop(1,   'rgba(80,160,220,0.00)');
    ctx.fillStyle = gG2;
    ctx.fillRect(W - Math.floor(CW * 0.18), topY, Math.floor(CW * 0.18), shaftH);

    // Tube collar rings — horizontal bands like pipe segments
    ctx.strokeStyle = 'rgba(0,180,255,0.18)';
    ctx.lineWidth   = 1;
    for (var ry = topY + 60; ry < floorY - turnR - 10; ry += 80) {
      ctx.beginPath(); ctx.moveTo(leftX, ry); ctx.lineTo(W, ry); ctx.stroke();
    }

    // ── LEFT WALL — diagonal top, straight shaft down to floor ─────────────
    var diagEndX = W;
    var diagEndY = topY - (W - leftX);
    if (diagEndY < 0) diagEndY = 0;

    ctx.strokeStyle = 'rgba(0,200,255,0.85)';
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur  = 10;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // ── TRAPDOOR — pivot above the curve, door swings open when ball exits
    var pivotY   = floorY - turnR - 4;  // pivot just above the curved bottom
    this._tdPivotY = pivotY;     // store for button layout — buttons end here

    // Trapdoor angular physics
    if (this._trapdoorAngle === undefined) this._trapdoorAngle = 0;
    if (this._trapdoorAngV  === undefined) this._trapdoorAngV  = 0;

    // Ball–trapdoor interaction
    var doorLen0 = floorY - pivotY;
    var tdCos0 = Math.cos(this._trapdoorAngle), tdSin0 = Math.sin(this._trapdoorAngle);
    for (var tdi = 0; tdi < this.objects.length; tdi++) {
      var tBall = this.objects[tdi];
      if (tBall.dead || tBall._inChute) continue;
      // Closest point on door segment to ball
      var tdRelX = tBall.x - leftX, tdRelY = tBall.y - pivotY;
      var segX0 = -tdSin0 * doorLen0, segY0 = tdCos0 * doorLen0;
      var proj0 = Math.max(0, Math.min(1, (tdRelX * segX0 + tdRelY * segY0) / (doorLen0 * doorLen0)));
      var cpX0 = leftX + proj0 * segX0, cpY0 = pivotY + proj0 * segY0;
      var dTD0 = Math.hypot(tBall.x - cpX0, tBall.y - cpY0);
      if (dTD0 < tBall.r + 2.5) {
        var tdNX0 = (tBall.x - cpX0) / (dTD0 || 1), tdNY0 = (tBall.y - cpY0) / (dTD0 || 1);
        tBall.x += tdNX0 * (tBall.r + 2.5 - dTD0);
        tBall.y += tdNY0 * (tBall.r + 2.5 - dTD0);
        var relV0 = tBall.vx * (-tdNX0) + tBall.vy * (-tdNY0);
        if (relV0 > 0) { tBall.vx += tdNX0 * relV0 * 1.3; tBall.vy += tdNY0 * relV0 * 1.3; }
        // Angular impulse on door
        var armX0 = cpX0 - leftX, armY0 = cpY0 - pivotY;
        this._trapdoorAngV += (armX0 * (-tdNY0) - armY0 * (-tdNX0)) * (-relV0) * 0.05;
      }
    }
    // Integrate
    this._trapdoorAngV *= 0.85;
    this._trapdoorAngV -= this._trapdoorAngle * 0.07;  // spring back
    this._trapdoorAngle += this._trapdoorAngV;
    // Clamp: 0 = closed (vertical), positive = open outward (left), small negative = slightly inward
    if (this._trapdoorAngle > Math.PI * 0.52) { this._trapdoorAngle = Math.PI * 0.52; this._trapdoorAngV *= -0.25; }
    if (this._trapdoorAngle < -0.15) { this._trapdoorAngle = -0.15; this._trapdoorAngV *= -0.25; }
    var tdA     = this._trapdoorAngle;
    var doorLen = doorLen0;

    // Door tip: closed = (leftX, floorY); open swings CCW (leftward)
    var tdTipX  = leftX  - Math.sin(tdA) * doorLen;
    var tdTipY  = pivotY + Math.cos(tdA) * doorLen;

    // Upper fixed wall: diagonal → straight down to pivot (always fixed)
    ctx.beginPath();
    ctx.moveTo(diagEndX, diagEndY);
    ctx.lineTo(leftX, topY);
    ctx.lineTo(leftX, pivotY);
    ctx.stroke();

    // Lower door segment (pivots from pivotY)
    ctx.beginPath();
    ctx.moveTo(leftX, pivotY);
    ctx.lineTo(tdTipX, tdTipY);
    ctx.stroke();

    // Store pivot Y for physics (read in _loop before _drawChute is called next frame)
    this._tdPivotY = pivotY;
    // Permanent hinge dot at pivot
    ctx.beginPath(); ctx.arc(leftX, pivotY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,220,255,0.85)';
    ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 6;
    ctx.fill(); ctx.shadowBlur = 0;

    // Inner depth line
    ctx.strokeStyle = 'rgba(0,140,200,0.30)';
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 2;
    var innerOff = 4;
    ctx.beginPath();
    ctx.moveTo(diagEndX - innerOff, diagEndY + innerOff);
    ctx.lineTo(leftX + innerOff, topY + innerOff);
    ctx.lineTo(leftX + innerOff, pivotY);
    // Door inner line follows angle
    ctx.lineTo(tdTipX + Math.cos(tdA) * innerOff, tdTipY + Math.sin(tdA) * innerOff);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── RIGHT WALL ────────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0,140,210,0.30)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(W, topY);
    ctx.lineTo(W, floorY);
    ctx.stroke();

    // ── BALL GENERATOR CAP — redesigned ─────────────────────────────────────
    var capH   = 70;                 // tall cap, sits above BRICKS/BALLS/TUBES tabs
    var capY   = topY - capH;
    var capX   = leftX;
    var capW   = CW;
    var cMid   = capX + capW / 2;
    var cFrame = this.frame;

    // ── Hazard stripe right wall ──────────────────────────────────────────────
    var stripeW = 7;
    var stripeH = capH + 18;
    var stripeY = capY - 4;
    ctx.save();
    ctx.beginPath(); ctx.rect(W - stripeW, stripeY, stripeW, stripeH); ctx.clip();
    // 45° diagonal stripes on right wall
    var ds2 = 10;
    for (var si2 = -stripeH * 2; si2 < stripeH * 2; si2 += ds2 * 2) {
      ctx.fillStyle = 'rgba(255,200,0,0.85)';
      ctx.beginPath();
      ctx.moveTo(W - stripeW, stripeY + si2);
      ctx.lineTo(W, stripeY + si2 - stripeW);
      ctx.lineTo(W, stripeY + si2 - stripeW + ds2);
      ctx.lineTo(W - stripeW, stripeY + si2 + ds2);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,180,255,0.4)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(W - stripeW, stripeY); ctx.lineTo(W - stripeW, stripeY + stripeH); ctx.stroke();

    // ── Cap body — sharp corners flush to chute edges ────────────────────────
    ctx.fillStyle = 'rgba(4,14,34,0.96)';
    ctx.beginPath(); ctx.rect(capX, capY, capW - stripeW, capH); ctx.fill();
    ctx.strokeStyle = 'rgba(0,200,255,0.80)';
    ctx.lineWidth   = 1.8;
    ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.rect(capX, capY, capW - stripeW, capH); ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Horizontal hazard band (side-view gear zone) ──────────────────────────
    var hazH  = 10;
    var hazY  = capY + capH - hazH;  // flush with cap/chute seam
    ctx.save();
    ctx.beginPath(); ctx.rect(capX + 1, hazY, capW - stripeW - 2, hazH); ctx.clip();
    // 45° diagonal stripes on horizontal hazard band
    var hStripe = 8;
    for (var hi = -hazH * 2; hi < capW + hazH; hi += hStripe * 2) {
      ctx.fillStyle = 'rgba(255,200,0,0.65)';
      ctx.beginPath();
      ctx.moveTo(capX + hi, hazY);
      ctx.lineTo(capX + hi + hazH, hazY);
      ctx.lineTo(capX + hi + hazH - hazH, hazY + hazH);
      ctx.lineTo(capX + hi - hazH, hazY + hazH);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,200,255,0.45)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(capX, hazY); ctx.lineTo(capX + capW - stripeW, hazY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(capX, hazY + hazH); ctx.lineTo(capX + capW - stripeW, hazY + hazH); ctx.stroke();

    // ── Side-view edge gear (rotates horizontally inside the hazard band) ─────
    // Appears as a circle with small rectangular teeth on top and bottom rim,
    // squashed vertically to suggest side-on perspective
    var sGearCX = cMid;
    var sGearCY = hazY + hazH / 2;
    var sGearRX = (capW - stripeW) / 2 - 6;  // wide (horizontal)
    var sGearRY = 3.5;                         // shallow (side-on)
    var sGearTeeth = 10;
    var sGearAngle = (cFrame * 0.035) % (Math.PI * 2);
    ctx.save();
    ctx.beginPath(); ctx.rect(capX + 1, hazY, capW - stripeW - 2, hazH); ctx.clip();
    ctx.strokeStyle = 'rgba(0,200,255,0.55)'; ctx.lineWidth = 1;
    // Ellipse body
    ctx.beginPath(); ctx.ellipse(sGearCX, sGearCY, sGearRX, sGearRY, 0, 0, Math.PI * 2); ctx.stroke();
    // Teeth: small vertical bumps on top and bottom of ellipse
    for (var st = 0; st < sGearTeeth; st++) {
      var sAngle = sGearAngle + (st / sGearTeeth) * Math.PI * 2;
      var tx3 = sGearCX + Math.cos(sAngle) * sGearRX;
      var toothH2 = 2.5 * Math.abs(Math.sin(sAngle)); // perspective: taller at sides
      ctx.beginPath();
      ctx.moveTo(tx3, sGearCY - sGearRY - toothH2);
      ctx.lineTo(tx3, sGearCY - sGearRY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tx3, sGearCY + sGearRY);
      ctx.lineTo(tx3, sGearCY + sGearRY + toothH2);
      ctx.stroke();
    }
    ctx.restore();

    // ── Top-down gears (left and right, proper tooth shapes) ─────────────────
    var gearAreaH = hazY - capY;
    var gearCY2   = capY + gearAreaH / 2;
    var gearR2    = Math.min(9, (capW - stripeW) / 4 - 1);
    var teeth2    = 8;
    var toothLen  = 3.5;
    var toothW    = 0.55;   // half-angle of tooth base in radians

    function drawGear(gx, gy, r, angle, col) {
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 1.1;
      ctx.shadowColor = col; ctx.shadowBlur = 5;
      // Hub circle
      ctx.beginPath(); ctx.arc(gx, gy, r * 0.38, 0, Math.PI * 2); ctx.stroke();
      // Rim + teeth
      ctx.beginPath();
      for (var tooth = 0; tooth < teeth2; tooth++) {
        var baseA1 = angle + (tooth / teeth2) * Math.PI * 2 - toothW;
        var baseA2 = angle + (tooth / teeth2) * Math.PI * 2 + toothW;
        var tipA   = angle + (tooth / teeth2) * Math.PI * 2;
        var tipR   = r + toothLen;
        // Move to base arc start
        if (tooth === 0) ctx.moveTo(gx + Math.cos(baseA1)*r, gy + Math.sin(baseA1)*r);
        else ctx.arc(gx, gy, r, baseA1 - toothW * 0.5, baseA1, false);
        // Tooth sides: up to tip, across, back down
        ctx.lineTo(gx + Math.cos(baseA1)*tipR*0.85, gy + Math.sin(baseA1)*tipR*0.85);
        ctx.arc(gx, gy, tipR, baseA1, baseA2, false);
        ctx.lineTo(gx + Math.cos(baseA2)*r, gy + Math.sin(baseA2)*r);
      }
      ctx.closePath();
      // Fill gear body
      ctx.fillStyle = 'rgba(0,30,60,0.7)'; ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    var gAngleL = (cFrame * 0.045) % (Math.PI * 2);
    var gAngleR = -(cFrame * 0.045) % (Math.PI * 2) + Math.PI / teeth2;
    var gearLX2 = capX + (capW - stripeW) * 0.28;
    var gearRX2 = capX + (capW - stripeW) * 0.72;
    drawGear(gearLX2, gearCY2, gearR2, gAngleL, 'rgba(0,180,255,0.80)');
    drawGear(gearRX2, gearCY2, gearR2, gAngleR, 'rgba(0,180,255,0.80)');

    // ── Center energy core ────────────────────────────────────────────────────
    var corePulse2 = 0.5 + 0.5 * Math.sin(cFrame * 0.18);
    var coreR2 = 3.5 + corePulse2 * 1.8;
    var gCore2 = ctx.createRadialGradient(cMid, gearCY2, 0, cMid, gearCY2, coreR2 + 5);
    gCore2.addColorStop(0, 'rgba(0,255,200,' + (0.8 + corePulse2 * 0.2) + ')');
    gCore2.addColorStop(1, 'rgba(0,80,180,0.00)');
    ctx.fillStyle = gCore2;
    ctx.beginPath(); ctx.arc(cMid, gearCY2, coreR2 + 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(180,255,245,' + (0.9 + corePulse2 * 0.1) + ')';
    ctx.beginPath(); ctx.arc(cMid, gearCY2, coreR2 * 0.3, 0, Math.PI * 2); ctx.fill();

    // ── Pistons — on top, pointing upward ────────────────────────────────────
    // Two pistons with alternating phase, tall enough to hit a ball above the cap
    var pistonW    = 5;
    var pistonMaxH = 18;   // maximum extension above cap top
    var pistonMinH = 6;
    var phase1 = Math.sin(cFrame * 0.14);              // piston 1
    var phase2 = Math.sin(cFrame * 0.14 + Math.PI);    // piston 2 (opposite)
    var piston1H = pistonMinH + (phase1 * 0.5 + 0.5) * (pistonMaxH - pistonMinH);
    var piston2H = pistonMinH + (phase2 * 0.5 + 0.5) * (pistonMaxH - pistonMinH);
    var piston1X = capX + (capW - stripeW) * 0.32;
    var piston2X = capX + (capW - stripeW) * 0.68;

    // Store piston positions for physics hit detection
    this._pistonY1 = capY - piston1H;
    this._pistonY2 = capY - piston2H;
    this._piston1X = piston1X;
    this._piston2X = piston2X;
    this._pistonCapY = capY;

    [{ px: piston1X, pH: piston1H, phase: phase1 },
     { px: piston2X, pH: piston2H, phase: phase2 }].forEach(function(p) {
      var px4 = p.px, ph4 = p.pH;
      var tipY = capY - ph4;
      // Shaft — two-tone gradient
      var shaftGrad = ctx.createLinearGradient(px4 - pistonW/2, 0, px4 + pistonW/2, 0);
      shaftGrad.addColorStop(0,   'rgba(0,80,140,0.90)');
      shaftGrad.addColorStop(0.4, 'rgba(0,160,255,0.75)');
      shaftGrad.addColorStop(1,   'rgba(0,50,100,0.90)');
      ctx.fillStyle = shaftGrad;
      ctx.beginPath(); ctx.roundRect(px4 - pistonW/2, tipY, pistonW, ph4, [3,3,0,0]); ctx.fill();
      ctx.strokeStyle = 'rgba(0,200,255,0.60)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.roundRect(px4 - pistonW/2, tipY, pistonW, ph4, [3,3,0,0]); ctx.stroke();
      // Head cap — bright highlight
      var headH = 4;
      var headGrad = ctx.createLinearGradient(px4 - pistonW/2, tipY, px4 + pistonW/2, tipY + headH);
      headGrad.addColorStop(0, 'rgba(200,240,255,0.95)');
      headGrad.addColorStop(1, 'rgba(0,160,255,0.70)');
      ctx.fillStyle = headGrad;
      ctx.beginPath(); ctx.roundRect(px4 - pistonW/2 - 1, tipY - 1, pistonW + 2, headH, 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,220,255,0.85)'; ctx.lineWidth = 0.8; ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.roundRect(px4 - pistonW/2 - 1, tipY - 1, pistonW + 2, headH, 2); ctx.stroke();
      ctx.shadowBlur = 0;
      // Base collar at cap top
      ctx.fillStyle = 'rgba(0,100,180,0.80)';
      ctx.beginPath(); ctx.roundRect(px4 - pistonW/2 - 1, capY - 3, pistonW + 2, 6, 1); ctx.fill();
    });

    // Scan lines on gear area only
    ctx.strokeStyle = 'rgba(0,180,255,0.08)'; ctx.lineWidth = 0.8;
    for (var sl2 = capY + 4; sl2 < hazY - 2; sl2 += 4) {
      ctx.beginPath(); ctx.moveTo(capX + 3, sl2); ctx.lineTo(capX + capW - stripeW - 3, sl2); ctx.stroke();
    }



    // ── Buttons inside the shaft ──────────────────────────────────────────────
    var btnTypes  = ['cube','splatter','squiggly','bouncer','exploder','sticky','splitter','gravity'];
    var btnColors = ['#00ddff','#cc6600','#ffcc00','#4488ff','#ff4400','#44ff44','#ff44ff','#00ffee'];
    var btnH   = 30;
    var btnW   = CW - 6;
    var btnX   = leftX + 3;
    var curveTop  = floorY - turnR;
    // DEL button goes right below the cap
    var delBtnY   = topY + 4;
    var btnGap    = 12;
    // Fit all 8 ball buttons between DEL and trapdoor pivot
    var pivotRef  = this._tdPivotY || (floorY - 60);
    var availH    = pivotRef - (delBtnY + btnH + btnGap) - 4;
    var numBtns   = btnTypes.length;
    // Shrink button height to fit if needed, min 22px
    var btnHFit   = Math.max(22, Math.floor((availH - (numBtns-1)*3) / numBtns));
    var totalH    = numBtns * btnHFit + (numBtns-1) * 3;
    var btnStartY = delBtnY + btnH + btnGap;

    this._chuteButtonRects = [];
    var onField = this.objects.filter(function(o) { return !o.dead; }).length
                + (this._chuteActive ? this._chuteActive.length : 0)
                + (this._chuteQueue  ? this._chuteQueue.length  : 0);
    var atMax = onField >= 15;

    this._chuteAimRect = null;  // aim button moved to corner

    for (var bi = 0; bi < btnTypes.length; bi++) {
      var by    = btnStartY + bi * (btnHFit + 3);
      var btype = btnTypes[bi];
      var bcol  = btnColors[bi];
      var alpha = atMax ? 0.28 : 1.0;
      var pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.055 + bi * 1.3);
      var pressFlash = this._btnPressFlash && this._btnPressFlash.type === btype
        ? Math.max(0, 1 - (this.frame - this._btnPressFlash.frame) / 20) : 0;

      this._chuteButtonRects.push({ x: btnX, y: by, w: btnW, h: btnHFit, type: btype });

      // Parse hex color to rgb for gradients
      var r = parseInt(bcol.slice(1,3),16);
      var g = parseInt(bcol.slice(3,5),16);
      var b = parseInt(bcol.slice(5,7),16);

      // ── Background: 25% opacity with tube-wrap horizontal gradient ──────────
      // Tube-wrap: dark edges, brighter centre (simulates cylindrical depth)
      ctx.beginPath(); ctx.roundRect(btnX, by, btnW, btnHFit, 8);
      var bgGrad = ctx.createLinearGradient(btnX, by, btnX + btnW, by);
      bgGrad.addColorStop(0,    'rgba(0,4,14,' + (alpha * 0.25) + ')');
      bgGrad.addColorStop(0.15, 'rgba(' + Math.round(r*0.08)+','+Math.round(g*0.06)+','+Math.round(b*0.10)+',' + (alpha * 0.22) + ')');
      bgGrad.addColorStop(0.5,  'rgba(' + Math.round(r*0.18)+','+Math.round(g*0.15)+','+Math.round(b*0.22)+',' + (alpha * 0.18) + ')');
      bgGrad.addColorStop(0.85, 'rgba(' + Math.round(r*0.08)+','+Math.round(g*0.06)+','+Math.round(b*0.10)+',' + (alpha * 0.22) + ')');
      bgGrad.addColorStop(1,    'rgba(0,4,14,' + (alpha * 0.25) + ')');
      ctx.fillStyle = bgGrad; ctx.fill();

      // ── Outer glow halo (behind border) ───────────────────────────────────
      if (!atMax) {
        ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.5 + pulse * 0.3) + ')';
        ctx.shadowBlur  = 10 + pulse * 6;
      }

      // ── Neon border ────────────────────────────────────────────────────────
      ctx.beginPath(); ctx.roundRect(btnX, by, btnW, btnHFit, 8);
      var borderGrad = ctx.createLinearGradient(btnX, by, btnX, by + btnHFit);
      borderGrad.addColorStop(0,   'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.9) + ')');
      borderGrad.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.55) + ')');
      borderGrad.addColorStop(1,   'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.9) + ')');
      ctx.strokeStyle = borderGrad;
      ctx.lineWidth   = 1.8;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // ── Top highlight bevel (makes it look raised) ─────────────────────────
      ctx.beginPath(); ctx.roundRect(btnX + 1.5, by + 1.5, btnW - 3, btnHFit * 0.45, [7,7,0,0]);
      var hiliteGrad = ctx.createLinearGradient(btnX, by, btnX, by + btnHFit * 0.45);
      hiliteGrad.addColorStop(0,   'rgba(255,255,255,' + (alpha * 0.12) + ')');
      hiliteGrad.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = hiliteGrad; ctx.fill();

      // ── Inner colour fill (gives body of the button colour depth) ──────────
      ctx.beginPath(); ctx.roundRect(btnX + 2, by + 2, btnW - 4, btnHFit - 4, 6);
      var fillGrad = ctx.createLinearGradient(btnX, by, btnX + btnW, by + btnHFit);
      fillGrad.addColorStop(0,   'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.08) + ')');
      fillGrad.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.14) + ')');
      fillGrad.addColorStop(1,   'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.05) + ')');
      ctx.fillStyle = fillGrad; ctx.fill();

      // ── Ball orb ──────────────────────────────────────────────────────────
      var dotR = 8, dotX = btnX + dotR + 5, dotY = by + btnHFit / 2;

      // Orb glow
      if (!atMax) {
        ctx.shadowColor = bcol;
        ctx.shadowBlur  = 10 + pulse * 8;
      }
      // Orb fill — radial gradient for 3D sphere look
      var orbGrad = ctx.createRadialGradient(
        dotX - dotR * 0.3, dotY - dotR * 0.3, dotR * 0.05,
        dotX, dotY, dotR
      );
      orbGrad.addColorStop(0,   'rgba(255,255,255,' + (alpha * 0.85) + ')');
      orbGrad.addColorStop(0.25,'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.95) + ')');
      orbGrad.addColorStop(0.7, 'rgba(' + Math.round(r*0.5) + ',' + Math.round(g*0.5) + ',' + Math.round(b*0.5) + ',' + (alpha * 0.90) + ')');
      orbGrad.addColorStop(1,   'rgba(0,0,0,' + (alpha * 0.55) + ')');
      ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = orbGrad; ctx.fill();
      ctx.shadowBlur = 0;

      // Orb rim
      ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.7) + ')';
      ctx.lineWidth = 0.8; ctx.stroke();

      // ── Press flash overlay — bright white + colour glow ─────────────────
      if (pressFlash > 0) {
        ctx.save();
        ctx.beginPath(); ctx.roundRect(btnX, by, btnW, btnHFit, 8);
        ctx.fillStyle = 'rgba(255,255,255,' + (pressFlash * 0.55) + ')';
        ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',1)';
        ctx.shadowBlur  = 20 * pressFlash;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // ── Label ──────────────────────────────────────────────────────────────
      var labels = {cube:'CUB',splatter:'SPA',squiggly:'SQG',bouncer:'BNC',exploder:'EXP',sticky:'STK',splitter:'SPL',gravity:'GRV'};
      var lblText = labels[btype] || btype.slice(0,3).toUpperCase();

      // Label shadow for depth
      ctx.fillStyle = 'rgba(0,0,0,' + (alpha * 0.5) + ')';
      ctx.font = "bold 10px 'Share Tech Mono', monospace";
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(lblText, dotX + dotR + 5 + 1, dotY + 1);

      // Label main
      var lblGrad = ctx.createLinearGradient(0, by, 0, by + btnHFit);
      lblGrad.addColorStop(0, 'rgba(220,240,255,' + alpha + ')');
      lblGrad.addColorStop(1, 'rgba(' + Math.round(r*0.8+100) + ',' + Math.round(g*0.8+100) + ',' + Math.round(b*0.8+100) + ',' + alpha + ')');
      ctx.fillStyle = lblGrad;
      ctx.fillText(lblText, dotX + dotR + 5, dotY);
    }

    // Delete button — directly below cap, above ball buttons
    var delY      = delBtnY;
    var delActive = this._deleteMode;
    var delPulse  = 0.5 + 0.5 * Math.sin(this.frame * 0.08);
    this._chuteDeleteRect = { x: btnX, y: delY, w: btnW, h: btnH };

    // Background
    ctx.beginPath(); ctx.roundRect(btnX, delY, btnW, btnH, 8);
    var delBg = ctx.createLinearGradient(btnX, delY, btnX, delY + btnH);
    delBg.addColorStop(0, delActive ? 'rgba(80,5,5,0.95)'  : 'rgba(35,4,4,0.90)');
    delBg.addColorStop(1, delActive ? 'rgba(40,2,2,0.95)'  : 'rgba(10,2,2,0.88)');
    ctx.fillStyle = delBg; ctx.fill();

    // Glow + border
    ctx.shadowColor = delActive ? '#ff2200' : '#cc2200';
    ctx.shadowBlur  = delActive ? 14 + delPulse * 8 : 5;
    ctx.beginPath(); ctx.roundRect(btnX, delY, btnW, btnH, 8);
    var delBdr = ctx.createLinearGradient(btnX, delY, btnX, delY + btnH);
    delBdr.addColorStop(0, delActive ? 'rgba(255,80,80,0.95)'  : 'rgba(220,50,50,0.60)');
    delBdr.addColorStop(1, delActive ? 'rgba(255,30,30,0.95)'  : 'rgba(180,30,30,0.60)');
    ctx.strokeStyle = delBdr; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.shadowBlur = 0;

    // Top bevel
    ctx.beginPath(); ctx.roundRect(btnX + 1.5, delY + 1.5, btnW - 3, btnH * 0.45, [7,7,0,0]);
    var delHilite = ctx.createLinearGradient(btnX, delY, btnX, delY + btnH * 0.45);
    delHilite.addColorStop(0, 'rgba(255,255,255,0.08)');
    delHilite.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = delHilite; ctx.fill();

    // ✕ icon as glowing orb
    var delOrbX = btnX + 11, delOrbY = delY + btnH / 2;
    var delOrb  = ctx.createRadialGradient(delOrbX - 2, delOrbY - 2, 1, delOrbX, delOrbY, 7);
    delOrb.addColorStop(0, delActive ? 'rgba(255,200,200,0.95)' : 'rgba(255,120,120,0.8)');
    delOrb.addColorStop(0.5, delActive ? 'rgba(255,60,60,0.90)' : 'rgba(200,40,40,0.7)');
    delOrb.addColorStop(1,   'rgba(80,0,0,0.5)');
    if (!atMax) { ctx.shadowColor = '#ff2200'; ctx.shadowBlur = delActive ? 12 : 6; }
    ctx.beginPath(); ctx.arc(delOrbX, delOrbY, 7, 0, Math.PI * 2);
    ctx.fillStyle = delOrb; ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = delActive ? 'rgba(255,160,160,0.95)' : 'rgba(220,100,100,0.85)';
    ctx.font = "bold 9px 'Share Tech Mono', monospace";
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(delActive ? 'TAP BALL' : 'DEL', delOrbX + 10, delOrbY);

    ctx.restore();
  }

  _triggerWin() {
    this.won = true; this.winTimer = 180;
    var bonus = Math.max(0, 10 - this.collisions) * 50;
    this.score += 200 + bonus;
    this.ui.setScore(this.score);
    this.target.hit = true; this.target.flash = 1;
    Physics.spawnSparks(this.sparks, this.target.x, this.target.y, '#00ff88', 60);
    Physics.spawnSparks(this.sparks, this.target.x, this.target.y, '#030a18', 30);
    this.ui.showWin('LEVEL COMPLETE!', bonus > 0 ? '+' + bonus + ' EFFICIENCY BONUS' : '');
    if (window.Sound) Sound.win();
    var self = this;
    setTimeout(function() { self.stop(); self.onBackToMenu(); }, 3200);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _draw() {
    var ctx = this.ctx, W = this.W, H = this.H, floorY = this.floorY();
    var vSY = this._editorMode ? (this._editorScrollY || 0) : 0;
    ctx.fillStyle = '#030a18'; ctx.fillRect(0, 0, W, H);
    if (vSY !== 0) { ctx.save(); ctx.translate(0, vSY); }
    if (this.nebulaOffscreen) ctx.drawImage(this.nebulaOffscreen, 0, 0);
    this._drawGrid(); this._drawStars();

    for (var g = 0; g < this.objects.length; g++) {
      if (this.objects[g].type === BALL_TYPES.GRAVITY && this.objects[g].gravActive) this._drawGravityRange(this.objects[g]);
    }

    this._drawFloor(floorY);
    if (this._editorMode && window._showEditorGrid) { this._drawEditorGrid(floorY); }
    var _selTubeForDraw = (this._tubeGroupDrag && this._editorTubeMode) ? null : this._tubeSelected;
    this.tubes.draw(ctx, 'behind', this.frame, _selTubeForDraw);
    if (this._chuteActive) { for (var ci=0;ci<this._chuteActive.length;ci++) this._drawBall(this._chuteActive[ci]); }
    this._drawChute();
    if (this.barrier) this.barrier.draw(ctx);
    if (this.target) this.target.draw(ctx);
    for (var i = 0; i < this.obstacles.length; i++) this.obstacles[i].draw(ctx, this.frame);
    this.tubes.draw(ctx, 'main', this.frame, _selTubeForDraw);
    // Bounding box draw disabled — replaced by per-tube cyan glow outline (_groupHighlight)
    // if (this._tubeGroupDrag && this._tubeGroupDrag.hasMoved && window._tubeBBoxOn !== false && this._editorTubeMode) { ... }
    for (var i = 0; i < this.buttons.length;    i++) this.buttons[i].draw(ctx);
    for (var i = 0; i < this.bricks.length; i++) this.bricks[i].draw(ctx);
    this._drawSplats();  // draw ON TOP of bricks, before balls
    for (var i = 0; i < this.turnstiles.length; i++) this.turnstiles[i].draw(ctx);
    for (var i = 0; i < this.ports.length;      i++) this.ports[i].draw(ctx);
    for (var i = 0; i < this.spawners.length;   i++) this.spawners[i].draw(ctx);
    for (var j = 0; j < this.objects.length;   j++) this._drawBall(this.objects[j]);
    this.tubes.draw(ctx, 'above', this.frame, _selTubeForDraw);
    if (this.sling) this._drawSling();
    this._drawSparks();
    if (this._editorMode) this._drawEditor();
    if (vSY !== 0) ctx.restore();
    this._drawHudClearButtons();
    if (!this._editorMode) {
      this._drawSpeedSlider();
      this._drawCornerButtons();
    }
  }

  // ── Brick Editor (§4.3) ───────────────────────────────────────────────────

  _undoPush() {
    if (!this._undoHistory) { this._undoHistory = []; this._redoHistory = []; }
    var snap = this.bricks.map(function(b) {
      return { x:b.x, y:b.y, w:b.w, h:b.h, r:b.r, _rotation:b._rotation,
               maxHealth:b.maxHealth, regenAfter:b.regenAfter, _density:b._density,
               _maxTravel:b._maxTravel, _decel:b._decel, _rotSpeed:b._rotSpeed,
               _rotDecel:b._rotDecel, _movable:b._movable, _invincible:b._invincible,
               _noRegen:b._noRegen, _wallBounce:b._wallBounce, _pivot:b._pivot,
               _translateOnRotate:b._translateOnRotate, _noteConfig:b._noteConfig,
               _spawnX:b._spawnX, _spawnY:b._spawnY, _spawnRot:b._spawnRot, id:b.id, _ref:b };
    });
    // Also snapshot tubes
    var tubeSnap = this.tubes ? this.tubes.toJSON() : [];
    this._undoHistory.push({ bricks: snap, tubes: tubeSnap });
    if (this._undoHistory.length > 50) this._undoHistory.shift();
    this._redoHistory = [];
  }

  _undoApply(snap) {
    // Support both old format (array) and new format ({bricks, tubes})
    var brickSnap = Array.isArray(snap) ? snap : snap.bricks;
    var tubeSnap  = Array.isArray(snap) ? null : snap.tubes;
    // Restore brick list to snapshot
    this.bricks = brickSnap.map(function(s) {
      var b = s._ref;
      if (!b) return null;
      b.x=s.x; b.y=s.y; b.w=s.w; b.h=s.h; if(s.r)b.r=s.r;
      b._rotation=s._rotation||0; b.maxHealth=s.maxHealth; b.health=s.maxHealth;
      b.regenAfter=s.regenAfter; b._density=s._density; b._maxTravel=s._maxTravel;
      b._decel=s._decel; b._rotSpeed=s._rotSpeed; b._rotDecel=s._rotDecel;
      b._movable=s._movable; b._invincible=s._invincible; b._noRegen=s._noRegen;
      b._wallBounce=s._wallBounce; b._pivot=s._pivot; b._translateOnRotate=s._translateOnRotate;
      b._spawnX=s._spawnX; b._spawnY=s._spawnY; b._spawnRot=s._spawnRot;
      return b;
    }).filter(Boolean);
    // Restore tubes if snapshot includes them
    if (tubeSnap && this.tubes) this.tubes.fromJSON(tubeSnap);
  }

  toggleEditor() {
    this._editorMode = !this._editorMode;
    if (this._editorMode) {
      // Block slider hit-testing while editor is open (rects restored on close)
      this._editorBlockSliders = true;
      this._editorBrickType   = 'breakable_brick';
      this._editorDragging    = null;
      this._editorSelected    = null;
      // Restore tube mode from last active tab (tab memory)
      var _wastubeTab = (this._editorActiveTab === 'tubes');
      this._editorTubeMode = _wastubeTab;
      window._tubeEditorMode = _wastubeTab;
      if (!this._undoHistory) { this._undoHistory = []; this._redoHistory = []; }
      if (this._editorTranslate === undefined) this._editorTranslate = false;
      // Default: stationary, no rotation, translate-on-rotate off
      if (this._editorMovable === undefined) this._editorMovable = false;
      if (this._editorLastSettings === undefined) this._editorLastSettings = { _movable: false, _rotation: 0, _translateOnRotate: false };
      if (window.Sound && Sound.editorOpen) Sound.editorOpen();  // default ⊕ROT
    } else {
      this._editorNotePopup = false;
      this._editorScrollY = 0;
      this._viewScrollY = 0;
      this._editorBlockSliders = false;
      this._tubeSelected = null;
      this._tubeDragging = null;
      this._editorBrickDeleteMode = false;
      this._tubeDeleteMode = false;
      if (window.Sound && Sound.editorClose) Sound.editorClose();
      // Lock in current position/rotation as spawn point for all bricks
      for (var bi = 0; bi < this.bricks.length; bi++) {
        var bk = this.bricks[bi];
        bk._spawnX   = bk.x;
        bk._spawnY   = bk.y;
        bk._spawnRot = bk._rotation || 0;
        bk._startX   = bk.x;
        bk._startY   = bk.y;
      }
    }
  }

  _editorOnDown(pos) {
    // Always try to select an existing brick first
    // Use rotated AABB test so long rotated bricks are selectable at their ends
    var bestBrick = null, bestDist = 9999;
    for (var i = this.bricks.length - 1; i >= 0; i--) {
      var b = this.bricks[i];
      var hit = false;
      if (b instanceof CircularBrick) {
        hit = Math.hypot(pos.x - b.x, pos.y - b.y) < b.r + 14;
      } else {
        // Transform tap into brick-local space
        var bRot3 = b._rotation || 0;
        var cosR3 = Math.cos(-bRot3), sinR3 = Math.sin(-bRot3);
        var relX3 = pos.x - b.x, relY3 = pos.y - b.y;
        var localX3 = cosR3 * relX3 - sinR3 * relY3;
        var localY3 = sinR3 * relX3 + cosR3 * relY3;
        var pad = 14;
        hit = Math.abs(localX3) < (b.w || 40) / 2 + pad && Math.abs(localY3) < (b.h || 22) / 2 + pad;
      }
      if (hit) {
        var dist3 = Math.hypot(pos.x - b.x, pos.y - b.y);
        if (dist3 < bestDist) { bestDist = dist3; bestBrick = b; }
      }
    }
    if (bestBrick) {
      var b = bestBrick;
      var toolMode = this._editorToolMode || 'build';
      // Brick delete mode: tap = delete (always active regardless of tool)
      if (this._editorBrickDeleteMode) {
        this._undoPush();
        var idx2 = this.bricks.indexOf(b);
        if (idx2 >= 0) this.bricks.splice(idx2, 1);
        if (this._editorSelected === b) { this._editorSelected = null; this._showBrickSettings = false; }
        if (window.Sound && Sound.uiTap) Sound.uiTap(0.3);
        return;
      }
      this._editorSelected = b;
      this._showBrickSettings = true;
      this._editorMovable = b._movable || false;

      if (toolMode === 'stretch') {
        // Determine which end was tapped (in brick local space)
        var bRot4 = b._rotation || 0;
        var cosR4 = Math.cos(-bRot4), sinR4 = Math.sin(-bRot4);
        var relX4 = pos.x - b.x, relY4 = pos.y - b.y;
        var localX4 = cosR4 * relX4 - sinR4 * relY4;
        var halfW4 = (b.w || 40) / 2;
        // Which end is closer?
        var endSide = localX4 >= 0 ? 'right' : 'left';
        this._editorStretchState = {
          brick: b, side: endSide,
          startLocalX: localX4,
          origW: b.w || 40,
          origX: b.x, origY: b.y,
        };
        this._editorDragging = null;
        return;
      }

      if (toolMode === 'width') {
        // Determine which edge (top/bottom in local space)
        var bRot5 = b._rotation || 0;
        var cosR5 = Math.cos(-bRot5), sinR5 = Math.sin(-bRot5);
        var relX5 = pos.x - b.x, relY5 = pos.y - b.y;
        var localY5 = sinR5 * relX5 + cosR5 * relY5;
        var edgeSide = localY5 >= 0 ? 'bottom' : 'top';
        this._editorWidthState = {
          brick: b, side: edgeSide,
          startLocalY: localY5,
          origH: b.h || 22,
          origX: b.x, origY: b.y,
        };
        this._editorDragging = null;
        return;
      }

      if (toolMode === 'rotate') {
        // Use existing pivot point or brick center
        var pivot = b._pivot || 'CM';
        var pOff = this._getPivotOffset(b, pivot);
        this._editorRotateState = {
          brick: b,
          pivotWorldX: b.x + pOff.x,
          pivotWorldY: b.y + pOff.y,
          startAngle: Math.atan2(pos.y - (b.y + pOff.y), pos.x - (b.x + pOff.x)),
          origRotation: b._rotation || 0,
        };
        this._editorDragging = null;
        return;
      }

      // BUILD or SELECT mode: normal drag
      this._editorDragOffX = pos.x - b.x;
      this._editorDragOffY = pos.y - b.y;
      this._editorDragging = b;
      return;
    }
    // SELECT mode: tapping empty space just deselects — never place
    if (this._editorSelectMode) {
      if (this._editorSelected) this._saveLastSettings(this._editorSelected);
      this._editorSelected = null;
      this._showBrickSettings = false;
      return;
    }
    // BUILD mode: place new brick — use last-used settings or factory defaults
    // First, save settings from whatever brick was selected (carries forward all slider values)
    if (this._editorSelected) this._saveLastSettings(this._editorSelected);
    var defaults = window.BrickDefaults || {};
    var last     = this._editorLastSettings || {};
    var isCircle = this._editorBrickType === 'circular_brick';
    var defHP    = last.maxHealth  || (isCircle ? (defaults.circularHP  || 100)  : (defaults.rectHP    || 100));
    var defRegen = last.regenAfter || (isCircle ? (defaults.circularRegen||2000) : (defaults.rectRegen || 2000));
    var defW     = last.w          || (isCircle ? (defaults.circularR||22)*2      : (defaults.rectW    || 70));
    var defH     = last.h          || (isCircle ? (defaults.circularR||22)*2      : (defaults.rectH    || 22));
    var id  = 'brick_' + Date.now();
    var obj = isCircle
      ? new CircularBrick(pos.x, pos.y, (last.r || defaults.circularR || 22), defHP, id, defRegen)
      : new BreakableBrick(pos.x, pos.y, defW, defH, defHP, id, defRegen);
    obj._movable          = last._movable  !== undefined ? last._movable  : (this._editorMovable || false);
    obj._rotation         = last._rotation !== undefined ? last._rotation : 0;
    obj._vx = 0; obj._vy = 0; obj._angularV = 0;
    obj._maxTravel        = last._maxTravel  !== undefined ? last._maxTravel  : (defaults.maxTravel || 60);
    obj._decel            = last._decel      !== undefined ? last._decel      : (defaults.decel     || 0.88);
    obj._density          = last._density    !== undefined ? last._density    : (defaults.density   || 1.0);
    obj._rotSpeed         = last._rotSpeed   !== undefined ? last._rotSpeed   : (defaults.rotSpeed  || 0.5);
    obj._rotDecel         = last._rotDecel   !== undefined ? last._rotDecel   : (defaults.rotDecel  || 0.88);
    obj._noteConfig       = last._noteConfig ? JSON.parse(JSON.stringify(last._noteConfig)) : null;
    obj._invincible       = last._invincible || false;
    obj._noRegen          = last._noRegen    || false;
    obj._translateOnRotate= last._translateOnRotate !== undefined ? last._translateOnRotate : true;
    obj._pivot            = last._pivot || 'CM';
    obj._spawnX  = pos.x;
    obj._spawnY  = pos.y;
    obj._spawnRot= obj._rotation;
    obj._startX  = pos.x;
    obj._startY  = pos.y;
    this._undoPush();
    this.bricks.push(obj);
    EventManager.registerTarget(id, obj);
    this._editorSelected    = obj;
    this._editorDragging    = obj;
    this._editorDragOffX    = 0;
    this._editorDragOffY    = 0;
    this._showBrickSettings = true;
    // Placement sound — soft thud
    if (window.Sound && Sound.getCtx) {
      var c = Sound.getCtx();
      if (c) {
        var now = c.currentTime;
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(180, now); o.frequency.exponentialRampToValueAtTime(80, now + 0.12);
        g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.15);
        var o2 = c.createOscillator(), g2 = c.createGain();
        o2.type = 'triangle'; o2.frequency.value = 320;
        g2.gain.setValueAtTime(0.08, now); g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        o2.connect(g2); g2.connect(c.destination); o2.start(now); o2.stop(now + 0.07);
      }
    }
  }

  // Multi-touch: pinch to scale, two-finger rotate
  _editorHandleTouch(touches) {
    if (!this._editorMode || !this._editorSelected || touches.length < 2) return;
    if (this._editorTubeMode) return;
    var rect = this.canvas.getBoundingClientRect();
    var _escX = this.canvas.width / rect.width, _escY = this.canvas.height / rect.height;
    var vSY  = this._editorScrollY || 0;
    var t0 = touches[0], t1 = touches[1];
    // Apply scroll offset so coords are in editor-content space (matching where bricks are drawn)
    var p0 = { x: (t0.clientX - rect.left) * _escX, y: (t0.clientY - rect.top) * _escY - vSY };
    var p1 = { x: (t1.clientX - rect.left) * _escX, y: (t1.clientY - rect.top) * _escY - vSY };
    var sb = this._editorSelected;

    if (!this._editorPinchStart) {
      // Store initial finger and brick state
      this._editorPinchStart = {
        p0: { x: p0.x, y: p0.y }, p1: { x: p1.x, y: p1.y },
        cx: sb.x, cy: sb.y,
        w: sb.w || (sb.r||10)*2, h: sb.h || (sb.r||10)*2,
        r: sb instanceof CircularBrick ? sb.r : 0,
        rot: sb._rotation || 0,
        dist: Math.hypot(p1.x-p0.x, p1.y-p0.y),
        angle: Math.atan2(p1.y-p0.y, p1.x-p0.x),
      };
      return;
    }

    var ps = this._editorPinchStart;
    var d0 = Math.hypot(p0.x - ps.p0.x, p0.y - ps.p0.y);
    var d1 = Math.hypot(p1.x - ps.p1.x, p1.y - ps.p1.y);
    var ANCHOR_THRESH = 5;  // px — below this = stationary = pivot anchor

    if (sb instanceof CircularBrick) {
      // Circles: scale by distance change, rotate by angle change
      var newDist  = Math.hypot(p1.x-p0.x, p1.y-p0.y);
      var newAngle = Math.atan2(p1.y-p0.y, p1.x-p0.x);
      sb.r = Math.max(8, Math.min(200, ps.r + (newDist - ps.dist) * 0.5));
      sb.w = sb.h = sb.r * 2;
      sb._rotation = ps.rot + (newAngle - ps.angle);
      sb.x = (p0.x + p1.x) / 2;
      sb.y = Math.min((p0.y + p1.y) / 2, this.floorY() - sb.r - 4);
      return;
    }

    // Rectangular brick: fingers represent the two ends of the brick along its length axis
    // New rotation = angle between the two fingers
    var newAngle2 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    var snapDeg   = this._editorSnapDeg || 0;
    if (snapDeg > 0) {
      var snapRad = snapDeg * Math.PI / 180;
      newAngle2 = Math.round(newAngle2 / snapRad) * snapRad;
    }
    sb._rotation = newAngle2;

    // New length = distance between fingers
    var newLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    sb.w = Math.max(10, Math.min(900, newLen));

    if (d0 < ANCHOR_THRESH) {
      // Finger 0 is anchored — that end stays at p0
      // Brick center = p0 + (w/2) along rotation direction
      sb.x = p0.x + Math.cos(newAngle2) * sb.w / 2;
      sb.y = p0.y + Math.sin(newAngle2) * sb.w / 2;
    } else if (d1 < ANCHOR_THRESH) {
      // Finger 1 is anchored — that end stays at p1
      sb.x = p1.x - Math.cos(newAngle2) * sb.w / 2;
      sb.y = p1.y - Math.sin(newAngle2) * sb.w / 2;
    } else {
      // Both moving — center follows midpoint of fingers
      sb.x = (p0.x + p1.x) / 2;
      sb.y = (p0.y + p1.y) / 2;
    }
    sb.y = Math.min(sb.y, this.floorY() - (sb.h || 10) / 2 - 4);
  }

  _tubeHandleTouch(touches) {
    if (!this._tubeDragging) return;
    var rect = this.canvas.getBoundingClientRect();
    var _tscX = this.canvas.width / rect.width, _tscY = this.canvas.height / rect.height;
    var z    = this._viewZoom || 1.0;
    var fY   = this.floorY();
    var W    = this.W;
    var t0 = touches[0], t1 = touches[1];
    // Convert screen coords to world coords using zoom transform inverse
    function toWorld(t) {
      var sx = (t.clientX - rect.left) * _tscX;
      var sy = (t.clientY - rect.top)  * _tscY;
      return { x: (sx - W) / z + W, y: (sy - fY) / z + fY };
    }
    var p0 = toWorld(t0);
    var p1 = toWorld(t1);
    var td = this._tubeDragging;

    if (!this._tubePinchStart) {
      this._tubePinchStart = {
        p0:{x:p0.x,y:p0.y}, p1:{x:p1.x,y:p1.y},
        x:td.x, y:td.y, rot:td.rotation, len:td.length,
        dist: Math.hypot(p1.x-p0.x, p1.y-p0.y),
        angle: Math.atan2(p1.y-p0.y, p1.x-p0.x),
      };
      return;
    }
    var ps = this._tubePinchStart;
    var d0 = Math.hypot(p0.x-ps.p0.x, p0.y-ps.p0.y);
    var d1 = Math.hypot(p1.x-ps.p1.x, p1.y-ps.p1.y);

    // New angle and length from finger positions
    var newAngle = Math.atan2(p1.y-p0.y, p1.x-p0.x);
    var snapDeg = this._editorSnapDeg || 0;
    if (snapDeg > 0) { var sr = snapDeg*Math.PI/180; newAngle = Math.round(newAngle/sr)*sr; }
    td.rotation = newAngle;

    // Length = distance between fingers
    var newDist2 = Math.hypot(p1.x-p0.x, p1.y-p0.y);
    td.length = Math.max(20, Math.min(600, newDist2));

    // Socket A (x,y) = finger 0 position, socket B = finger 1 position
    td.x = p0.x;
    td.y = p0.y;
    td.rebuild();
  }

  _editorOnMove(pos) {
    // Slider drag in panel area
    if (this._editorDragSlider) {
      var sl = this._editorDragSlider;
      var t  = Math.max(0, Math.min(1, (pos.x - sl.trackX) / sl.trackW));
      var rawVal = sl.min + t * (sl.max - sl.min);
      rawVal = Math.round(rawVal / (sl.step || 0.001)) * (sl.step || 0.001);
      rawVal = Math.max(sl.min, Math.min(sl.max, rawVal));
      // Tick sound — throttled so it doesn't fire every frame
      if (!this._sliderTickFrame || this.frame - this._sliderTickFrame > 3) {
        if (window.Sound && Sound.uiSlider) Sound.uiSlider();
        this._sliderTickFrame = this.frame;
      }
      // Inverted sliders: display range [0.01, 0.5] represents actual [0.99, 0.5]
      // actual = 1 - displayRawVal; do NOT clamp actual to display range
      var val;
      if (sl.invert) {
        val = 1 - rawVal;  // actual stored value in [0.5, 0.99]
        // no clamping — value is already correct
      } else {
        val = Math.max(sl.min, Math.min(sl.max, rawVal));
      }
      this._setSliderVal(sl.key, sl.defKey, val, sl);
      return;
    }
    // STRETCH mode
    if (this._editorStretchState) {
      var ss = this._editorStretchState, sb = ss.brick;
      var bRot6 = sb._rotation || 0;
      var cosR6 = Math.cos(-bRot6), sinR6 = Math.sin(-bRot6);
      var relX6 = pos.x - sb.x, relY6 = pos.y - sb.y;
      var localX6 = cosR6 * relX6 - sinR6 * relY6;
      var delta6 = localX6 - ss.startLocalX;
      var minW = 12;
      if (ss.side === 'right') {
        var newW6 = Math.max(minW, ss.origW + delta6);
        var growBy6 = newW6 - ss.origW;
        sb.w = newW6;
        // Move center to keep left end anchored
        sb.x = ss.origX + Math.cos(bRot6) * growBy6 / 2;
        sb.y = ss.origY + Math.sin(bRot6) * growBy6 / 2;
      } else {
        var newW7 = Math.max(minW, ss.origW - delta6);
        var growBy7 = newW7 - ss.origW;
        sb.w = newW7;
        // Move center to keep right end anchored
        sb.x = ss.origX - Math.cos(bRot6) * growBy7 / 2;
        sb.y = ss.origY - Math.sin(bRot6) * growBy7 / 2;
      }
      return;
    }

    // WIDTH mode
    if (this._editorWidthState) {
      var ws = this._editorWidthState, wb = ws.brick;
      var bRot7 = wb._rotation || 0;
      var cosR7 = Math.cos(-bRot7), sinR7 = Math.sin(-bRot7);
      var relX7 = pos.x - wb.x, relY7 = pos.y - wb.y;
      var localY7 = sinR7 * relX7 + cosR7 * relY7;
      var delta7 = localY7 - ws.startLocalY;
      var minH = 6;
      if (ws.side === 'bottom') {
        var newH7 = Math.max(minH, ws.origH + delta7);
        var growBy8 = newH7 - ws.origH;
        wb.h = newH7;
        // Move center to keep top edge anchored
        var perpAngle = bRot7 + Math.PI/2;
        wb.x = ws.origX + Math.cos(perpAngle) * growBy8 / 2;
        wb.y = ws.origY + Math.sin(perpAngle) * growBy8 / 2;
      } else {
        var newH8 = Math.max(minH, ws.origH - delta7);
        var growBy9 = newH8 - ws.origH;
        wb.h = newH8;
        var perpAngle2 = bRot7 + Math.PI/2;
        wb.x = ws.origX - Math.cos(perpAngle2) * growBy9 / 2;
        wb.y = ws.origY - Math.sin(perpAngle2) * growBy9 / 2;
      }
      return;
    }

    // ROTATE mode
    if (this._editorRotateState) {
      var rs = this._editorRotateState, rb = rs.brick;
      var curAngle = Math.atan2(pos.y - rs.pivotWorldY, pos.x - rs.pivotWorldX);
      var deltaAngle = curAngle - rs.startAngle;
      rb._rotation = rs.origRotation + deltaAngle;
      return;
    }

    if (!this._editorDragging) return;
    var nx = pos.x - (this._editorDragOffX || 0);
    var ny = pos.y - (this._editorDragOffY || 0);
    // Snap to grid if enabled
    if (window._snapToGrid) {
      var gs = window._gridSize || 20;
      nx = Math.round(nx / gs) * gs;
      ny = Math.round(ny / gs) * gs;
    }
    this._editorDragging.x = nx;
    var maxBrickY = this.floorY() - (this._editorDragging.h || this._editorDragging.r || 15) / 2 - 4;
    this._editorDragging.y = Math.min(ny, maxBrickY);
  }

  _setSliderVal(key, defKey, val, extra) {
    var sb = this._editorSelected;
    if (extra && extra.isDim) {
      // Dimension slider — apply directly to brick w/h
      if (sb) {
        if (extra.id === 'blen') { sb.w = val; }
        else if (extra.id === 'bwid') { sb.h = val; }
      } else {
        window.BrickDefaults = window.BrickDefaults || {};
        if (defKey) window.BrickDefaults[defKey] = val;
      }
      return;
    }
    if (extra && extra.isRot) {
      // Rotation slider — apply snap if enabled
      var snapDeg = this._editorSnapDeg || 0;
      var radVal  = val * Math.PI / 180;
      if (snapDeg > 0) {
        var snapRad = snapDeg * Math.PI / 180;
        radVal = Math.round(radVal / snapRad) * snapRad;
      }
      if (sb) sb._rotation = radVal;
      return;
    }
    if (sb) {
      sb[key] = val;
      if (key === 'maxHealth') { sb.health = val; sb.maxHealth = val; }
    } else {
      window.BrickDefaults = window.BrickDefaults || {};
      if (defKey) window.BrickDefaults[defKey] = val;
    }
  }

  _saveLastSettings(brick) {
    if (!brick) return;
    this._editorLastSettings = {
      maxHealth: brick.maxHealth, regenAfter: brick.regenAfter,
      w: brick.w, h: brick.h, r: brick.r,
      _movable: brick._movable, _rotation: brick._rotation,
      _maxTravel: brick._maxTravel, _decel: brick._decel, _density: brick._density,
      _rotSpeed: brick._rotSpeed, _rotDecel: brick._rotDecel,
      _noteConfig: brick._noteConfig ? JSON.parse(JSON.stringify(brick._noteConfig)) : null,
      _invincible: brick._invincible, _noRegen: brick._noRegen,
      _translateOnRotate: brick._translateOnRotate, _pivot: brick._pivot,
    };
  }

  _editorOnUp() {
    if (this._editorDragging || this._editorDragSlider || this._editorStretchState || this._editorWidthState || this._editorRotateState) this._undoPush();
    this._editorDragging    = null;
    this._editorStretchState = null;
    this._editorWidthState   = null;
    this._editorRotateState  = null;
    this._editorDragSlider  = null;
  }

  _editorDeleteSelected() {
    if (!this._editorSelected) return;
    var idx = this.bricks.indexOf(this._editorSelected);
    if (idx >= 0) {
      this._undoPush();
      this.bricks.splice(idx, 1);
      // Deletion sound — descending crack
      if (window.Sound && Sound.getCtx) {
        var c = Sound.getCtx();
        if (c) {
          var now = c.currentTime;
          var o = c.createOscillator(), g = c.createGain();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(400, now); o.frequency.exponentialRampToValueAtTime(60, now + 0.18);
          g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
          o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.20);
          // Short noise burst
          var bufLen = Math.ceil(c.sampleRate * 0.06);
          var buf = c.createBuffer(1, bufLen, c.sampleRate);
          var d = buf.getChannelData(0);
          for (var ii = 0; ii < bufLen; ii++) d[ii] = (Math.random()*2-1) * Math.exp(-ii/(bufLen*0.15));
          var src = c.createBufferSource(); src.buffer = buf;
          var flt = c.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 800; flt.Q.value = 1.5;
          var g3 = c.createGain(); g3.gain.setValueAtTime(0.12, now); g3.gain.exponentialRampToValueAtTime(0.0001, now+0.07);
          src.connect(flt); flt.connect(g3); g3.connect(c.destination); src.start(now); src.stop(now+0.07);
        }
      }
    }
    this._editorSelected = null;
  }

// NEW _drawEditor — v15 layout
// Replaces lines 3437-4103 in game.js
  _factoryDefaults() {
    return {
      rectW: 70, rectH: 22, rotation: 0,
      rectHP: 100, regenAfter: 0, density: 1.0,
      maxTravel: 60, decel: 0.88, rotSpeed: 0.30,
      rotDecel: 0.88, wallBounce: 0.45, spinDist: 0.5,
    };
  }

  _applyDefaults(keys) {
    var fd = this._factoryDefaults();
    var bd = window.BrickDefaults = window.BrickDefaults || {};
    var sb = this._editorSelected;
    var map = {
      blen:    function(v){ bd.rectW=v;       if(sb)sb.w=v; },
      bwid:    function(v){ bd.rectH=v;       if(sb)sb.h=v; },
      rot:     function(v){ bd.rotation=v;    if(sb)sb._rotation=v*Math.PI/180; },
      hp:      function(v){ bd.rectHP=v;      if(sb){sb.maxHealth=v;sb.health=v;} },
      regen:   function(v){ bd.regenAfter=v;  if(sb)sb.regenAfter=v; },
      dens:    function(v){ bd.density=v;     if(sb)sb._density=v; },
      dist:    function(v){ bd.maxTravel=v;   if(sb)sb._maxTravel=v; },
      decel:   function(v){ bd.decel=1-v;     if(sb)sb._decel=1-v; },
      rotspd:  function(v){ bd.rotSpeed=v;    if(sb)sb._rotSpeed=v; },
      rotdec:  function(v){ bd.rotDecel=1-v;  if(sb)sb._rotDecel=1-v; },
      wbounce: function(v){ bd.wallBounce=v;  if(sb)sb._wallBounce=v; },
      spinDist:function(v){ bd.spinDist=v;    if(sb)sb._spinDist=v; },
    };
    var fdMap = {
      blen:fd.rectW, bwid:fd.rectH, rot:fd.rotation,
      hp:fd.rectHP, regen:fd.regenAfter, dens:fd.density,
      dist:fd.maxTravel, decel:1-fd.decel, rotspd:fd.rotSpeed,
      rotdec:1-fd.rotDecel, wbounce:fd.wallBounce, spinDist:fd.spinDist,
    };
    for (var i=0; i<keys.length; i++) {
      if (map[keys[i]] && fdMap[keys[i]] !== undefined) map[keys[i]](fdMap[keys[i]]);
    }
    if(window.Sound&&Sound.uiTap)Sound.uiTap(0.15);
  }

  _drawEditor() {
    var ctx = this.ctx, W = this.W, H = this.H;
    var floorY = this.floorY();
    var padding = 24;
    var contentW = W - padding * 2;  // slider/button area width

    // ── Panel background ─────────────────────────────────────────────────────
    var panelY = floorY;
    this._editorPanelRect = { y: floorY };
    ctx.save();
    ctx.filter = 'brightness(2.0)';
    ctx.fillStyle = 'rgba(0,8,22,0.97)';
    ctx.fillRect(0, floorY, W, H - floorY + 400);
    ctx.strokeStyle = 'rgba(0,200,255,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, floorY+1); ctx.lineTo(W, floorY+1); ctx.stroke();

    var vSY   = 0;  // scroll handled by canvas translate in _draw
    var cY    = panelY;
    var mono  = "Share Tech Mono,monospace";
    var self  = this;

    // ── Helper: draw one neon button ─────────────────────────────────────────
    function btn(label, x, y, w, h, col, active, opts) {
      opts = opts || {};
      var bg   = active ? 'rgba(' + _hexToRgb(col) + ',0.22)' : 'rgba(0,10,28,0.80)';
      var bc   = active ? col : col + '66';
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill();
      ctx.strokeStyle = bc; ctx.lineWidth = active ? 1.8 : 1.0;
      if (active) { ctx.shadowColor = col; ctx.shadowBlur = 7; }
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = active ? col : col + 'cc';
      ctx.font = "bold " + (opts.fs || 9) + "px '" + mono + "'";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (opts.icon) {
        ctx.save(); ctx.translate(x + w/2, y + h/2); opts.icon(ctx, active ? col : col+'99'); ctx.restore();
      } else {
        ctx.fillText(label, x + w/2, y + h/2);
      }
      return { x:x, y:y, w:w, h:h };
    }

    function _hexToRgb(hex) {
      var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      return r+','+g+','+b;
    }

    // ── Helper: new crosshatch slider ─────────────────────────────────────────
    // Returns rect for hit testing
    function slider(label, val, min, max, x, y, w, opts) {
      opts = opts || {};
      var trackH = 14, thumbW = 12, thumbH = 20;
      var lblW2  = 36, valW = 36;
      var trackX = x + lblW2;
      var trackW = w - lblW2 - valW - 4;
      var trackY = y + (opts.rowH||22)/2 - trackH/2;
      var t      = Math.max(0, Math.min(1, (val - min)/(max - min)));
      var col    = opts.col || '#00aaff';
      var grayed = opts.grayed || false;
      var alpha2 = grayed ? 0.3 : 1.0;
      ctx.globalAlpha = alpha2;

      // Label
      ctx.fillStyle = '#88aacc';
      ctx.font = "bold 8px '" + mono + "'";
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 2, y + (opts.rowH||22)/2);

      // Track — dark bg with crosshatch
      ctx.fillStyle = 'rgba(0,15,40,0.9)';
      ctx.beginPath(); ctx.roundRect(trackX, trackY, trackW, trackH, 3); ctx.fill();
      // Crosshatch fill (only filled portion)
      var fillW = trackW * t;
      if (fillW > 0) {
        ctx.save();
        ctx.beginPath(); ctx.roundRect(trackX, trackY, fillW, trackH, 3); ctx.clip();
        // Cross-hatch lines
        ctx.strokeStyle = col + '44'; ctx.lineWidth = 1;
        for (var xi = trackX - trackH; xi < trackX + fillW + trackH; xi += 5) {
          ctx.beginPath(); ctx.moveTo(xi, trackY); ctx.lineTo(xi + trackH, trackY + trackH); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(xi, trackY + trackH); ctx.lineTo(xi + trackH, trackY); ctx.stroke();
        }
        // Lighter fill overlay
        ctx.fillStyle = col + '22';
        ctx.fillRect(trackX, trackY, fillW, trackH);
        ctx.restore();
      }
      // Track border glow
      ctx.strokeStyle = col + (grayed ? '33' : '88'); ctx.lineWidth = 1;
      ctx.shadowColor = col; ctx.shadowBlur = grayed ? 0 : 4;
      ctx.beginPath(); ctx.roundRect(trackX, trackY, trackW, trackH, 3); ctx.stroke();
      ctx.shadowBlur = 0;

      // Thumb — rect with grip lines
      var thumbX = trackX + trackW * t - thumbW/2;
      ctx.fillStyle = grayed ? '#334455' : col;
      ctx.shadowColor = col; ctx.shadowBlur = grayed ? 0 : 8;
      ctx.beginPath(); ctx.roundRect(thumbX, trackY - (thumbH-trackH)/2, thumbW, thumbH, 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Grip lines on thumb
      if (!grayed) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
        for (var gi = -2; gi <= 2; gi += 2) {
          ctx.beginPath();
          ctx.moveTo(thumbX + thumbW/2 + gi, trackY - (thumbH-trackH)/2 + 3);
          ctx.lineTo(thumbX + thumbW/2 + gi, trackY + trackH + (thumbH-trackH)/2 - 3);
          ctx.stroke();
        }
      }

      // VAL window
      var valText = _fmtVal(label, val, opts);
      ctx.fillStyle = 'rgba(0,10,30,0.9)';
      ctx.beginPath(); ctx.roundRect(trackX + trackW + 2, y + (opts.rowH||22)/2 - 8, valW, 16, 2); ctx.fill();
      ctx.strokeStyle = col + '55'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.roundRect(trackX + trackW + 2, y + (opts.rowH||22)/2 - 8, valW, 16, 2); ctx.stroke();
      ctx.fillStyle = col; ctx.font = "bold 7px '" + mono + "'";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(valText, trackX + trackW + 2 + valW/2, y + (opts.rowH||22)/2);

      ctx.globalAlpha = 1.0;
      return { x: trackX, y: trackY - 4, w: trackW, h: trackH + 8,
               trackX: trackX, trackW: trackW, min: min, max: max,
               valX: trackX+trackW+2, valY: y+(opts.rowH||22)/2-8, valW: valW, valH: 16,
               label: label };
    }

    function _fmtVal(label, val, opts) {
      if (label === 'REGEN') return val ? (val/1000).toFixed(1)+'s' : 'OFF';
      if (label === 'ROT')   return Math.round(val) + '°';
      if (label === 'HP' || label === 'LEN' || label === 'WID' || label === 'DIST') return Math.round(val)+'px';
      if (label === 'DENS')  return parseFloat(val).toFixed(1);
      if (label === 'DECEL' || label === 'RDECEL' || label === 'RSPIN' || label === 'BNCE') return parseFloat(val).toFixed(2);
      if (label === 'SPIN/DIST') return Math.round(val*100)+'%';
      var n = parseFloat(val); return isNaN(n) ? String(val) : (Number.isInteger(n) ? String(n) : n.toFixed(2));
    }


  // ── Helper: collapsible panel header ─────────────────────────────────────
    function panelHeader(label, key, x, y, w, col) {
      var collapsed = window['_edCollapse_'+key] || false;
      var hH = 18;
      var defMode = self._editorDefaultMode || false;
      // In default mode: highlight headers orange to show they're tappable
      ctx.fillStyle = defMode ? 'rgba(255,140,0,0.25)' : 'rgba(0,10,28,0.9)';
      ctx.beginPath(); ctx.roundRect(x, y, w, hH, 3); ctx.fill();
      ctx.strokeStyle = defMode ? '#ff8800' : col + '66'; ctx.lineWidth = defMode ? 1.5 : 1;
      if (defMode) { ctx.shadowColor='#ff8800'; ctx.shadowBlur=6; }
      ctx.beginPath(); ctx.roundRect(x, y, w, hH, 3); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = defMode ? '#ffaa44' : col;
      ctx.font = "bold 9px '" + mono + "'";
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(collapsed ? '▶ '+label : '▼ '+label, x+6, y+hH/2);
      if (defMode) {
        ctx.fillStyle = '#ff8800'; ctx.font = "bold 8px '" + mono + "'";
        ctx.textAlign = 'right';
        ctx.fillText('RESET SECTION', x+w-6, y+hH/2);
        ctx.textAlign = 'left';
      }
      return { x:x, y:y, w:w, h:hH, key:key, collapsed:collapsed };
    }

    // ── ROW 1: CLR ALL | DEL | UNDO | REDO | (space) | DONE ─────────────────
    var r1H = 24, r1Y = cY + 4;
    var btnW1 = Math.floor((contentW) / 6);

    this._editorClearBtn      = btn('CLR ALL', padding,                  r1Y, btnW1, r1H, '#ff4400', false);
    // Fill-bar overlay for CLR ALL when held
    var _cpsR1 = this._clrPressState;
    if (_cpsR1 && _cpsR1.target === 'clrall' && _cpsR1.btn) {
      var _elR1  = Date.now() - _cpsR1.startTime;
      var _prR1  = Math.min(1, _elR1 / _cpsR1.duration);
      var _fbR1  = this._editorClearBtn;
      ctx.save();
      ctx.beginPath(); ctx.roundRect(_fbR1.x, _fbR1.y, _fbR1.w * _prR1, _fbR1.h, 3);
      var _gR1 = ctx.createLinearGradient(_fbR1.x, 0, _fbR1.x + _fbR1.w, 0);
      _gR1.addColorStop(0, '#ff4400aa'); _gR1.addColorStop(0.7, '#ff4400ff'); _gR1.addColorStop(1, '#ffffff88');
      ctx.fillStyle = _gR1; ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
      var _puR1 = 0.5 + 0.5 * Math.sin(Date.now() * 0.015);
      ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 1.5 + _puR1;
      ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 8 * _puR1;
      ctx.beginPath(); ctx.roundRect(_fbR1.x, _fbR1.y, _fbR1.w, _fbR1.h, 3); ctx.stroke();
      ctx.shadowBlur = 0; ctx.restore();
    }
    this._editorDelBtn        = btn((this._editorBrickDeleteMode?'✕DEL':'DEL'),
                                    padding + btnW1 + 2,                 r1Y, btnW1, r1H,
                                    '#ff2222', this._editorBrickDeleteMode||false);
    this._editorUndoBtn       = btn('↩UNDO', padding + (btnW1+2)*2,     r1Y, btnW1, r1H,
                                    '#0088ff', false,
                                    {grayed:!(this._undoHistory&&this._undoHistory.length)});
    this._editorRedoBtn       = btn('REDO↪', padding + (btnW1+2)*3,     r1Y, btnW1, r1H,
                                    '#0088ff', false,
                                    {grayed:!(this._redoHistory&&this._redoHistory.length)});
    // Space intentionally empty in position 4
    this._editorDoneBtn       = btn('DONE',  W - padding - btnW1,        r1Y, btnW1, r1H, '#00ff88', true);

    cY = r1Y + r1H + 6;

    // ── Button tap-flash overlay (UNDO/REDO/DEL) ─────────────────────────────
    if (this._btnFlash) {
      var _bf = this._btnFlash;
      var _bfAge = Date.now() - _bf.t;
      var _bfDur = 220;
      if (_bfAge < _bfDur) {
        var _bfAlpha = 1 - (_bfAge / _bfDur);
        ctx.save();
        ctx.globalAlpha = _bfAlpha * 0.55;
        ctx.fillStyle = _bf.col;
        ctx.shadowColor = _bf.col; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.roundRect(_bf.btn.x, _bf.btn.y, _bf.btn.w, _bf.btn.h, 4); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
      } else {
        this._btnFlash = null;
      }
    }

    // ── ROW 2: CLR BRICKS | CLR TUBES | CLR AFFECTORS | CLR RAMPS | CLR MOTORS
    var r2H = 20;
    var clrLabels = ['CLR BRICKS','CLR TUBES','CLR AFFECT','CLR RAMPS','CLR MOTORS'];
    var clrCols   = ['#ff6600','#00ffaa','#ff44cc','#ffcc00','#4488ff'];
    var clrW = Math.floor((contentW - 4*3) / 5);
    this._editorClrBtns = [];
    for (var ci2 = 0; ci2 < clrLabels.length; ci2++) {
      var cbx = padding + ci2 * (clrW + 3);
      this._editorClrBtns.push(btn(clrLabels[ci2], cbx, cY, clrW, r2H, clrCols[ci2], false, {fs:7}));
      this._editorClrBtns[ci2].type = ci2;
      this._editorClrBtns[ci2]._needsLongPress = true;
      this._editorClrBtns[ci2]._col = clrCols[ci2];
    }
    cY += r2H + 5;

    // ── Long-press fill bar overlay on active clr button ─────────────────────
    var _cps = this._clrPressState;
    if (_cps && _cps.btn) {
      var _elapsed = Date.now() - _cps.startTime;
      var _prog    = Math.min(1, _elapsed / _cps.duration);
      var _fb      = _cps.btn;
      ctx.save();
      // Glow fill sweeping left to right
      ctx.beginPath(); ctx.roundRect(_fb.x, _fb.y, _fb.w * _prog, _fb.h, 3);
      var _fbGrad = ctx.createLinearGradient(_fb.x, 0, _fb.x + _fb.w, 0);
      _fbGrad.addColorStop(0,   _cps.col + 'aa');
      _fbGrad.addColorStop(0.7, _cps.col + 'ff');
      _fbGrad.addColorStop(1,   '#ffffff88');
      ctx.fillStyle = _fbGrad;
      ctx.shadowColor = _cps.col; ctx.shadowBlur = 10;
      ctx.fill(); ctx.shadowBlur = 0;
      // Pulsing border on whole button
      var _pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.015);
      ctx.strokeStyle = _cps.col; ctx.lineWidth = 1.5 + _pulse;
      ctx.shadowColor = _cps.col; ctx.shadowBlur = 8 * _pulse;
      ctx.beginPath(); ctx.roundRect(_fb.x, _fb.y, _fb.w, _fb.h, 3); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── ROW 3: Tab bar — proper tabs attached to panel below ─────────────────
    var tabH = 24;
    var tabLabels = ['🧱 BRICKS','🔧 TUBES','⚡ AFFECT','📐 RAMPS','⚙ MOTORS'];
    var tabCols   = ['#00ccff','#00ff88','#ff44cc','#ffcc00','#4488ff'];
    var activeTab = this._editorActiveTab || 'bricks';
    var tabW2 = Math.floor((contentW - 4*2) / 5);
    var panelBgCol = 'rgba(0,8,22,0.97)';

    // Draw panel top edge line UNDER tabs (so active tab can hide it)
    ctx.strokeStyle = 'rgba(0,200,255,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, cY + tabH); ctx.lineTo(W, cY + tabH); ctx.stroke();

    this._editorTabBtns = [];
    for (var ti3 = 0; ti3 < tabLabels.length; ti3++) {
      var tabId = ['bricks','tubes','affectors','ramps','motors'][ti3];
      var tbx = padding + ti3 * (tabW2 + 2);
      var tby = cY;
      var tbActive = activeTab === tabId;
      var tcol = tabCols[ti3];

      ctx.save();
      if (tbActive) {
        // Active tab: brighter, no bottom border, flush with panel
        ctx.fillStyle = panelBgCol;
        ctx.beginPath();
        ctx.moveTo(tbx, tby + tabH + 1);        // bottom-left (below line)
        ctx.lineTo(tbx, tby + 4);               // left side
        ctx.quadraticCurveTo(tbx, tby, tbx + 4, tby);  // top-left curve
        ctx.lineTo(tbx + tabW2 - 4, tby);       // top
        ctx.quadraticCurveTo(tbx + tabW2, tby, tbx + tabW2, tby + 4); // top-right
        ctx.lineTo(tbx + tabW2, tby + tabH + 1); // bottom-right
        ctx.closePath();
        ctx.fill();
        // Colored top + sides only (no bottom)
        ctx.strokeStyle = tcol; ctx.lineWidth = 1.8;
        ctx.shadowColor = tcol; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(tbx, tby + tabH + 1);
        ctx.lineTo(tbx, tby + 4);
        ctx.quadraticCurveTo(tbx, tby, tbx + 4, tby);
        ctx.lineTo(tbx + tabW2 - 4, tby);
        ctx.quadraticCurveTo(tbx + tabW2, tby, tbx + tabW2, tby + 4);
        ctx.lineTo(tbx + tabW2, tby + tabH + 1);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Label bright
        ctx.fillStyle = tcol;
        ctx.font = "bold 8px '" + mono + "'";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(tabLabels[ti3], tbx + tabW2/2, tby + tabH/2);
      } else {
        // Inactive tab: darker, slightly shorter, has bottom border
        ctx.fillStyle = 'rgba(0,5,15,0.7)';
        ctx.beginPath();
        ctx.moveTo(tbx, tby + tabH);
        ctx.lineTo(tbx, tby + 4);
        ctx.quadraticCurveTo(tbx, tby + 2, tbx + 3, tby + 2);
        ctx.lineTo(tbx + tabW2 - 3, tby + 2);
        ctx.quadraticCurveTo(tbx + tabW2, tby + 2, tbx + tabW2, tby + 4);
        ctx.lineTo(tbx + tabW2, tby + tabH);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = tcol + '55'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tbx, tby + tabH);
        ctx.lineTo(tbx, tby + 4);
        ctx.quadraticCurveTo(tbx, tby + 2, tbx + 3, tby + 2);
        ctx.lineTo(tbx + tabW2 - 3, tby + 2);
        ctx.quadraticCurveTo(tbx + tabW2, tby + 2, tbx + tabW2, tby + 4);
        ctx.lineTo(tbx + tabW2, tby + tabH);
        ctx.stroke();
        ctx.fillStyle = tcol + '99';
        ctx.font = "bold 7px '" + mono + "'";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(tabLabels[ti3], tbx + tabW2/2, tby + 2 + (tabH-2)/2);
      }
      ctx.restore();
      this._editorTabBtns.push({ x:tbx, y:tby, w:tabW2, h:tabH, id:tabId });
    }
    // Keep backward compat
    this._editorBrickTab = this._editorTabBtns[0];
    this._editorTubeTab  = this._editorTabBtns[1];
    cY += tabH + 3;

    // ── Branch: tube editor ──────────────────────────────────────────────────
    if (this._editorTubeMode) {
      this._drawTubeEditor(ctx, cY);
      ctx.filter = 'none'; ctx.restore(); return;
    }

    // ── ROW 4: Tool buttons + Snap controls ──────────────────────────────────
    var r4H = 26;
    var snapStartY = cY;  // snap panel top-aligns here
    var tools = [
      { id:'build',   col:'#4488ff', icon: function(c,col) {
        c.fillStyle=col+'66'; c.beginPath(); c.roundRect(-9,-5,18,10,2); c.fill();
        c.strokeStyle=col; c.lineWidth=1.4; c.beginPath(); c.roundRect(-9,-5,18,10,2); c.stroke();
        c.fillStyle=col; [[-3,-2],[3,-2],[-3,2],[3,2]].forEach(function(d){c.beginPath();c.arc(d[0],d[1],1.2,0,Math.PI*2);c.fill();}); }},
      { id:'select',  col:'#ffcc00', icon: function(c,col) {
        c.save(); c.rotate(-Math.PI/4);
        c.beginPath(); c.moveTo(-3,-9);c.lineTo(3,-9);c.lineTo(3,-1);c.lineTo(7,-1);c.lineTo(0,8);c.lineTo(-7,-1);c.lineTo(-3,-1);c.closePath();
        c.fillStyle='rgba(0,160,180,0.6)'; c.fill();
        c.strokeStyle=col; c.lineWidth=1.3; c.setLineDash([2,2]); c.stroke(); c.setLineDash([]); c.restore(); }},
      { id:'scale',   col:'#00ff88', icon: function(c,col) {
        c.strokeStyle=col; c.lineWidth=1.4;
        c.fillStyle=col+'33'; c.beginPath(); c.roundRect(-9,-5,18,10,2); c.fill();
        c.beginPath(); c.roundRect(-9,-5,18,10,2); c.stroke();
        c.beginPath(); c.moveTo(-9,-2);c.lineTo(-14,0);c.lineTo(-9,2);c.moveTo(-9,0);c.lineTo(-14,0); c.stroke();
        c.beginPath(); c.moveTo(9,-2);c.lineTo(14,0);c.lineTo(9,2);c.moveTo(9,0);c.lineTo(14,0); c.stroke(); }},
      { id:'rotate',  col:'#cc44ff', icon: function(c,col) {
        c.strokeStyle=col; c.lineWidth=1.8;
        c.beginPath(); c.arc(0,0,7,0.5,Math.PI*2-0.5); c.stroke();
        c.fillStyle=col; c.beginPath(); c.moveTo(5,5);c.lineTo(9,2);c.lineTo(5,-1); c.fill();
        c.beginPath(); c.arc(0,0,2,0,Math.PI*2); c.fill(); }},
    ];
    var edMode = this._editorToolMode || 'build';
    var toolW  = 36;
    this._editorModeBtns = [];
    for (var tli = 0; tli < tools.length; tli++) {
      var tl = tools[tli];
      var tlx = padding + tli * (toolW + 3);
      var tlRect = btn('', tlx, cY, toolW, r4H, tl.col, edMode===tl.id, {icon:tl.icon});
      tlRect.id = tl.id;
      this._editorModeBtns.push(tlRect);
    }

    // Snap buttons removed from row 4 — now in snap panel below row 5
    this._editorSnapGridBtn = null;
    this._editorSnapBtn     = null;
    this._editorLenSnapBtn  = null;
    this._editorWidSnapBtn  = null;
    this._editorGridPivRects = [];

    cY += r4H + 3;


    // ── ROW 5: Contextual — BLD=subtypes, SEL/SCL=empty, ROT=big pivot grid ────
    var r5H = 26;  // compact sub-type row; pivot grid uses its own sizing
    this._editorTypeBtns = [];

    if (edMode === 'build') {
      // RECT / ROUND / TRI / CUSTOM — original compact size
      var subTypes = [
        { id:'breakable_brick', icon: function(c,col){ c.fillStyle=col+'44'; c.beginPath(); c.roundRect(-9,-4,18,8,1); c.fill(); c.strokeStyle=col; c.lineWidth=1.2; c.beginPath(); c.roundRect(-9,-4,18,8,1); c.stroke(); c.fillStyle=col; [[-4,-2],[4,-2],[-4,2],[4,2]].forEach(function(d){c.beginPath();c.arc(d[0],d[1],1,0,Math.PI*2);c.fill();}); }},
        { id:'circular_brick',  icon: function(c,col){ c.fillStyle=col+'44'; c.beginPath(); c.arc(0,0,7,0,Math.PI*2); c.fill(); c.strokeStyle=col; c.lineWidth=1.2; c.beginPath(); c.arc(0,0,7,0,Math.PI*2); c.stroke(); }},
        { id:'triangle_brick',  icon: function(c,col){ c.fillStyle=col+'44'; c.beginPath(); c.moveTo(0,-7);c.lineTo(8,5);c.lineTo(-8,5);c.closePath(); c.fill(); c.strokeStyle=col; c.lineWidth=1.2; c.stroke(); }},
        { id:'custom_brick',    icon: function(c,col){ c.strokeStyle=col; c.lineWidth=1.2; c.setLineDash([2,2]); c.beginPath(); c.roundRect(-8,-5,16,10,1); c.stroke(); c.setLineDash([]); c.fillStyle=col; c.font="bold 6px monospace"; c.textAlign='center'; c.textBaseline='middle'; c.fillText('+',0,0); }},
      ];
      var stW = Math.floor((W/2 - 16 - 3*3) / 4);
      var curType = this._editorBrickType || 'breakable_brick';
      for (var sti = 0; sti < subTypes.length; sti++) {
        var st = subTypes[sti];
        var stx = padding + sti*(stW+3);
        var stRect = btn('', stx, cY, stW, r5H, '#4488ff', curType===st.id, {icon:st.icon});
        stRect.type = st.id;
        this._editorTypeBtns.push(stRect);
      }

    } else if (edMode === 'rotate') {
      // Big 3x3 pivot grid — editor rotation pivot
      var bigPivW = Math.floor((contentW - 8) / 3);
      var bigPivH = Math.floor((r5H * 2 - 8) / 3) - 1;
      var bigPivCols = ['L','C','R'], bigPivRows = ['T','M','B'];
      var curEdPiv = this._editorSelected ? (this._editorSelected._pivot||'CM') : (this._editorPivot||'CM');
      this._editorPivotRects = [];
      for (var bpc = 0; bpc < 3; bpc++) {
        for (var bpr = 0; bpr < 3; bpr++) {
          var bpKey = bigPivCols[bpc] + bigPivRows[bpr];
          var bpCol = (bpKey === 'CM') ? '#ffcc44' : '#44ccff';
          var bpx = padding + bpc*(bigPivW+4);
          var bpy = cY + 2 + bpr*(bigPivH+3);
          var bpAct = curEdPiv === bpKey;
          ctx.fillStyle = bpAct ? bpCol+'33' : 'rgba(0,10,30,0.7)';
          ctx.beginPath(); ctx.roundRect(bpx,bpy,bigPivW,bigPivH,3); ctx.fill();
          ctx.strokeStyle = bpAct ? bpCol : '#334455';
          ctx.lineWidth = bpAct ? 2 : 0.8;
          if (bpAct) { ctx.shadowColor=bpCol; ctx.shadowBlur=8; }
          ctx.beginPath(); ctx.roundRect(bpx,bpy,bigPivW,bigPivH,3); ctx.stroke();
          ctx.shadowBlur = 0;
          if (bpAct) {
            ctx.fillStyle = bpCol;
            ctx.beginPath(); ctx.arc(bpx+bigPivW/2, bpy+bigPivH/2, 5, 0, Math.PI*2); ctx.fill();
          }
          this._editorPivotRects.push({x:bpx,y:bpy,w:bigPivW,h:bigPivH,val:bpKey,enabled:true});
        }
      }
      // Keep the small pivot grid in behavior panel in sync — point to same array
    }
    // SEL and SCL modes: row 5 is empty (cY still advances by r5H)
    // ── SNAP PANEL: 2 cols × 3 rows ─────────────────────────────────────────
    // Left col: LEN SNAP, WID SNAP, ROT SNAP
    // Right col: GRID (toggle), GRID SNAP (toggle), 3×3 pivot grid
    // Anchored to right of tool buttons, top-aligned with row 4
    var _toolsRightX = padding + tools.length * (toolW + 3) + 6;
    var snapBoxX = _toolsRightX;
    var snapBoxW = W - snapBoxX - padding;
    var snapColW = Math.floor((snapBoxW - 6) / 2);
    // Tall rows — use available vertical space (row4 + row5 + gap)
    var snapTotalH = r4H + 3 + r5H * 2 + 4;  // match height of rows 4+5
    var snapRowH   = Math.floor((snapTotalH - 8) / 3) - 2;
    var snapGap    = Math.floor((snapTotalH - 8 - 3 * snapRowH) / 2);

    // Box background
    ctx.fillStyle = 'rgba(0,8,22,0.85)';
    ctx.beginPath(); ctx.roundRect(snapBoxX, snapStartY, snapBoxW, snapTotalH, 3); ctx.fill();
    ctx.strokeStyle = '#223344'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect(snapBoxX, snapStartY, snapBoxW, snapTotalH, 3); ctx.stroke();

    var _rsl = {0:'ROT FREE',15:'ROT 15°',30:'ROT 30°',45:'ROT 45°',90:'ROT 90°'};
    var snapBtnX = snapBoxX + 2;
    var snapBtnX2 = snapBoxX + 2 + snapColW + 2;  // right col x
    var snapRow0Y = snapStartY + 2;
    var snapRow1Y = snapStartY + 2 + snapRowH + snapGap;
    var snapRow2Y = snapStartY + 2 + (snapRowH + snapGap) * 2;

    // ── Left column: 3 snap toggle buttons ───────────────────────────────────
    var lenOn  = (window._editorLenSnap || 0) > 0;
    var widOn  = (window._editorWidSnap || 0) > 0;
    var rotOn  = (this._editorSnapDeg || 0) > 0;
    var lenLbl = lenOn ? ('LEN ' + (window._editorLenSnap||10) + 'px') : 'LEN\nSNAP';
    var widLbl = widOn ? ('WID ' + (window._editorWidSnap||5)  + 'px') : 'WID\nSNAP';
    var rotLbl = _rsl[this._editorSnapDeg||0] || 'ROT\nFREE';

    var snapBoxBtns = [];
    var lsRect = btn(lenLbl, snapBtnX, snapRow0Y, snapColW, snapRowH, '#00ff88', lenOn, {fs:6, multiline:true});
    lsRect.snapKey = 'lenSnap'; snapBoxBtns.push(lsRect);
    var wsRect = btn(widLbl, snapBtnX, snapRow1Y, snapColW, snapRowH, '#ff8844', widOn, {fs:6, multiline:true});
    wsRect.snapKey = 'widSnap'; snapBoxBtns.push(wsRect);
    var rsRect = btn(rotLbl, snapBtnX, snapRow2Y, snapColW, snapRowH, '#ffaa00', rotOn, {fs:6, multiline:true});
    rsRect.snapKey = 'rotSnap'; snapBoxBtns.push(rsRect);
    this._editorSnapBoxBtns = snapBoxBtns;

    // ── Right column top: GRID toggle + GRID SNAP toggle ─────────────────────
    var gridOn = window._snapToGrid || false;
    var gsRect = btn('GRID', snapBtnX2, snapRow0Y, snapColW, snapRowH, '#00ccff', gridOn, {fs:7});
    gsRect.snapKey = 'grid'; snapBoxBtns.push(gsRect);
    var gsnOn = window._snapToGrid || false;
    var gsnRect = btn('GRID\nSNAP', snapBtnX2, snapRow1Y, snapColW, snapRowH, '#00aaff', gsnOn, {fs:6, multiline:true});
    gsnRect.snapKey = 'snapGrid'; snapBoxBtns.push(gsnRect);

    // ── Right column bottom: 3×3 pivot grid ──────────────────────────────────
    var gpBoxX = snapBtnX2;
    var gpBoxY = snapRow2Y;
    var gpBoxW = snapColW;
    var gpBoxH = snapRowH;
    // draw cell background
    ctx.fillStyle = 'rgba(0,10,30,0.7)';
    ctx.beginPath(); ctx.roundRect(gpBoxX, gpBoxY, gpBoxW, gpBoxH, 2); ctx.fill();
    ctx.strokeStyle = '#334455'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.roundRect(gpBoxX, gpBoxY, gpBoxW, gpBoxH, 2); ctx.stroke();
    var gpCellW = Math.floor((gpBoxW - 6) / 3);
    var gpCellH = Math.floor((gpBoxH - 6) / 3);
    var gpG = 2;
    var curGridPiv = window._editorGridSnapPivot || 'CM';
    var gridPivCols = ['L','C','R'], gridPivRowsB = ['T','M','B'];
    this._editorGridPivRects = [];
    for (var gpc = 0; gpc < 3; gpc++) {
      for (var gpr = 0; gpr < 3; gpr++) {
        var gpKey2 = gridPivCols[gpc] + gridPivRowsB[gpr];
        var gpx2   = gpBoxX + 3 + gpc * (gpCellW + gpG);
        var gpy2   = gpBoxY + 3 + gpr * (gpCellH + gpG);
        var gpAct2 = curGridPiv === gpKey2;
        var gpCol2 = (gpKey2 === 'CM') ? '#ffcc44' : '#44ccff';
        ctx.fillStyle   = gpAct2 ? gpCol2 + '44' : 'rgba(0,15,40,0.8)';
        ctx.beginPath(); ctx.roundRect(gpx2, gpy2, gpCellW, gpCellH, 1); ctx.fill();
        ctx.strokeStyle = gpAct2 ? gpCol2 : '#334455';
        ctx.lineWidth   = gpAct2 ? 1.2 : 0.5;
        ctx.beginPath(); ctx.roundRect(gpx2, gpy2, gpCellW, gpCellH, 1); ctx.stroke();
        if (gpAct2) {
          ctx.fillStyle = gpCol2;
          ctx.beginPath(); ctx.arc(gpx2 + gpCellW/2, gpy2 + gpCellH/2, 2, 0, Math.PI*2); ctx.fill();
        }
        this._editorGridPivRects.push({x:gpx2, y:gpy2, w:gpCellW, h:gpCellH, val:gpKey2});
      }
    }

    cY += snapTotalH + 8;   // snap panel height + gap

    // ── Extra gap row between buttons and sliders ──────────────────────────────
    cY += r5H;   // full button-height gap as requested

    // ── BEHAVIOR + PRESET panels (side by side) ───────────────────────────────
    var bpH_base = 88;  // approximate — may grow
    var bpW = Math.floor((contentW - 4) / 2);
    var bpY = cY;

    // Left: behavior panel — STATIC/ROTATE/♪ | MOVEABLE | pivot
    ctx.fillStyle = 'rgba(0,8,22,0.95)';
    ctx.beginPath(); ctx.roundRect(padding, bpY, bpW, bpH_base, 3); ctx.fill();
    ctx.strokeStyle = '#224466'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(padding, bpY, bpW, bpH_base, 3); ctx.stroke();

    var sb2    = this._editorSelected;
    var bd2    = window.BrickDefaults || {};
    var movActive2 = sb2 ? (sb2._movable||false) : (this._editorMovable||false);
    var transOn3   = sb2 ? (sb2._translateOnRotate!==false) : (this._editorTranslate!==false);

    var bRow1Y = bpY + 5;
    var bRowH  = 20;
    var statW  = Math.floor(bpW/3) - 3;

    // STATIC / MOV toggle
    this._editorMovInlineRect = btn(movActive2?'● MOV':'■ STAT', padding+4, bRow1Y, statW*1.1, bRowH,
      movActive2?'#ffaa00':'#4488ff', movActive2, {fs:8});
    // ROTATE mode indicator (↔ROT)
    this._editorTransRect = btn(transOn3?'↔ROT':'⊕ROT', padding+4+statW*1.1+3, bRow1Y, statW*0.9, bRowH,
      transOn3?'#00ff88':'#446688', transOn3, {fs:8});
    // ♪ Note
    var noteOn2 = sb2&&sb2._noteConfig;
    this._editorNoteBtn = btn('🎵', padding+4+statW*2+6, bRow1Y, bRowH, bRowH,
      noteOn2?'#cc44ff':'#446688', noteOn2||false);

    // 3x3 pivot grid
    var pivX3  = padding + 4;
    var pivY3  = bRow1Y + bRowH + 4;
    var pW9=22, pG9=3;
    var pivCols=['L','C','R'], pivRows2=['T','M','B'];
    var pivColors3=['#ffcc44','#44ccff','#ff8844'];
    var curPiv3 = sb2?(sb2._pivot||'CM'):(this._editorPivot||'CM');
    var pivEnabled2 = transOn3;
    this._editorPivotRects = [];
    for (var pc=0; pc<3; pc++) {
      for (var pr=0; pr<3; pr++) {
        var pivKey=pivCols[pc]+pivRows2[pr];
        var px9=pivX3+pc*(pW9+pG9), py9=pivY3+pr*(pW9*0.7+pG9);
        var pAct9=pivEnabled2&&curPiv3===pivKey;
        var pCol9 = (pivKey==='CM') ? '#ffcc44' : '#44ccff';
        ctx.globalAlpha=pivEnabled2?1.0:0.28;
        ctx.fillStyle=pAct9?pCol9+'44':'rgba(0,10,30,0.6)';
        ctx.beginPath(); ctx.roundRect(px9,py9,pW9,pW9*0.7,2); ctx.fill();
        ctx.strokeStyle=pAct9?pCol9:'#334455'; ctx.lineWidth=pAct9?1.5:0.6;
        ctx.beginPath(); ctx.roundRect(px9,py9,pW9,pW9*0.7,2); ctx.stroke();
        if(pAct9){ctx.fillStyle=pCol9;ctx.beginPath();ctx.arc(px9+pW9/2,py9+pW9*0.35,2.5,0,Math.PI*2);ctx.fill();}
        ctx.globalAlpha=1.0;
        this._editorPivotRects.push({x:px9,y:py9,w:pW9,h:pW9*0.6,val:pivKey,enabled:pivEnabled2});
      }
    }

    // Right: preset panel — LOAD | SAVE | preset name | DEFAULT
    var ppX = padding + bpW + 4;
    ctx.fillStyle = 'rgba(0,8,22,0.95)';
    ctx.beginPath(); ctx.roundRect(ppX, bpY, bpW, bpH_base, 3); ctx.fill();
    ctx.strokeStyle = '#224466'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(ppX, bpY, bpW, bpH_base, 3); ctx.stroke();

    var ppBW = Math.floor(bpW/2) - 5;
    this._editorLoadPresetBtn = btn('LOAD', ppX+4,        bpY+5, ppBW, bRowH, '#00ccff', false, {fs:8});
    this._editorSavePresetBtn = btn('SAVE', ppX+4+ppBW+3, bpY+5, ppBW, bRowH, '#00ff88', false, {fs:8});

    // Current preset name display
    var presetName = this._editorCurrentPreset || '— none —';
    ctx.fillStyle = 'rgba(0,10,30,0.8)';
    ctx.beginPath(); ctx.roundRect(ppX+4, bpY+5+bRowH+3, bpW-8, bRowH, 2); ctx.fill();
    ctx.strokeStyle = '#334466'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect(ppX+4, bpY+5+bRowH+3, bpW-8, bRowH, 2); ctx.stroke();
    ctx.fillStyle = '#88aabb'; ctx.font = "7px '"+mono+"'";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(presetName.slice(0,16), ppX+4+(bpW-8)/2, bpY+5+bRowH+3+bRowH/2);

    // DEFAULT button
    var defMode = this._editorDefaultMode || false;
    this._editorDefaultBtn = btn(defMode?'CANCEL\nDEF':'DEFAULT', ppX+4, bpY+5+bRowH*2+8,
      bpW-8, bRowH*1.4, '#ffcc00', defMode, {fs:8});

    cY = bpY + bpH_base + 5;

    // ── SLIDER PANELS ─────────────────────────────────────────────────────────
    var slRH  = 26;  // row height per slider
    var slGap = 4;

    // Read values
    var LENval   = sb2?(sb2.w||sb2.r*2||70):(bd2.rectW||70);
    var WIDval   = sb2?(sb2.h||sb2.r*2||22):(bd2.rectH||22);
    var ROTval   = sb2?((sb2._rotation||0)*180/Math.PI):0;
    while (ROTval>180) ROTval-=360; while (ROTval<-180) ROTval+=360;
    var HPval    = (sb2&&sb2.maxHealth!==undefined)?sb2.maxHealth:(bd2.rectHP||100);
    var REGval   = (sb2&&sb2.regenAfter!==undefined)?sb2.regenAfter:(bd2.rectRegen||2000);
    var DENSval  = (sb2&&sb2._density!==undefined)?sb2._density:(bd2.density||1.0);
    var DISTval  = (sb2&&sb2._maxTravel!==undefined)?sb2._maxTravel:(bd2.maxTravel||60);
    var DECELval = (sb2&&sb2._decel!==undefined)?sb2._decel:(bd2.decel||0.88);
    var ROTSPDval= (sb2&&sb2._rotSpeed!==undefined)?sb2._rotSpeed:(bd2.rotSpeed||0.3);
    var ROTDECval= (sb2&&sb2._rotDecel!==undefined)?sb2._rotDecel:(bd2.rotDecel||0.88);
    var WBOUNCEval=(sb2&&sb2._wallBounce!==undefined)?sb2._wallBounce:(bd2.wallBounce||0.45);
    var SPINDISTval=(sb2&&sb2._spinDist!==undefined)?sb2._spinDist:(bd2.spinDist||0.5);
    var HPinf    = (sb2&&sb2._invincible)||false;
    var noRegen  = (sb2&&sb2._noRegen)||false;

    this._editorSliders = {};

    // ── Panel 1: TRANSFORM ────────────────────────────────────────────────────
    var ph1 = panelHeader('TRANSFORM', 'transform', padding, cY, contentW, '#00ccff');
    this._editorPanelHeaders = this._editorPanelHeaders || [];
    this._editorPanelHeaders[0] = ph1;
    cY += ph1.h + 2;

    if (!ph1.collapsed) {
      var p1W2 = Math.floor((contentW-4)/2);
      this._editorSliders.blen = slider('LEN', LENval, 5, 900, padding, cY, p1W2, {rowH:slRH,col:'#00ccff'});
      this._editorSliders.bwid = slider('WID', WIDval, 2, 200, padding+p1W2+4, cY, p1W2, {rowH:slRH,col:'#00ccff'});
      cY += slRH + slGap;

      var rotW2 = Math.floor((contentW)*0.6);
      this._editorSliders.rot = slider('ROT', ROTval, -180, 180, padding, cY, rotW2, {rowH:slRH,col:'#cc44ff'});
      // pivot grid beside rotation slider
      var rPivX = padding+rotW2+6, rPivY = cY+2;
      var rpW=14, rpG=2;
      this._editorRotPivRects = this._editorRotPivRects||[];
      this._editorRotPivRects = [];
      for (var rpc=0; rpc<3; rpc++) {
        for (var rpr=0; rpr<3; rpr++) {
          var rpKey=pivCols[rpc]+pivRows2[rpr];
          var rpx=rPivX+rpc*(rpW+rpG), rpy=rPivY+rpr*(rpW*0.65+rpG);
          var rpAct=curPiv3===rpKey;
          ctx.fillStyle=rpAct?pivColors3[rpc]+'44':'rgba(0,10,30,0.6)';
          ctx.beginPath(); ctx.roundRect(rpx,rpy,rpW,rpW*0.65,1); ctx.fill();
          ctx.strokeStyle=rpAct?pivColors3[rpc]:'#334455'; ctx.lineWidth=rpAct?1.2:0.5;
          ctx.beginPath(); ctx.roundRect(rpx,rpy,rpW,rpW*0.65,1); ctx.stroke();
          if(rpAct){ctx.fillStyle=pivColors3[rpc];ctx.beginPath();ctx.arc(rpx+rpW/2,rpy+rpW*0.32,1.5,0,Math.PI*2);ctx.fill();}
          this._editorRotPivRects.push({x:rpx,y:rpy,w:rpW,h:rpW*0.65,val:rpKey});
        }
      }
      cY += slRH + slGap;
    }

    // ── Panel 2: BRICK SETTINGS ───────────────────────────────────────────────
    var ph2 = panelHeader('BRICK SETTINGS', 'brickset', padding, cY, contentW, '#ffaa00');
    this._editorPanelHeaders[1] = ph2;
    cY += ph2.h + 2;

    if (!ph2.collapsed) {
      var p2W = Math.floor((contentW-8)/3);
      this._editorSliders.hp    = slider('HP',    HPval,   10, 400, padding,          cY, p2W, {rowH:slRH,col:'#ff4444'});
      this._editorSliders.regen = slider('REGEN', noRegen?0:Math.max(200,REGval), 200, 10000, padding+p2W+4, cY, p2W, {rowH:slRH,col:'#ff8844'});
      this._editorSliders.dens  = slider('DENS',  DENSval, 0.5, 5.0, padding+(p2W+4)*2, cY, p2W, {rowH:slRH,col:'#ffcc44'});

      // ∞ HP button and ✕ REGEN button
      var hpInfX  = this._editorSliders.hp.valX    + this._editorSliders.hp.valW + 1;
      var regenCX = this._editorSliders.regen.valX + this._editorSliders.regen.valW + 1;
      this._editorInfHPBtn    = btn(HPinf?'∞':'∞',   hpInfX,  cY+slRH/2-8, 16, 16, '#ff8800', HPinf, {fs:9});
      this._editorNoRegenBtn  = btn(noRegen?'✕':'∞', regenCX, cY+slRH/2-8, 16, 16, noRegen?'#ff4444':'#ff8800', noRegen, {fs:9});
      cY += slRH + slGap;
    }

    // ── Panel 3: BRICK PHYSICS ────────────────────────────────────────────────
    var ph3 = panelHeader('BRICK PHYSICS', 'brickphys', padding, cY, contentW, '#cc44ff');
    this._editorPanelHeaders[2] = ph3;
    cY += ph3.h + 2;

    if (!ph3.collapsed) {
      var p3W2 = Math.floor((contentW-8)/3);
      var p3W3 = Math.floor((contentW-4)/2);
      var grayed3 = !movActive2;
      this._editorSliders.dist    = slider('DIST',     DISTval,         0, 900, padding,           cY, p3W2, {rowH:slRH,col:'#00ccff',grayed:grayed3});
      this._editorSliders.decel   = slider('DECEL',    1-DECELval,   0.01, 0.5, padding+p3W2+4,    cY, p3W2, {rowH:slRH,col:'#00aaff',grayed:grayed3});
      this._editorSliders.spinDist= slider('SPIN/DIST',SPINDISTval,     0, 1.0, padding+(p3W2+4)*2,cY, p3W2, {rowH:slRH,col:'#44ccff',grayed:grayed3});
      cY += slRH + slGap;
      this._editorSliders.rotspd  = slider('RSPIN',    ROTSPDval,     0.0, 1.0, padding,           cY, p3W3, {rowH:slRH,col:'#ff8844',grayed:grayed3});
      this._editorSliders.rotdec  = slider('RDECEL',   1-ROTDECval, 0.05,0.95, padding+p3W3+4,     cY, p3W3, {rowH:slRH,col:'#ff6644',grayed:grayed3});
      cY += slRH + slGap;
      this._editorSliders.wbounce = slider('BNCE',     WBOUNCEval,    0.0, 1.0, padding,           cY, contentW, {rowH:slRH,col:'#4488ff'});
      cY += slRH + slGap;
    }

    // ── DEFAULT mode: RESET ALL button + VAL window highlights ───────────────
    this._editorDefaultAllBtn = null;
    if (this._editorDefaultMode) {
      // RESET ALL button
      var dabW = Math.floor((contentW)/2), dabH = 26;
      var dabX = padding + (contentW-dabW)/2;
      ctx.fillStyle = 'rgba(255,100,0,0.3)';
      ctx.beginPath(); ctx.roundRect(dabX, cY+4, dabW, dabH, 4); ctx.fill();
      ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 2;
      ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.roundRect(dabX, cY+4, dabW, dabH, 4); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffaa44'; ctx.font = "bold 10px '" + mono + "'";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⟳ RESET ALL', dabX + dabW/2, cY+4+dabH/2);
      this._editorDefaultAllBtn = { x:dabX, y:cY+4, w:dabW, h:dabH };
      cY += dabH + 8;

      // Highlight all VAL windows orange
      var _allSliderKeys = ['blen','bwid','rot','hp','regen','dens','dist','decel','rotspd','rotdec','wbounce','spinDist'];
      for (var dhi=0; dhi<_allSliderKeys.length; dhi++) {
        var dhsl = this._editorSliders[_allSliderKeys[dhi]];
        if (!dhsl || !dhsl.valX) continue;
        ctx.fillStyle = 'rgba(255,140,0,0.35)';
        ctx.beginPath(); ctx.roundRect(dhsl.valX, dhsl.valY, dhsl.valW, dhsl.valH, 2); ctx.fill();
        ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(dhsl.valX, dhsl.valY, dhsl.valW, dhsl.valH, 2); ctx.stroke();
      }
    }

    // ── Note picker popup ─────────────────────────────────────────────────────
    if (this._editorNotePopup && sb2) this._drawNotePopup(ctx, sb2);

    // ── Selected brick highlight ──────────────────────────────────────────────
    if (this._editorSelected) {
      var sb = this._editorSelected;
      var toolMode2 = this._editorToolMode || 'build';
      var modeColors = { build:'rgba(255,255,100,0.85)', select:'rgba(255,200,0,0.85)',
                         scale:'rgba(0,255,136,0.85)', rotate:'rgba(200,68,255,0.85)' };
      ctx.strokeStyle = modeColors[toolMode2] || 'rgba(255,255,100,0.85)';
      ctx.lineWidth = 2; ctx.setLineDash([4,4]);
      ctx.save();
      if (sb._rotation) { ctx.translate(sb.x,sb.y); ctx.rotate(sb._rotation); ctx.translate(-sb.x,-sb.y); }
      if (sb instanceof CircularBrick) {
        ctx.beginPath(); ctx.arc(sb.x,sb.y,sb.r+6,0,Math.PI*2); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.roundRect(sb.x-sb.w/2-5,sb.y-sb.h/2-5,sb.w+10,sb.h+10,4); ctx.stroke();
      }
      ctx.restore(); ctx.setLineDash([]);

      if (toolMode2==='rotate'||this._editorRotateState) {
        var pivot4 = sb._pivot||'CM';
        var pOff4  = this._getPivotOffset(sb, pivot4);
        var pvX4   = sb.x+Math.cos(sb._rotation||0)*pOff4.x-Math.sin(sb._rotation||0)*pOff4.y;
        var pvY4   = sb.y+Math.sin(sb._rotation||0)*pOff4.x+Math.cos(sb._rotation||0)*pOff4.y;
        ctx.save(); ctx.strokeStyle='#cc44ff'; ctx.lineWidth=1.5;
        ctx.shadowColor='#cc44ff'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.arc(pvX4,pvY4,6,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pvX4-9,pvY4);ctx.lineTo(pvX4+9,pvY4);
        ctx.moveTo(pvX4,pvY4-9);ctx.lineTo(pvX4,pvY4+9); ctx.stroke();
        ctx.shadowBlur=0; ctx.restore();
      }
      if (toolMode2==='scale'||this._editorStretchState) {
        var bRot8=sb._rotation||0, hw2=(sb.w||40)/2;
        var side8=this._editorStretchState?this._editorStretchState.side:null;
        var ends8=side8?[side8]:['left','right'];
        ends8.forEach(function(s){
          var ex=sb.x+Math.cos(bRot8)*hw2*(s==='right'?1:-1);
          var ey=sb.y+Math.sin(bRot8)*hw2*(s==='right'?1:-1);
          ctx.save(); ctx.strokeStyle='#00ff88'; ctx.lineWidth=2;
          ctx.shadowColor='#00ff88'; ctx.shadowBlur=10;
          ctx.beginPath(); ctx.arc(ex,ey,6,0,Math.PI*2); ctx.stroke();
          ctx.shadowBlur=0; ctx.restore();
        });
      }
    }

    ctx.filter = 'none';
    ctx.restore();
  }

  _saveCustomLevel() {
    var self = this;
    var defaultName = 'My Level ' + (Date.now() % 10000);
    this._neonPrompt('Save level as:', defaultName, function(levelName) {
      if (!levelName || !levelName.trim()) return;
      levelName = levelName.trim();
      var W = self.W, floorY = self.floorY();
      // Serialize bricks
      var brickData = self.bricks.map(function(b) {
        return {
          type: b instanceof CircularBrick ? 'circular_brick' : 'breakable_brick',
          x: b.x, y: b.y, w: b.w || null, h: b.h || null, r: b.r || null,
          rotation: b._rotation || 0,
          health: b.maxHealth || 100, regenAfter: b.regenAfter || null,
          _movable: b._movable || false, _density: b._density,
          _maxTravel: b._maxTravel, _decel: b._decel,
          _rotSpeed: b._rotSpeed, _rotDecel: b._rotDecel,
          _wallBounce: b._wallBounce, _invincible: b._invincible || false,
          _noRegen: b._noRegen || false, _noteConfig: b._noteConfig || null,
          _pivot: b._pivot || 'CM', _translateOnRotate: b._translateOnRotate,
          _spinDist: b._spinDist,
          id: b.id || ('b_' + Math.random().toString(36).slice(2,8))
        };
      });
      // Serialize active balls
      var ballData = self.objects.map(function(o) {
        return {
          type: o.type, x: o.x, y: o.y, r: o.r, mass: o.mass,
          vx: o.vx || 0, vy: o.vy || 0,
          color: o.color, glow: o.glow, label: o.label,
          inFlight: o.inFlight || false, pinned: o.pinned || false,
          stuckTo: o.stuckTo || null, gravActive: o.gravActive || false,
          _fromChute: o._fromChute || false,
          _cubeRot: o._cubeRot || null, _cubeRX: o._cubeRX, _cubeRY: o._cubeRY, _cubeRZ: o._cubeRZ,
          _cubeHP: o._cubeHP, _cubeMaxHP: o._cubeMaxHP,
          _explodeTier: o._explodeTier, bouncesLeft: o.bouncesLeft,
          _sqAmp: o._sqAmp, _sqFreq: o._sqFreq, _sqFade: o._sqFade,
          _sqDelay: o._sqDelay, _sqWave: o._sqWave,
        };
      });
      // Serialize tubes
      var tubeData = self.tubes ? self.tubes.toJSON() : [];
      var levelObj = {
        id: 'custom_' + Date.now(),
        name: levelName,
        custom: true,
        balls: [{ type: 'bouncer', count: 5 }],
        obstacles: [],
        objects: brickData,
        activeBalls: ballData,
        tubeData: tubeData,
        target: { rx: 0.15, ry: 0.10, r: 1, barrierR: 1, barrierThickness: 0, barrierGap: Math.PI, barrierGapAngle: 0 },
        objectives: [],
      };
      // Save to localStorage
      var saved = JSON.parse(localStorage.getItem('puzzballs_custom_levels') || '[]');
      saved.push(levelObj);
      localStorage.setItem('puzzballs_custom_levels', JSON.stringify(saved));
      // Notify menu to refresh
      if (window._menuRefreshCallback) window._menuRefreshCallback();
      if (window.Sound && Sound.win) Sound.win();
      self._neonAlert("Level '" + levelName + "' saved!\\nIt will appear in the main menu.");
    });
  }

  _showLoadLevelOverlay() {
    var self = this;
    var saved = JSON.parse(localStorage.getItem('puzzballs_custom_levels') || '[]');
    if (!saved.length) {
      this._neonAlert('No saved levels yet.\nUse SAVE to save the current level.');
      return;
    }
    // Build HTML overlay
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,4,16,0.92);z-index:100;display:flex;flex-direction:column;align-items:center;padding:40px 16px 20px;overflow-y:auto;';
    var title = document.createElement('div');
    title.textContent = 'LOAD LEVEL';
    title.style.cssText = "font-family:'Orbitron',sans-serif;font-size:14px;letter-spacing:4px;color:#00e5ff;margin-bottom:16px;text-shadow:0 0 12px #00e5ff88;";
    overlay.appendChild(title);

    for (var i = 0; i < saved.length; i++) {
      (function(idx) {
        var lv = saved[idx];
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;width:100%;max-width:320px;margin-bottom:8px;gap:6px;';

        var nameBtn = document.createElement('div');
        nameBtn.textContent = lv.name || ('Level ' + (idx + 1));
        nameBtn.style.cssText = "flex:1;font-family:'Share Tech Mono',monospace;font-size:11px;color:#00e5ff;background:rgba(0,150,200,0.1);border:1px solid rgba(0,200,255,0.3);border-radius:4px;padding:10px 12px;cursor:pointer;display:flex;align-items:center;";
        nameBtn.addEventListener('click', function() {
          document.body.removeChild(overlay);
          self.loadLevel(lv);
          if (window.Sound && Sound.uiTap) Sound.uiTap(0.3);
        });

        var delBtn = document.createElement('div');
        delBtn.textContent = '\u2715';
        delBtn.style.cssText = "font-size:14px;color:#ff4444;background:rgba(255,50,50,0.1);border:1px solid rgba(255,50,50,0.3);border-radius:4px;padding:10px 12px;cursor:pointer;display:flex;align-items:center;";
        delBtn.addEventListener('click', function() {
          saved.splice(idx, 1);
          localStorage.setItem('puzzballs_custom_levels', JSON.stringify(saved));
          if (window._menuRefreshCallback) window._menuRefreshCallback();
          document.body.removeChild(overlay);
          if (saved.length) self._showLoadLevelOverlay();
          else self._neonAlert('All levels deleted.');
        });

        row.appendChild(nameBtn);
        row.appendChild(delBtn);
        overlay.appendChild(row);
      })(i);
    }

    var cancelBtn = document.createElement('div');
    cancelBtn.textContent = 'CANCEL';
    cancelBtn.style.cssText = "margin-top:12px;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:3px;color:#ff8844;background:rgba(255,100,0,0.1);border:1px solid rgba(255,100,0,0.3);border-radius:4px;padding:10px 24px;cursor:pointer;";
    cancelBtn.addEventListener('click', function() {
      document.body.removeChild(overlay);
    });
    overlay.appendChild(cancelBtn);
    document.body.appendChild(overlay);
  }

  _tubeEditorOnDown(pos) {
    var tubes = this.tubes.tubes;
    // Try to select existing tube first (always, in both modes)
    var hitTube = null;
    for (var ti = tubes.length - 1; ti >= 0; ti--) {
      var tube = tubes[ti];
      var path = tube._path;
      if (!path) continue;
      for (var pi = 0; pi < path.length; pi++) {
        if (Math.hypot(pos.x - path[pi].x, pos.y - path[pi].y) < tube.radius + 16) {
          hitTube = tube; break;
        }
      }
      if (hitTube) break;
    }
    if (hitTube) {
      // Tube delete mode: tap = delete
      if (this._tubeDeleteMode) {
        this.tubes.remove(hitTube);
        if (this._tubeSelected === hitTube) this._tubeSelected = null;
        if (window.Sound && Sound.uiTap) Sound.uiTap(0.3);
        return;
      }
      var now2 = performance.now();
      var dtap = now2 - (this._lastTubeTap || 0);
      this._lastTubeTap = now2;
      // Double-tap = disconnect from all connected tubes (both modes)
      if (dtap < 350 && this._lastTubeTapId === hitTube.id) {
        if (hitTube.connectedA || hitTube.connectedB) {
          this.tubes.disconnect(hitTube);
          // Nudge tube slightly so it's visually obvious it's disconnected
          var nudgeAngle = hitTube.rotation + Math.PI / 2;
          hitTube.x += Math.cos(nudgeAngle) * 12;
          hitTube.y += Math.sin(nudgeAngle) * 12;
          hitTube.rebuild();
          if (window.Sound && Sound.uiTap) Sound.uiTap(0.3);
          this._lastTubeTap = 0;
          return;
        }
      }
      this._lastTubeTapId = hitTube.id;
      this._tubeSelected = hitTube;
      var tubeTool = this._tubeToolMode || 'build';
      if (tubeTool === 'rotate') {
        // Single-finger rotate: store start angle for drag
        this._tubeRotateState = {
          tube: hitTube,
          startAngle: Math.atan2(pos.y - hitTube.y, pos.x - hitTube.x),
          origRot: hitTube.rotation,
        };
        this._tubeDragging = null;
        return;
      }
      if (tubeTool === 'length') {
        // Single-finger length: drag along tube axis
        this._tubeLengthState = {
          tube: hitTube,
          startX: pos.x, startY: pos.y,
          origLen: hitTube.length,
        };
        this._tubeDragging = null;
        return;
      }
      // Zone logic for connected tubes:
      // - Tap within endZone of a FREE socket on an end tube → pivot around its joint
      // - Everything else on a connected tube → group drag the whole chain
      // This means the entire tube body (except the free end tip) moves the group.
      var endZone = hitTube.radius * 2.5;
      var tappedFreeEnd = false;
      if (hitTube.connectedA || hitTube.connectedB) {
        // Check if tap is near a free (unconnected) socket — only for end tubes
        var isEndTube = !(hitTube.connectedA && hitTube.connectedB);
        if (isEndTube) {
          if (!hitTube.connectedA) {
            var sA = hitTube.socketA();
            if (Math.hypot(pos.x - sA.x, pos.y - sA.y) < endZone) tappedFreeEnd = true;
          }
          if (!hitTube.connectedB) {
            var sB = hitTube.socketB();
            if (Math.hypot(pos.x - sB.x, pos.y - sB.y) < endZone) tappedFreeEnd = true;
          }
        }
      }

      if ((hitTube.connectedA || hitTube.connectedB) && !tappedFreeEnd) {
        // Group drag — whole connected chain moves as one unit
        var group = this.tubes.getConnectedGroup(hitTube);
        for (var _ghi = 0; _ghi < group.length; _ghi++) group[_ghi]._groupHighlight = true;
        this._tubeGroupDrag = {
          group: group,
          startX: pos.x, startY: pos.y,
          origins: group.map(function(t) { return { x: t.x, y: t.y }; }),
          cx: group.reduce(function(s,t){return s+t.x;},0)/group.length,
          cy: group.reduce(function(s,t){return s+t.y;},0)/group.length,
          rotOrigins: group.map(function(t) { return { x: t.x, y: t.y, r: t.rotation }; }),
        };
        this._tubeDragging = null;
        this._tubeGroupPinchStart = null;
        return;
      }
      // Normal drag / pivot
      this._tubeGroupDrag = null;
      this._tubeDragging = hitTube;
      hitTube._groupHighlight = true;
      this._tubeDragOffX = pos.x - hitTube.x;
      this._tubeDragOffY = pos.y - hitTube.y;
      this._tubePivotState = tappedFreeEnd
        ? this.tubes.makePivotState(hitTube, pos.x, pos.y)
        : null;
      return;
    }
    // Select mode: don't place new tubes
    if (this._tubeSelectMode) {
      this._tubeSelected = null;
      return;
    }
    // Build mode: place new tube (centered on tap)
    var type  = this._tubeType  || 'straight';
    var style = this._tubeStyle || 'glass';
    var tLen  = this._tubeLength || 80;
    var tRot  = this._tubeRotation || 0;
    // Offset so tube center lands on finger, not socket A
    var halfLen = tLen / 2;
    var cx = pos.x - Math.cos(tRot) * halfLen;
    var cy = pos.y - Math.sin(tRot) * halfLen;
    var tube  = new TubePiece(type, cx, cy, tRot, {
      length: tLen, style: style,
      speedMod: this._tubeSpeedMod || 1.0,
      radius: 14, layer: this._tubeLayer || 'main',
    });
    this.tubes.add(tube);
    this._tubeSelected = tube;
    this._tubeDragging = tube;
    this._tubeDragOffX = pos.x - cx;
    this._tubeDragOffY = pos.y - cy;
    if (window.Sound && Sound.uiTap) Sound.uiTap(0.18);
  }

  _neonPresetLoad(presets, names, callback) {
    var self = this;
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,5,18,0.50);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding-top:60px;box-sizing:border-box;';
    var panel = document.createElement('div');
    panel.style.cssText = 'background:rgba(3,14,37,0.95);border:1.5px solid #00ccff;border-radius:10px;padding:14px;width:90vw;max-width:340px;box-shadow:0 0 30px rgba(0,200,255,0.25);font-family:Share Tech Mono,monospace;max-height:75vh;display:flex;flex-direction:column;';
    var title = document.createElement('div');
    title.style.cssText = 'color:#00e5ff;font-size:12px;font-weight:bold;letter-spacing:2px;margin-bottom:10px;';
    title.textContent = 'LOAD PRESET';
    panel.appendChild(title);
    var cols = document.createElement('div');
    cols.style.cssText = 'display:flex;gap:10px;flex:1;min-height:0;overflow:hidden;';
    var listCol = document.createElement('div');
    listCol.style.cssText = 'flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px;';
    var previewCol = document.createElement('div');
    previewCol.style.cssText = 'width:110px;display:flex;flex-direction:column;gap:6px;flex-shrink:0;';
    var previewCanvas = document.createElement('canvas');
    previewCanvas.width = 110; previewCanvas.height = 80;
    previewCanvas.style.cssText = 'background:rgba(0,8,22,0.9);border:1px solid #00ccff33;border-radius:4px;display:block;';
    previewCol.appendChild(previewCanvas);
    var statEl = document.createElement('div');
    statEl.style.cssText = 'color:#00ccff88;font-size:9px;line-height:1.7;white-space:pre;';
    statEl.textContent = 'tap to preview';
    previewCol.appendChild(statEl);
    cols.appendChild(listCol); cols.appendChild(previewCol);
    panel.appendChild(cols);
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;margin-top:10px;';
    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'CANCEL';
    cancelBtn.style.cssText = 'flex:1;background:rgba(255,50,50,0.1);border:1px solid #ff306055;color:#ff6080;font-family:Share Tech Mono,monospace;font-size:11px;padding:8px;border-radius:5px;cursor:pointer;';
    var loadBtn = document.createElement('button');
    loadBtn.textContent = 'LOAD';
    loadBtn.disabled = true;
    loadBtn.style.cssText = 'flex:1;background:rgba(0,255,136,0.15);border:1px solid #00ff88;color:#00ff88;font-family:Share Tech Mono,monospace;font-size:11px;padding:8px;border-radius:5px;cursor:pointer;opacity:0.35;';
    btnRow.appendChild(cancelBtn); btnRow.appendChild(loadBtn);
    panel.appendChild(btnRow);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    var selectedName = null, btnEls = [];
    function drawPreview(p) {
      var ctx2 = previewCanvas.getContext('2d');
      ctx2.clearRect(0,0,110,80);
      ctx2.fillStyle = 'rgba(0,8,22,0.95)'; ctx2.fillRect(0,0,110,80);
      var w = p.rectW||70, h = p.rectH||22;
      var scale = Math.min(90/w, 60/h, 1.5);
      var bw = w*scale, bh = h*scale;
      var bx = 55-bw/2, by = 38-bh/2;
      ctx2.shadowColor='#00ccff'; ctx2.shadowBlur=8;
      ctx2.fillStyle='rgba(0,180,255,0.2)';
      ctx2.beginPath(); ctx2.roundRect(bx,by,bw,bh,2); ctx2.fill();
      ctx2.strokeStyle='#00ccff'; ctx2.lineWidth=1.5;
      ctx2.beginPath(); ctx2.roundRect(bx,by,bw,bh,2); ctx2.stroke();
      ctx2.shadowBlur=0;
      ctx2.fillStyle='#00ccff66'; ctx2.font="8px 'Share Tech Mono',monospace";
      ctx2.textAlign='center';
      ctx2.fillText(Math.round(w)+'×'+Math.round(h)+'px', 55, 72);
    }
    function showPreview(name, p) {
      drawPreview(p);
      statEl.textContent = 'HP: '+(p.rectHP||100)+'\nDENS: '+((p.density||1).toFixed(1))+'\nBNCE: '+((p.wallBounce||0.45).toFixed(2))+'\nDIST: '+(p.maxTravel||60)+'px';
    }
    names.forEach(function(name) {
      var btn = document.createElement('button');
      btn.textContent = name;
      btn.style.cssText = 'background:rgba(0,200,255,0.05);border:1px solid #00ccff22;color:#00ccff77;font-family:Share Tech Mono,monospace;font-size:11px;padding:8px 10px;border-radius:4px;cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      btn.addEventListener('click', function() {
        selectedName = name;
        btnEls.forEach(function(b){ b.style.background='rgba(0,200,255,0.05)'; b.style.borderColor='#00ccff22'; b.style.color='#00ccff77'; });
        btn.style.background='rgba(0,200,255,0.2)'; btn.style.borderColor='#00ccff'; btn.style.color='#00e5ff';
        loadBtn.disabled=false; loadBtn.style.opacity='1';
        showPreview(name, presets[name]);
        if(window.Sound&&Sound.uiTap)Sound.uiTap(0.15);
      });
      btnEls.push(btn); listCol.appendChild(btn);
    });
    function close(picked) { document.body.removeChild(overlay); callback(picked); }
    cancelBtn.addEventListener('click', function(){ close(null); });
    loadBtn.addEventListener('click', function(){ if(selectedName) close(selectedName); });
    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(null); });
  }

// ── Neon-styled prompt overlay ────────────────────────────────────────────
  _neonPrompt(title, defaultVal, callback) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,5,18,0.50);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:#030e25;border:1.5px solid #00ccff;border-radius:10px;padding:20px 18px 16px;width:82vw;max-width:320px;box-shadow:0 0 30px rgba(0,200,255,0.3);font-family:Share Tech Mono,monospace;';
    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'color:#00e5ff;font-size:13px;font-weight:bold;margin-bottom:12px;white-space:pre-line;line-height:1.5;';
    titleEl.textContent = title;
    var input = document.createElement('input');
    input.type = 'text';
    input.value = defaultVal || '';
    input.style.cssText = 'width:100%;box-sizing:border-box;background:#000e24;border:1px solid #00ccff55;border-bottom:2px solid #00ccff;color:#00e5ff;font-family:Share Tech Mono,monospace;font-size:15px;padding:8px 6px;outline:none;border-radius:4px;';
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;margin-top:14px;';
    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'CANCEL';
    cancelBtn.style.cssText = 'flex:1;background:rgba(255,50,50,0.15);border:1px solid #ff3060;color:#ff6080;font-family:Share Tech Mono,monospace;font-size:12px;padding:9px;border-radius:5px;cursor:pointer;';
    var okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = 'flex:1;background:rgba(0,255,136,0.15);border:1px solid #00ff88;color:#00ff88;font-family:Share Tech Mono,monospace;font-size:12px;padding:9px;border-radius:5px;cursor:pointer;';
    btnRow.appendChild(cancelBtn); btnRow.appendChild(okBtn);
    box.appendChild(titleEl); box.appendChild(input); box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    setTimeout(function(){ input.focus(); input.select(); }, 50);
    function close(val) { document.body.removeChild(overlay); callback(val); }
    cancelBtn.addEventListener('click', function(){ close(null); });
    okBtn.addEventListener('click', function(){ close(input.value); });
    input.addEventListener('keydown', function(e){ if(e.key==='Enter') close(input.value); if(e.key==='Escape') close(null); });
    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(null); });
  }

  _neonAlert(title, callback) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,5,18,0.50);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:#030e25;border:1.5px solid #ffaa00;border-radius:10px;padding:20px 18px 16px;width:82vw;max-width:320px;box-shadow:0 0 30px rgba(255,170,0,0.25);font-family:Share Tech Mono,monospace;';
    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'color:#ffcc44;font-size:13px;margin-bottom:14px;white-space:pre-line;line-height:1.5;';
    titleEl.textContent = title;
    var okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = 'width:100%;background:rgba(255,170,0,0.15);border:1px solid #ffaa00;color:#ffcc44;font-family:Share Tech Mono,monospace;font-size:12px;padding:10px;border-radius:5px;cursor:pointer;';
    box.appendChild(titleEl); box.appendChild(okBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close() { document.body.removeChild(overlay); if(callback)callback(); }
    okBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(); });
  }

  _neonPicker(title, options, callback) {
    // options: array of {label, value}
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,5,18,0.50);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:#030e25;border:1.5px solid #cc44ff;border-radius:10px;padding:16px 14px;width:82vw;max-width:300px;box-shadow:0 0 30px rgba(200,68,255,0.25);font-family:Share Tech Mono,monospace;';
    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'color:#dd88ff;font-size:12px;font-weight:bold;margin-bottom:10px;';
    titleEl.textContent = title;
    box.appendChild(titleEl);
    function close(val) { document.body.removeChild(overlay); callback(val); }
    options.forEach(function(opt) {
      var btn = document.createElement('button');
      btn.textContent = opt.label;
      btn.style.cssText = 'display:block;width:100%;background:rgba(200,68,255,0.1);border:1px solid #cc44ff55;color:#dd88ff;font-family:Share Tech Mono,monospace;font-size:13px;padding:10px;margin-bottom:6px;border-radius:5px;cursor:pointer;text-align:left;';
      btn.addEventListener('click', function(){ close(opt.value); });
      btn.addEventListener('touchstart', function(){ btn.style.background='rgba(200,68,255,0.3)'; });
      box.appendChild(btn);
    });
    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'CANCEL';
    cancelBtn.style.cssText = 'display:block;width:100%;background:transparent;border:1px solid #334455;color:#446677;font-family:Share Tech Mono,monospace;font-size:11px;padding:8px;border-radius:5px;cursor:pointer;margin-top:4px;';
    cancelBtn.addEventListener('click', function(){ close(null); });
    box.appendChild(cancelBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(null); });
  }

  _drawTubeEditor(ctx, panelY) {
    var W = this.W;
    var padding = 24, btnH = 22, rH = 20, gap = 5;
    var contentW = W - padding * 2;

    // ── Row 0: 4-mode toolbar (BLD|SEL|LEN|ROT) + DONE ────────────────────────
    var row0Y = panelY + 4;
    var tubeToolMode = this._tubeToolMode || 'build';
    this._tubeSelectMode = (tubeToolMode !== 'build');
    var tubeModes = [
      { id:'build',  col:'#00aaff' },
      { id:'select', col:'#ffcc00' },
      { id:'length', col:'#00ff88' },
      { id:'rotate', col:'#cc44ff' },
    ];
    var tmW = 52, tmGap = 3;
    this._tubeModeBtn = null;
    this._tubeModeBtns = [];
    for (var tmi = 0; tmi < tubeModes.length; tmi++) {
      var tm = tubeModes[tmi];
      var tmx = padding + tmi * (tmW + tmGap);
      var tmActive = tubeToolMode === tm.id;
      ctx.fillStyle = tmActive ? tm.col + '44' : 'rgba(0,10,30,0.7)';
      ctx.beginPath(); ctx.roundRect(tmx, row0Y, tmW, btnH, 4); ctx.fill();
      ctx.strokeStyle = tmActive ? tm.col : tm.col + '55'; ctx.lineWidth = tmActive ? 2 : 1;
      if (tmActive) { ctx.shadowColor = tm.col; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.roundRect(tmx, row0Y, tmW, btnH, 4); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.save(); ctx.translate(tmx + tmW/2, row0Y + btnH/2);
      var tc2 = tm.col;
      if (tm.id === 'build') {
        ctx.fillStyle=tc2+'44'; ctx.beginPath(); ctx.ellipse(-9,0,3,5,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.rect(-9,-5,18,10); ctx.fill();
        ctx.beginPath(); ctx.ellipse(9,0,3,5,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=tc2; ctx.lineWidth=1.3; ctx.shadowColor=tc2; ctx.shadowBlur=tmActive?5:0;
        ctx.beginPath(); ctx.moveTo(-9,-5); ctx.lineTo(9,-5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-9,5); ctx.lineTo(9,5); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(9,0,3,5,0,0,Math.PI*2); ctx.stroke(); ctx.shadowBlur=0;
      } else if (tm.id === 'select') {
        ctx.save(); ctx.rotate(-Math.PI/4);
        ctx.beginPath(); ctx.moveTo(-3,-9); ctx.lineTo(3,-9); ctx.lineTo(3,-1); ctx.lineTo(7,-1);
        ctx.lineTo(0,8); ctx.lineTo(-7,-1); ctx.lineTo(-3,-1); ctx.closePath();
        ctx.fillStyle='rgba(0,160,180,0.7)'; ctx.fill();
        ctx.strokeStyle=tc2; ctx.lineWidth=1.3; ctx.setLineDash([2,2]);
        ctx.shadowColor=tc2; ctx.shadowBlur=tmActive?5:0; ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur=0; ctx.restore();
      } else if (tm.id === 'length') {
        ctx.strokeStyle=tc2; ctx.lineWidth=1.3; ctx.shadowColor=tc2; ctx.shadowBlur=tmActive?4:0;
        ctx.fillStyle=tc2+'33'; ctx.beginPath(); ctx.roundRect(-8,-4,16,8,2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(-8,-4,16,8,2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-8,-3); ctx.lineTo(-13,0); ctx.lineTo(-8,3); ctx.moveTo(-8,0); ctx.lineTo(-13,0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8,-3); ctx.lineTo(13,0); ctx.lineTo(8,3); ctx.moveTo(8,0); ctx.lineTo(13,0); ctx.stroke();
        ctx.shadowBlur=0;
      } else if (tm.id === 'rotate') {
        ctx.strokeStyle=tc2; ctx.lineWidth=1.8; ctx.shadowColor=tc2; ctx.shadowBlur=tmActive?5:0;
        ctx.beginPath(); ctx.arc(0,0,7,0.5,Math.PI*2-0.5); ctx.stroke(); ctx.shadowBlur=0;
        ctx.fillStyle=tc2; ctx.beginPath(); ctx.moveTo(5,5); ctx.lineTo(9,2); ctx.lineTo(5,-1); ctx.fill();
        ctx.beginPath(); ctx.arc(0,0,2,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      this._tubeModeBtns.push({ x:tmx, y:row0Y, w:tmW, h:btnH, id:tm.id });
    }

    // No DONE button in tube editor — use main DONE in row 1

    // Shift all content rows down past the mode row
    var row1Y = row0Y + btnH + gap;

    // Tube type buttons
    var types = ['straight','elbow90','elbow45','elbow30','elbow15','uturn','funnel'];
    var labels = ['STR','90°','45°','30°','15°','U','FNL'];
    var tW = Math.floor((contentW) / types.length) - 1;
    var tH = 34;  // taller for easier mobile tapping
    ctx.font = "bold 11px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    this._tubeBtns = [];
    for (var ti = 0; ti < types.length; ti++) {
      var tx = padding + ti * (tW + 2);
      var active = (this._tubeType || 'straight') === types[ti];
      ctx.fillStyle = active ? 'rgba(0,200,120,0.35)' : 'rgba(0,15,40,0.7)';
      ctx.beginPath(); ctx.roundRect(tx, row1Y, tW, tH, 3); ctx.fill();
      ctx.strokeStyle = active ? '#00ff88' : '#224466'; ctx.lineWidth = active ? 1.5 : 0.8;
      ctx.beginPath(); ctx.roundRect(tx, row1Y, tW, tH, 3); ctx.stroke();
      ctx.fillStyle = active ? '#00ff88' : '#557799';
      ctx.fillText(labels[ti], tx + tW/2, row1Y + tH/2);
      this._tubeBtns.push({ x:tx, y:row1Y, w:tW, h:tH, val:types[ti] });
    }
    var row1BotY = row1Y + tH;

    // Style buttons — 4 equal slots
    var row2Y = row1BotY + gap;
    var styles = ['glass','window','solid','energy'];
    var sW = Math.floor((contentW - 6) / 4);
    ctx.font = "bold 11px 'Share Tech Mono',monospace";
    this._tubeStyleBtns = [];
    for (var si = 0; si < styles.length; si++) {
      var sx2 = padding + si * (sW + 2);
      var sAct = (this._tubeStyle || 'glass') === styles[si];
      ctx.fillStyle = sAct ? 'rgba(0,150,200,0.35)' : 'rgba(0,15,40,0.7)';
      ctx.beginPath(); ctx.roundRect(sx2, row2Y, sW, rH, 3); ctx.fill();
      ctx.strokeStyle = sAct ? '#00aaff' : '#224466'; ctx.lineWidth = sAct ? 1.5 : 0.8;
      ctx.beginPath(); ctx.roundRect(sx2, row2Y, sW, rH, 3); ctx.stroke();
      ctx.fillStyle = sAct ? '#44ccff' : '#557799';
      ctx.fillText(styles[si].toUpperCase(), sx2 + sW/2, row2Y + rH/2);
      this._tubeStyleBtns.push({ x:sx2, y:row2Y, w:sW, h:rH, val:styles[si] });
    }
    this._tubeBBoxBtn = null;

    // Sliders: LENGTH | SPEED MOD | ROTATION
    var row3Y = row2Y + rH + gap;
    var halfW = Math.floor((contentW) / 2);
    var lenVal = this._tubeLength || 80;
    var spdVal = this._tubeSpeedMod || 1.0;
    var rotVal = (this._tubeRotation || 0) * 180 / Math.PI;

    var drawTS = function(label, val, min, max, sx, sy, sw) {
      var lblW = 32, trW = sw - lblW - 2;
      var t = Math.max(0, Math.min(1, (val - min) / (max - min)));
      ctx.fillStyle = '#88aacc'; ctx.font = "bold 7px 'Share Tech Mono',monospace";
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, sx + 2, sy + rH/2);
      ctx.fillStyle = 'rgba(0,20,50,0.8)';
      ctx.beginPath(); ctx.roundRect(sx + lblW, sy + rH/2 - 4, trW, 8, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(0,180,255,0.3)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.roundRect(sx + lblW, sy + rH/2 - 4, trW, 8, 4); ctx.stroke();
      ctx.fillStyle = '#0088ffcc';
      ctx.beginPath(); ctx.roundRect(sx + lblW, sy + rH/2 - 4, trW * t, 8, 4); ctx.fill();
      var thX = sx + lblW + trW * t;
      ctx.beginPath(); ctx.arc(thX, sy + rH/2, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#00aaff'; ctx.shadowColor = '#0088ff'; ctx.shadowBlur = 5; ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#aaddff'; ctx.font = "6px 'Share Tech Mono',monospace";
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      var dispVal = label === 'ROT' ? Math.round(val) + '°' : label === 'SPD' ? val.toFixed(1) + 'x' : Math.round(val) + 'px';
      ctx.fillText(dispVal, thX + 7, sy + rH/2);
      return { x: sx + lblW - 10, y: sy - 6, w: trW + 20, h: rH + 12, trackX: sx+lblW, trackW: trW, min: min, max: max, label: label };
    };

    this._tubeSliderLen = drawTS('LEN', lenVal, 30, 300, padding, row3Y, halfW);
    this._tubeSliderSpd = drawTS('SPD', spdVal, 0.2, 3.0, padding + halfW, row3Y, halfW);
    var row4Y = row3Y + rH + gap;
    this._tubeSliderRot = drawTS('ROT', rotVal, -180, 180, padding, row4Y, contentW);
    // Rotation pivot anchor buttons: LEFT | MID | RIGHT
    var row4bY = row4Y + rH + 3;
    var anchors = ['L','MID','R']; var aW = 40;
    this._tubeAnchorBtns = [];
    for (var ai = 0; ai < anchors.length; ai++) {
      var ax2 = padding + ai * (aW + 4);
      var aAct = (this._tubeAnchor || 'MID') === anchors[ai];
      ctx.fillStyle = aAct ? 'rgba(0,160,255,0.35)' : 'rgba(0,15,40,0.6)';
      ctx.beginPath(); ctx.roundRect(ax2, row4bY, aW, 16, 3); ctx.fill();
      ctx.strokeStyle = aAct ? '#00aaff' : '#224466'; ctx.lineWidth = aAct ? 1.4 : 0.7;
      ctx.beginPath(); ctx.roundRect(ax2, row4bY, aW, 16, 3); ctx.stroke();
      ctx.fillStyle = aAct ? '#44ccff' : '#557799';
      ctx.font = "bold 7px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(anchors[ai], ax2 + aW/2, row4bY + 8);
      this._tubeAnchorBtns.push({ x:ax2, y:row4bY, w:aW, h:16, val:anchors[ai] });
    }
    var row5Y = row4bY + 16 + gap;

    // Layer buttons
    var layers = ['main','behind','above'];
    var lW = Math.floor((contentW) / 3);
    this._tubeLayerBtns = [];
    for (var li = 0; li < layers.length; li++) {
      var lx = padding + li * (lW + 2);
      var lAct = (this._tubeLayer || 'main') === layers[li];
      ctx.fillStyle = lAct ? 'rgba(180,100,0,0.35)' : 'rgba(0,15,40,0.7)';
      ctx.beginPath(); ctx.roundRect(lx, row5Y, lW, rH, 3); ctx.fill();
      ctx.strokeStyle = lAct ? '#ffaa00' : '#224466'; ctx.lineWidth = lAct ? 1.5 : 0.8;
      ctx.beginPath(); ctx.roundRect(lx, row5Y, lW, rH, 3); ctx.stroke();
      ctx.fillStyle = lAct ? '#ffcc44' : '#557799';
      ctx.font = "bold 11px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(layers[li].toUpperCase(), lx + lW/2, row5Y + rH/2);
      this._tubeLayerBtns.push({ x:lx, y:row5Y, w:lW, h:rH, val:layers[li] });
    }

    // Selected tube info + delete (DEL button always shown in delete mode)
    var showTubeExtra = this._tubeSelected || this._tubeDeleteMode;
    if (showTubeExtra) {
      var row6Y = row5Y + rH + gap;
      if (this._tubeSelected) {
        var t2 = this._tubeSelected;
        ctx.fillStyle = '#aaddff'; ctx.font = "7px 'Share Tech Mono',monospace";
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('SEL: ' + t2.type + ' | ' + t2.style + ' | ' + t2.layer + ' | spd:' + t2.speedMod.toFixed(1) + 'x', padding, row6Y + rH/2);
      }
      // Delete button — always shown
      var delTX = W - 60;
      this._tubeDelBtn = { x: delTX, y: row6Y, w: 52, h: rH };
      ctx.fillStyle = 'rgba(80,10,10,0.85)';
      ctx.beginPath(); ctx.roundRect(delTX, row6Y, 52, rH, 3); ctx.fill();
      ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(delTX, row6Y, 52, rH, 3); ctx.stroke();
      var tDelAct = this._tubeDeleteMode || false;
      ctx.fillStyle = tDelAct ? 'rgba(180,0,0,0.9)' : 'rgba(80,10,10,0.85)';
      ctx.beginPath(); ctx.roundRect(delTX, row6Y, 52, rH, 3); ctx.fill();
      ctx.strokeStyle = tDelAct ? '#ff2222' : '#ff4444'; ctx.lineWidth = tDelAct ? 2 : 1;
      if (tDelAct) { ctx.shadowColor='#ff0000'; ctx.shadowBlur=8; }
      ctx.beginPath(); ctx.roundRect(delTX, row6Y, 52, rH, 3); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ff8888'; ctx.font = "bold 10px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tDelAct ? '✕ DELETING' : '✕ DEL TUBE', delTX + 26, row6Y + rH/2);
    }

    // (BUILD/SELECT and DONE are drawn at the top of the panel — see row0Y above)
  }

  _drawNotePopup(ctx, brick) {
    var W = this.W, H = this.H;
    var popW = W - 20, popX = 10;
    var popH = 240, popY = this.floorY() - popH - 8;
    if (popY < 80) popY = 80;

    // Backdrop
    ctx.fillStyle = 'rgba(0,5,18,0.96)';
    ctx.beginPath(); ctx.roundRect(popX, popY, popW, popH, 8); ctx.fill();
    ctx.strokeStyle = '#cc44ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(popX, popY, popW, popH, 8); ctx.stroke();

    // Title + close
    ctx.fillStyle = '#dd88ff'; ctx.font = "bold 10px 'Share Tech Mono',monospace";
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('🎵 BRICK NOTE', popX + 10, popY + 8);
    // DONE button — large, top-right of popup, easy to tap
    var doneNoteX = popX + popW - 72, doneNoteY = popY + 4;
    var doneNoteW = 62, doneNoteH = 30;
    this._notePopupClose = { x: doneNoteX - 8, y: doneNoteY - 6, w: doneNoteW + 16, h: doneNoteH + 12 };  // extra hit area
    ctx.fillStyle = 'rgba(0,80,40,0.95)';
    ctx.beginPath(); ctx.roundRect(doneNoteX, doneNoteY, doneNoteW, doneNoteH, 5); ctx.fill();
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2;
    ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.roundRect(doneNoteX, doneNoteY, doneNoteW, doneNoteH, 5); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#00ff88'; ctx.font = "bold 12px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DONE', doneNoteX + doneNoteW/2, doneNoteY + doneNoteH/2);

    var cfg = brick._noteConfig || {};
    var curNote   = cfg.note   || 'C';
    var curOctave = cfg.octave !== undefined ? cfg.octave : 4;
    var curTimbre = cfg.timbre || 'marimba';
    var BN = window.BrickNote;
    var inY = popY + 28;

    // Row 1: Note selector
    ctx.fillStyle = '#8899bb'; ctx.font = "bold 8px 'Share Tech Mono',monospace";
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('NOTE', popX + 10, inY);
    this._notePopupNoteRects = [];
    var nW = 26, nGap = 3, nStartX = popX + 44;
    var notes = BN ? BN.noteNames : ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    var dispN = BN ? BN.noteDisplay : notes;
    for (var ni = 0; ni < notes.length; ni++) {
      var nx = nStartX + ni * (nW + nGap);
      var isBlack = notes[ni].indexOf('#') >= 0;
      var nActive = notes[ni] === curNote;
      ctx.fillStyle = nActive ? 'rgba(180,50,255,0.55)' : (isBlack ? 'rgba(0,5,20,0.8)' : 'rgba(0,15,40,0.7)');
      ctx.beginPath(); ctx.roundRect(nx, inY, nW, 22, 3); ctx.fill();
      ctx.strokeStyle = nActive ? '#cc44ff' : (isBlack ? '#334466' : '#223355'); ctx.lineWidth = nActive ? 1.5 : 0.8;
      ctx.beginPath(); ctx.roundRect(nx, inY, nW, 22, 3); ctx.stroke();
      ctx.fillStyle = nActive ? '#030a18' : (isBlack ? '#aabbdd' : '#7799cc');
      ctx.font = "bold 7px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(dispN[ni], nx + nW/2, inY + 11);
      this._notePopupNoteRects.push({ x: nx, y: inY, w: nW, h: 22, val: notes[ni] });
    }
    inY += 28;

    // Row 2: Octave selector
    ctx.fillStyle = '#8899bb'; ctx.font = "bold 8px 'Share Tech Mono',monospace";
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('OCTAVE', popX + 10, inY);
    this._notePopupOctaveRects = [];
    var octW = 28;
    for (var oi = 1; oi <= 7; oi++) {
      var ox = nStartX + (oi - 1) * (octW + 3);
      var oActive = oi === curOctave;
      ctx.fillStyle = oActive ? 'rgba(80,180,255,0.35)' : 'rgba(0,15,40,0.7)';
      ctx.beginPath(); ctx.roundRect(ox, inY, octW, 22, 3); ctx.fill();
      ctx.strokeStyle = oActive ? '#44aaff' : '#223355'; ctx.lineWidth = oActive ? 1.5 : 0.8;
      ctx.beginPath(); ctx.roundRect(ox, inY, octW, 22, 3); ctx.stroke();
      ctx.fillStyle = oActive ? '#88ddff' : '#5577aa';
      ctx.font = "bold 9px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(oi), ox + octW/2, inY + 11);
      this._notePopupOctaveRects.push({ x: ox, y: inY, w: octW, h: 22, val: oi });
    }
    inY += 28;

    // Row 3: Timbre selector (2 rows of 5)
    ctx.fillStyle = '#8899bb'; ctx.font = "bold 8px 'Share Tech Mono',monospace";
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('TIMBRE', popX + 10, inY);
    this._notePopupTimbreRects = [];
    var tList   = BN ? BN.timbreList   : ['marimba'];
    var tLabels = BN ? BN.timbreLabels : ['Marimba'];
    var tW = Math.floor((popW - 20) / 5) - 3;
    for (var ti4 = 0; ti4 < tList.length; ti4++) {
      var row5 = Math.floor(ti4 / 5), col5 = ti4 % 5;
      var tx = popX + 10 + col5 * (tW + 3);
      var ty = inY + row5 * 26;
      var tActive = tList[ti4] === curTimbre;
      ctx.fillStyle = tActive ? 'rgba(255,120,0,0.35)' : 'rgba(0,15,40,0.7)';
      ctx.beginPath(); ctx.roundRect(tx, ty, tW, 22, 3); ctx.fill();
      ctx.strokeStyle = tActive ? '#ff8800' : '#223355'; ctx.lineWidth = tActive ? 1.5 : 0.8;
      ctx.beginPath(); ctx.roundRect(tx, ty, tW, 22, 3); ctx.stroke();
      ctx.fillStyle = tActive ? '#ffaa44' : '#5577aa';
      ctx.font = "bold 7px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tLabels[ti4], tx + tW/2, ty + 11);
      this._notePopupTimbreRects.push({ x: tx, y: ty, w: tW, h: 22, val: tList[ti4] });
    }
    inY += 58;

    // Preview + Clear + Volume row
    var prevX = popX + 10, clearBtnX = popX + popW/2 + 5;
    this._notePopupPreviewBtn = { x: prevX, y: inY, w: popW/2 - 15, h: 22 };
    ctx.fillStyle = 'rgba(0,40,80,0.8)';
    ctx.beginPath(); ctx.roundRect(prevX, inY, popW/2 - 15, 22, 3); ctx.fill();
    ctx.strokeStyle = '#0088ff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(prevX, inY, popW/2 - 15, 22, 3); ctx.stroke();
    ctx.fillStyle = '#44aaff'; ctx.font = "bold 8px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▶ PREVIEW', prevX + (popW/2 - 15)/2, inY + 11);

    this._notePopupClearBtn = { x: clearBtnX, y: inY, w: popW/2 - 15, h: 22 };
    ctx.fillStyle = 'rgba(80,0,0,0.8)';
    ctx.beginPath(); ctx.roundRect(clearBtnX, inY, popW/2 - 15, 22, 3); ctx.fill();
    ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(clearBtnX, inY, popW/2 - 15, 22, 3); ctx.stroke();
    ctx.fillStyle = '#ff8888'; ctx.font = "bold 8px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✕ CLEAR NOTE', clearBtnX + (popW/2 - 15)/2, inY + 11);

    // Volume slider
    inY += 28;
    var curVol = cfg.vol !== undefined ? cfg.vol : 0.6;
    var volLblW = 28, volX = popX + 10 + volLblW, volW = popW - 20 - volLblW;
    ctx.fillStyle = '#8899bb'; ctx.font = "bold 8px 'Share Tech Mono',monospace";
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('VOL', popX + 10, inY + 10);
    ctx.fillStyle = 'rgba(0,20,50,0.8)';
    ctx.beginPath(); ctx.roundRect(volX, inY + 5, volW, 8, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(180,80,255,0.4)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect(volX, inY + 5, volW, 8, 4); ctx.stroke();
    var volT   = Math.max(0, Math.min(1, (curVol - 0.05) / 1.15));
    var volThX = volX + volW * volT;
    ctx.fillStyle = 'rgba(180,80,255,0.8)';
    ctx.beginPath(); ctx.roundRect(volX, inY + 5, volW * volT, 8, 4); ctx.fill();
    ctx.beginPath(); ctx.arc(volThX, inY + 9, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#cc44ff'; ctx.shadowColor = '#cc44ff'; ctx.shadowBlur = 5;
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ddaaff'; ctx.font = "7px 'Share Tech Mono',monospace";
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(curVol * 100) + '%', volThX + 9, inY + 9);
    this._notePopupVolSlider = { x: volX, y: inY + 2, w: volW, h: 16, trackX: volX, trackW: volW };
  }

  _drawBall(obj) {
    // Cube ball: allow draw even if dead (for shard animation)
    if (obj.type === BALL_TYPES.CUBE) {
      if (!obj.exploded && (!obj.dead || obj._cubeShards)) this._drawCube(obj);
      return;
    }
    if (obj.dead || obj.exploded) return;
    if (obj._inTube) return;  // drawn by tube's own draw method, not here
    var ctx = this.ctx, bs = BallSettings[obj.type] || BallSettings.bouncer;
    var pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.06 + obj.r);

    // Wiggle offset for stuck sticky balls
    var wx = 0, wy = 0;
    if (obj._wiggleTimer > 0) {
      obj._wiggleTimer--;
      var wAmt = obj._wiggleAmt || 3;
      wx = Math.sin(obj._wiggleTimer * 1.8) * wAmt * (obj._wiggleTimer / 12);
      wy = Math.cos(obj._wiggleTimer * 2.2) * wAmt * 0.5 * (obj._wiggleTimer / 12);
    }

    // Visual indicator for stuck sticky
    if (obj.stuckTo === '_wall_') {
      ctx.beginPath();
      ctx.arc(obj.x + wx, obj.y + wy, obj.r + 5 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = bs.glow + '88'; ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    }

    // Outer aura for non-bouncers
    if (obj.type !== BALL_TYPES.BOUNCER && obj.type !== BALL_TYPES.EXPLODER) {
      ctx.beginPath(); ctx.arc(obj.x, obj.y, obj.r + 4 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = bs.glow + '66'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Exploder: draw concentric dark-red rings based on tier
    if (obj.type === BALL_TYPES.EXPLODER) {
      var tier = obj._explodeTier || 1;
      // Visual radius scales by tier: tier1 = smaller, tier2 = normal, tier3 = slightly bigger
      var tierScale = [0.82, 1.0, 1.12][tier - 1] || 1.0;
      var vr = obj.r * tierScale;  // visual radius for this tier
      // Rings are tight — all within ~1.3x the visual radius
      var ringDefs = [
        // tier1: 1 small tight ring
        [[1.0, 'rgba(180,30,0,0.60)', 2]],
        // tier2: 2 rings — close together
        [[1.0, 'rgba(150,25,0,0.55)', 1.8], [1.25, 'rgba(200,40,0,0.70)', 2.2]],
        // tier3: 3 rings — all still close in
        [[1.0, 'rgba(130,20,0,0.50)', 1.6], [1.2, 'rgba(180,30,0,0.65)', 2.0], [1.38, 'rgba(230,50,0,0.80)', 2.5]],
      ];
      var rings = ringDefs[tier - 1] || ringDefs[0];
      for (var ri = 0; ri < rings.length; ri++) {
        var rDef = rings[ri];
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, vr * rDef[0] + 1 + pulse * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = rDef[1];
        ctx.lineWidth   = rDef[2];
        ctx.shadowColor = '#ff3300'; ctx.shadowBlur = 3 + ri * 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // Countdown pips below ball
      if (!obj.isSplitChild) {
        var remaining = obj.bouncesLeft || 0;
        for (var pi = 0; pi < tier; pi++) {
          var pipColor = pi < remaining ? '#ff4400' : 'rgba(100,20,0,0.4)';
          ctx.beginPath();
          ctx.arc(obj.x - (tier - 1) * 4 + pi * 8, obj.y + obj.r + 5, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = pipColor;
          ctx.fill();
        }
      }
    }

    // Apply wiggle offset temporarily for draw
    var origX = obj.x, origY = obj.y;
    if (wx !== 0 || wy !== 0) { obj.x += wx; obj.y += wy; }
    // Pass display flags into draw context
    ctx._showAbbr = window._showBallAbbr !== false;
    obj.draw(ctx);
    ctx._showAbbr = true;  // reset
    if (wx !== 0 || wy !== 0) { obj.x = origX; obj.y = origY; }
    // Below-ball label (full name)
    if (window._showBallLabel !== false) {
      ctx.fillStyle = bs.glow + 'aa'; ctx.font = "8px 'Share Tech Mono',monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(bs.label, obj.x, obj.y + obj.r + (obj.type === BALL_TYPES.EXPLODER ? 10 : 3));
    }
    // ── Always-on velocity indicator above ball ───────────────────────────────
    if (window._showVelocityIndicator !== false) {
      // Suppress during active sling — the pre-launch readout in _drawSling takes over
      var _isSlung = this.sling && this.sling.obj === obj;
      if (!_isSlung) {
        var _spd = Math.hypot(obj.vx || 0, obj.vy || 0);
        var _spdStr = _spd.toFixed(1);
        ctx.save();
        ctx.font = "bold 13px 'Share Tech Mono',monospace";
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        var _velY = obj.y - obj.r - 4;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText(_spdStr, obj.x + 1, _velY + 1);
        ctx.fillStyle = '#00ff44';
        ctx.shadowColor = '#00cc33'; ctx.shadowBlur = 5;
        ctx.fillText(_spdStr, obj.x, _velY);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
  }

  _drawGravityRange(well) {
    var ctx = this.ctx, bs = BallSettings.gravity;
    var pulse = 0.4 + 0.3 * Math.sin(this.frame * 0.04);
    ctx.beginPath(); ctx.arc(well.x, well.y, bs.gravRange, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,255,238,' + pulse * 0.35 + ')'; ctx.lineWidth = 1;
    ctx.setLineDash([6,6]); ctx.stroke(); ctx.setLineDash([]);
  }

  _drawFloor(floorY) {
    var ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(0, floorY, W, H - floorY);
    ctx.save();

    // Sling zone line — dotted line above floor showing tap-to-sling reach
    var zoneH = this._slingZoneH !== undefined ? this._slingZoneH : 100;
    var zoneY = floorY - zoneH;
    ctx.setLineDash([5, 8]);
    ctx.strokeStyle = 'rgba(0,200,150,0.28)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(0, zoneY); ctx.lineTo(W, zoneY); ctx.stroke();
    ctx.setLineDash([]);
    // Tiny label on right edge
    ctx.fillStyle = 'rgba(0,200,150,0.35)'; ctx.font = "7px 'Share Tech Mono',monospace";
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('SLING ZONE', W - 4, zoneY - 1);

    // Floor line
    ctx.strokeStyle = 'rgba(0,180,255,0.55)'; ctx.lineWidth = 2;
    ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(W, floorY); ctx.stroke();
    ctx.shadowBlur = 0;

    // Dotted floor echo
    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = 'rgba(0,140,255,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, floorY + 4); ctx.lineTo(W, floorY + 4); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(0,140,200,0.22)'; ctx.font = "9px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var hint = this._aimMode === 'push' ? '↑  DRAG UP TO AIM  ↑' : '▼  PULL DOWN TO AIM  ▼';
    ctx.fillText(hint, W / 2, floorY + 8);
    ctx.restore();
  }

  _drawSling() {
    var ctx = this.ctx, s = this.sling, obj = s.obj;
    var isPush = this._aimMode === 'push';
    var dx, dy, dist, power;

    if (isPush) {
      dx   = s.pullX - s.startX;
      dy   = s.pullY - s.startY;
    } else {
      dx   = s.anchorX - s.pullX;
      dy   = s.anchorY - s.pullY;
    }
    dist  = Math.hypot(dx, dy);
    if (dist < SLING_MIN_OFFSET) return;
    power = Math.min(dist, SLING_MAX_PULL) / SLING_MAX_PULL;

    ctx.save();

    if (isPush) {
      // Push mode: draw an arrow from the ball in the launch direction
      var bs  = BallSettings[obj.type] || BallSettings.bouncer;
      var ndx = dx / dist, ndy = dy / dist;
      var arrowLen = 30 + power * 60;
      var tipX = obj.x + ndx * (obj.r + arrowLen);
      var tipY = obj.y + ndy * (obj.r + arrowLen);

      ctx.strokeStyle = 'rgba(255,200,60,' + (0.5 + power * 0.5) + ')';
      ctx.lineWidth   = 2.5; ctx.shadowColor = '#ffcc30'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(obj.x + ndx * obj.r, obj.y + ndy * obj.r);
      ctx.lineTo(tipX, tipY); ctx.stroke();
      // Arrowhead
      var ah = Math.atan2(ndy, ndx);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - Math.cos(ah - 0.45) * 12, tipY - Math.sin(ah - 0.45) * 12);
      ctx.lineTo(tipX - Math.cos(ah + 0.45) * 12, tipY - Math.sin(ah + 0.45) * 12);
      ctx.closePath(); ctx.fillStyle = 'rgba(255,200,60,0.85)'; ctx.fill();
      ctx.shadowBlur = 0;

      // Trajectory dots from ball in drag direction
      var vx2 = ndx * Math.min(dist, SLING_MAX_PULL) * SLING_POWER * (bs.velocity||1);
      var vy2 = ndy * Math.min(dist, SLING_MAX_PULL) * SLING_POWER * (bs.velocity||1);
      var px = obj.x, py = obj.y;
      var grav = Physics.PHYSICS.GRAVITY * Settings.gravityMult, fric = Physics.PHYSICS.FRICTION;
      for (var i = 0; i < 34; i++) {
        vy2 += grav; vx2 *= fric; vy2 *= fric; px += vx2; py += vy2;
        if (px < 0 || px > this.W || py < 0 || py > this.floorY()) break;
        ctx.beginPath(); ctx.arc(px, py, (1-i/34)*4*power+1, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,220,80,' + (1-i/34)*power*0.7 + ')'; ctx.fill();
      }
    } else {
      // Pull mode: classic rubber-band from finger to ball
      ctx.strokeStyle = 'rgba(255,200,60,' + (0.45 + power * 0.5) + ')';
      ctx.lineWidth = 2.5; ctx.shadowColor = '#ffcc30'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(obj.x - obj.r*0.5, obj.y); ctx.lineTo(s.pullX, s.pullY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(obj.x + obj.r*0.5, obj.y); ctx.lineTo(s.pullX, s.pullY); ctx.stroke();
      ctx.shadowBlur = 0;
      var bs2 = BallSettings[obj.type] || BallSettings.bouncer;
      var vx3 = (dx/dist)*Math.min(dist,SLING_MAX_PULL)*SLING_POWER*(bs2.velocity||1);
      var vy3 = (dy/dist)*Math.min(dist,SLING_MAX_PULL)*SLING_POWER*(bs2.velocity||1);
      var px3 = obj.x, py3 = obj.y;
      var grav3 = Physics.PHYSICS.GRAVITY * Settings.gravityMult, fric3 = Physics.PHYSICS.FRICTION;
      for (var i3 = 0; i3 < 34; i3++) {
        vy3 += grav3; vx3 *= fric3; vy3 *= fric3; px3 += vx3; py3 += vy3;
        if (px3 < 0 || px3 > this.W || py3 < 0 || py3 > this.floorY()) break;
        ctx.beginPath(); ctx.arc(px3, py3, (1-i3/34)*4.5*power+1, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,220,80,' + (1-i3/34)*power*0.75 + ')'; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(s.pullX, s.pullY, 10+power*7, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,200,60,'+(0.35+power*0.5)+')'; ctx.lineWidth=2; ctx.stroke();
    }
    ctx.restore();

    // ── Pre-launch velocity readout above ball (shown while pulling) ──────────
    // Only show if velocity indicator is on, or always show during sling
    var _bs3 = BallSettings[obj.type] || BallSettings.bouncer;
    var _launchSpd = Math.min(dist, SLING_MAX_PULL) * SLING_POWER * (_bs3.velocity || 1);
    ctx.save();
    ctx.font = "bold 13px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    var _velLabelY = obj.y - obj.r - 6;
    var _spdTxt = '→ ' + _launchSpd.toFixed(1);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(_spdTxt, obj.x + 1, _velLabelY + 1);
    // bright green with glow
    ctx.fillStyle = '#00ff44';
    ctx.shadowColor = '#00cc33'; ctx.shadowBlur = 8;
    ctx.fillText(_spdTxt, obj.x, _velLabelY);
    ctx.shadowBlur = 0;
    ctx.restore();

  }

  _drawHudClearButtons() {
    var ctx = this.ctx, W = this.W;
    // ── CLR BRICKS / CLR BALLS / CLR TUBES — top right ───────────────────────
    var btnW = 46, btnH = 20, gap = 3;
    var totalW = 4 * btnW + 3 * gap;
    var startX = W - totalW - 8;
    var btnY2 = 44;
    var labels2 = ['BRICKS','BALLS','TUBES','SPLATS'];
    var colors  = ['#ff6600','#ff4466','#00ffaa','#44bb11'];
    this._hudClearBtns = [];
    for (var ci = 0; ci < 3; ci++) {
      var bx2 = startX + ci * (btnW + gap);
      ctx.fillStyle = 'rgba(0,5,18,0.80)';
      ctx.beginPath(); ctx.roundRect(bx2, btnY2, btnW, btnH, 3); ctx.fill();
      ctx.strokeStyle = colors[ci] + 'aa'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(bx2, btnY2, btnW, btnH, 3); ctx.stroke();
      ctx.fillStyle = colors[ci]; ctx.font = "bold 6px 'Share Tech Mono',monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(labels2[ci], bx2 + btnW/2, btnY2 + btnH/2);
      this._hudClearBtns.push({ x:bx2, y:btnY2, w:btnW, h:btnH, type:ci });
    }
  }

  _drawSpeedSlider() {
    var ctx    = this.ctx;
    var W      = this.W;
    var H      = this.H;
    var leftReserve  = 3 * 32 + 36;   // extra 20px breathing room left of buttons
    var rightReserve = 2 * 32 + 36;   // extra padding on right side too
    var sliderW = W - leftReserve - rightReserve;
    var sliderH = 28;
    var sx     = leftReserve;
    var sy     = H - 36;

    // ── Brick speed slider (above ball speed slider) ──────────────────────────
    var bsy    = sy - 30;
    var btrackY = bsy + sliderH / 2;
    this._brickSliderRect = { x: sx, y: bsy, w: sliderW, h: sliderH, trackY: btrackY };
    ctx.save();
    ctx.fillStyle = 'rgba(0,10,28,0.65)';
    ctx.beginPath(); ctx.roundRect(sx - 8, bsy - 2, sliderW + 16, sliderH + 4, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,140,0,0.25)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, btrackY); ctx.lineTo(sx + sliderW, btrackY); ctx.stroke();
    var bThX = sx + this.brickSpeedMult * sliderW;
    ctx.strokeStyle = 'rgba(255,160,0,0.7)'; ctx.shadowColor = '#ff9900'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(sx, btrackY); ctx.lineTo(bThX, btrackY); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(bThX, btrackY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffaa22'; ctx.shadowColor = '#ffaa22'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#030a18'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,160,0,0.55)'; ctx.font = "bold 8px 'Share Tech Mono', monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('BRICKS ' + Math.round(this.brickSpeedMult * 100) + '%', sx + sliderW / 2, bsy - 1);
    ctx.restore();
    var trackY = sy + sliderH / 2;

    // Store rect for touch handling
    this._sliderRect = { x: sx, y: sy, w: sliderW, h: sliderH, trackY: trackY };

    // Background pill
    ctx.save();
    ctx.fillStyle = 'rgba(0,10,28,0.75)';
    ctx.beginPath(); ctx.roundRect(sx - 8, sy - 2, sliderW + 16, sliderH + 4, 10); ctx.fill();

    // Track
    ctx.strokeStyle = 'rgba(0,150,220,0.35)';
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.beginPath(); ctx.moveTo(sx, trackY); ctx.lineTo(sx + sliderW, trackY); ctx.stroke();

    // Filled portion (left of thumb)
    var thumbX = sx + this.speedMult * sliderW;
    ctx.strokeStyle = 'rgba(0,200,255,0.7)';
    ctx.lineWidth   = 3;
    ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(sx, trackY); ctx.lineTo(thumbX, trackY); ctx.stroke();
    ctx.shadowBlur  = 0;

    // Thumb
    ctx.beginPath(); ctx.arc(thumbX, trackY, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#00ccff'; ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 12;
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#030a18'; ctx.lineWidth = 1.5;
    ctx.stroke();

    // Labels — sit above pill, clear of thumb
    ctx.fillStyle    = 'rgba(0,180,255,0.6)';
    ctx.font         = "bold 8px 'Share Tech Mono', monospace";
    ctx.textAlign    = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('0%', sx, sy - 1);
    ctx.textAlign = 'right';
    ctx.fillText('100%', sx + sliderW, sy - 1);

    // Current speed label
    var pct = Math.round(this.speedMult * 100);
    ctx.fillStyle    = 'rgba(180,230,255,0.9)';
    ctx.font         = "bold 9px 'Share Tech Mono', monospace";
    ctx.textAlign    = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('SPEED ' + pct + '%', sx + sliderW / 2, sy - 1);

    ctx.restore();

    // ── Tube speed multiplier slider (above brick slider) ──────────────────────
    var tsy    = bsy - 28;
    var ttrackY = tsy + sliderH / 2;
    this._tubeSliderRect = { x: sx, y: tsy, w: sliderW, h: sliderH, trackY: ttrackY };
    var tubeMult = window._tubeSpeedMult !== undefined ? window._tubeSpeedMult : 1.0;
    // Range 0.1 to 2.0; default 1.0 maps to t=0.45 (roughly middle)
    var tubeT = Math.max(0, Math.min(1, (tubeMult - 0.1) / 1.9));
    var tThX  = sx + tubeT * sliderW;
    ctx.save();
    ctx.fillStyle = 'rgba(0,10,28,0.55)';
    ctx.beginPath(); ctx.roundRect(sx - 8, tsy - 2, sliderW + 16, sliderH + 4, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(0,180,255,0.20)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, ttrackY); ctx.lineTo(sx + sliderW, ttrackY); ctx.stroke();
    var tColor = tubeMult >= 1.0 ? '#00aaff' : '#ff6633';
    ctx.strokeStyle = tColor + 'aa'; ctx.shadowColor = tColor; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.moveTo(sx, ttrackY); ctx.lineTo(tThX, ttrackY); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(tThX, ttrackY, 7, 0, Math.PI * 2);
    ctx.fillStyle = tColor; ctx.shadowColor = tColor; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#030a18'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = tColor + 'cc'; ctx.font = "bold 8px 'Share Tech Mono', monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('TUBES ' + Math.round(tubeMult * 100) + '%', sx + sliderW / 2, tsy - 1);
    ctx.restore();

    // ── Sling zone height slider (above tube slider) ─────────────────────────
    var zsy    = tsy - 28;
    var ztrackY = zsy + sliderH / 2;
    this._zoneSliderRect = { x: sx, y: zsy, w: sliderW, h: sliderH, trackY: ztrackY };
    ctx.save();
    ctx.fillStyle = 'rgba(0,10,28,0.55)';
    ctx.beginPath(); ctx.roundRect(sx - 8, zsy - 2, sliderW + 16, sliderH + 4, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(0,200,150,0.20)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, ztrackY); ctx.lineTo(sx + sliderW, ztrackY); ctx.stroke();
    var zoneH3   = this._slingZoneH !== undefined ? this._slingZoneH : 100;
    var zThT     = Math.max(0, Math.min(1, (zoneH3 - 40) / 260));  // range 40–300
    var zThX     = sx + zThT * sliderW;
    ctx.strokeStyle = 'rgba(0,200,150,0.55)'; ctx.shadowColor = '#00cc99'; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.moveTo(sx, ztrackY); ctx.lineTo(zThX, ztrackY); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(zThX, ztrackY, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#00cc99'; ctx.shadowColor = '#00cc99'; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#030a18'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(0,200,150,0.50)'; ctx.font = "bold 7px 'Share Tech Mono', monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('ZONE ' + zoneH3 + 'px', sx + sliderW / 2, zsy - 1);
    ctx.restore();
  }

  _drawCornerButtons() {
    var ctx = this.ctx, W = this.W, H = this.H;
    var btnW = 28, btnH = 28, gap = 4, margin = 6;
    var btmY = H - margin - btnH;

    // Bottom-left — three rows of toggle buttons
    // Row A (top): brick note display buttons
    var brickBtns = [
      { key: '_showBrickNote',      label: '♪',   default: true },
      { key: '_showBrickOctave',    label: '8va', default: true },
      { key: '_showBrickTimbre',    label: 'TIM', default: true },
    ];
    // Row B (middle): new feature toggles
    var midBtns = [
      { key: '_showVelocityIndicator', label: 'VEL', default: true },
      { key: '_showDmgNumbers',        label: 'DMG', default: true },
    ];
    // Row C (bottom): ball display buttons
    var leftBtns = [
      { key: '_showVelocityArrows', label: '↗',   default: false },
      { key: '_showBallLabel',      label: 'Aa',  default: false },
      { key: '_showBallAbbr',       label: 'BNC', default: true  },
    ];
    var rowAY = btmY - (btnH + gap) * 2;
    var rowBY = btmY - (btnH + gap);
    this._cornerBrickBtns = [];
    this._cornerMidRects  = [];
    this._cornerLeftRects = [];

    // Helper to draw a toggle button
    var drawToggleBtn = function(lx, ly, label, on, color) {
      ctx.fillStyle = on ? 'rgba(0,30,60,0.75)' : 'rgba(30,0,0,0.75)';
      ctx.beginPath(); ctx.roundRect(lx, ly, btnW, btnH, 5); ctx.fill();
      ctx.strokeStyle = on ? (color || 'rgba(0,160,255,0.55)') : 'rgba(180,50,50,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(lx, ly, btnW, btnH, 5); ctx.stroke();
      ctx.fillStyle = on ? (color ? color : '#aaddff') : '#aa6666';
      ctx.font = "bold 7px 'Share Tech Mono',monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + btnW/2, ly + btnH/2);
      if (!on) {
        ctx.strokeStyle = 'rgba(200,80,80,0.7)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(lx+4, ly+4); ctx.lineTo(lx+btnW-4, ly+btnH-4); ctx.stroke();
      }
    };

    for (var bi3 = 0; bi3 < brickBtns.length; bi3++) {
      var bb = brickBtns[bi3];
      if (window[bb.key] === undefined) window[bb.key] = bb.default;
      var lx = margin + bi3 * (btnW + gap);
      drawToggleBtn(lx, rowAY, bb.label, window[bb.key], 'rgba(180,80,255,0.7)');
      this._cornerBrickBtns.push({ x: lx, y: rowAY, w: btnW, h: btnH, key: bb.key });
    }

    for (var mi = 0; mi < midBtns.length; mi++) {
      var mb = midBtns[mi];
      if (window[mb.key] === undefined) window[mb.key] = mb.default;
      var mx = margin + mi * (btnW + gap);
      drawToggleBtn(mx, rowBY, mb.label, window[mb.key], 'rgba(0,220,120,0.7)');
      this._cornerMidRects.push({ x: mx, y: rowBY, w: btnW, h: btnH, key: mb.key });
    }

    for (var li = 0; li < leftBtns.length; li++) {
      var lb = leftBtns[li];
      if (window[lb.key] === undefined) window[lb.key] = lb.default;
      var lx2 = margin + li * (btnW + gap);
      drawToggleBtn(lx2, btmY, lb.label, window[lb.key], null);
      this._cornerLeftRects.push({ x: lx2, y: btmY, w: btnW, h: btnH, key: lb.key });
    }

    // Bottom-right: PULL/PUSH toggle + brick editor button
    var ex = W - margin - btnW;
    this._cornerEditorBtn = { x: ex, y: btmY, w: btnW, h: btnH };
    var edOn = this._editorMode;
    ctx.fillStyle = edOn ? 'rgba(0,60,30,0.85)' : 'rgba(0,20,40,0.75)';
    ctx.beginPath(); ctx.roundRect(ex, btmY, btnW, btnH, 5); ctx.fill();
    ctx.strokeStyle = edOn ? '#00ff88' : 'rgba(255,140,0,0.55)'; ctx.lineWidth = edOn ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(ex, btmY, btnW, btnH, 5); ctx.stroke();
    ctx.fillStyle = edOn ? '#00ff88' : '#ffaa44';
    ctx.font = "bold 10px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🧱', ex + btnW/2, btmY + btnH/2);

    // PULL/PUSH aim toggle
    var aimX = ex - btnW - gap;
    this._cornerAimBtn = { x: aimX, y: btmY, w: btnW, h: btnH };
    var isPushCorner = this._aimMode === 'push';
    ctx.fillStyle = isPushCorner ? 'rgba(60,45,0,0.85)' : 'rgba(0,20,45,0.75)';
    ctx.beginPath(); ctx.roundRect(aimX, btmY, btnW, btnH, 5); ctx.fill();
    ctx.strokeStyle = isPushCorner ? '#ffcc30' : '#00ccff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(aimX, btmY, btnW, btnH, 5); ctx.stroke();
    ctx.fillStyle = isPushCorner ? '#ffcc30' : '#00ccff';
    ctx.font = "bold 7px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(isPushCorner ? '↑PSH' : '←PUL', aimX + btnW/2, btmY + btnH/2);
  }

  _drawEditorGrid(floorY) {
    var ctx = this.ctx, W = this.W;
    var gs  = window._gridSize || 20;
    ctx.save();
    ctx.lineWidth = 0.5;
    for (var gx = 0; gx <= W; gx += gs) {
      var major = (Math.round(gx / gs) % 5 === 0);
      ctx.strokeStyle = major ? 'rgba(0,200,255,0.18)' : 'rgba(0,160,200,0.07)';
      ctx.lineWidth   = major ? 0.8 : 0.4;
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, floorY); ctx.stroke();
    }
    for (var gy = 0; gy <= floorY; gy += gs) {
      var majorY = (Math.round(gy / gs) % 5 === 0);
      ctx.strokeStyle = majorY ? 'rgba(0,200,255,0.18)' : 'rgba(0,160,200,0.07)';
      ctx.lineWidth   = majorY ? 0.8 : 0.4;
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    ctx.restore();
  }

  _drawGrid() {
    var ctx = this.ctx, W = this.W, H = this.H;
    ctx.strokeStyle = '#030a1804'; ctx.lineWidth = 1;
    for (var x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (var y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  }

  _drawStars() {
    var ctx = this.ctx;
    for (var i = 0; i < this.stars.length; i++) {
      var s = this.stars[i]; s.phase += s.speed;
      var a = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(s.phase));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(175,195,255,' + a + ')'; ctx.fill();
    }
  }

  _drawSparks() {
    var ctx = this.ctx, sparks = this.sparks;
    for (var i = 0; i < sparks.length; i++) {
      var s = sparks[i];
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
      ctx.fillStyle = s.color + Math.floor(s.life*220).toString(16).padStart(2,'0');
      ctx.shadowColor = s.color; ctx.shadowBlur = 5; ctx.fill(); ctx.shadowBlur = 0;
    }

    // ── Floating damage numbers ───────────────────────────────────────────────
    if (!this._dmgNumbers) return;
    if (window._showDmgNumbers === false) { this._dmgNumbers.length = 0; return; }
    var SOLID_FRAMES = 18;   // ~0.3s constant velocity + full opacity
    var DECAY_FRAMES = 37;   // then exponential decay over ~0.6s
    for (var di = this._dmgNumbers.length - 1; di >= 0; di--) {
      var dn = this._dmgNumbers[di];
      dn.age++;
      if (dn.age > SOLID_FRAMES) {
        var t = (dn.age - SOLID_FRAMES) / DECAY_FRAMES;
        var decay = Math.pow(1 - t, 2);  // quadratic ease-out
        dn.vx *= 0.88; dn.vy *= 0.88;
        dn.x += dn.vx; dn.y += dn.vy;
        var alpha = Math.max(0, decay);
        if (alpha <= 0 || dn.age > SOLID_FRAMES + DECAY_FRAMES) {
          this._dmgNumbers.splice(di, 1); continue;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
      } else {
        dn.x += dn.vx; dn.y += dn.vy;
        ctx.save();
        ctx.globalAlpha = 1.0;
      }
      ctx.font = "bold 13px 'Share Tech Mono',monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(dn.val, dn.x + 1, dn.y + 1);
      // Yellow number with subtle glow
      ctx.fillStyle = '#ffdd22';
      ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 6;
      ctx.fillText(dn.val, dn.x, dn.y);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  _buildNebulaOffscreen() {
    var blobs = [{rx:0.15,ry:0.10,r:180,c:'#0a1a4a'},{rx:0.85,ry:0.22,r:150,c:'#1a0a30'},{rx:0.50,ry:0.55,r:200,c:'#080a20'}];
    var oc = document.createElement('canvas'); oc.width = this.W; oc.height = this.H;
    var nc = oc.getContext('2d');
    blobs.forEach(function(b) {
      var bx = b.rx * oc.width, by = b.ry * oc.height;
      var g = nc.createRadialGradient(bx,by,0,bx,by,b.r);
      g.addColorStop(0,b.c); g.addColorStop(1,'transparent');
      nc.fillStyle = g; nc.beginPath(); nc.arc(bx,by,b.r,0,Math.PI*2); nc.fill();
    });
    return oc;
  }

  _buildStars(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push({x:Math.random()*this.W,y:Math.random()*this.H,r:Math.random()*1.3,phase:Math.random()*Math.PI*2,speed:0.008+Math.random()*0.018});
    return out;
  }

  // ── Phase 2 public methods (called by EventManager) ───────────────────────

  checkWinCondition() {
    if (!this.won && this.objectives.every(function(o) { return o.met; })) {
      this._triggerWin();
    }
  }

  respawnAllBalls() {
    this._spawnLevel();
  }
}

window.Game     = Game;
window.Settings = Settings;
