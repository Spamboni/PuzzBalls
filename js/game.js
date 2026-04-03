window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_FILE_VERSION['game.js'] = 1303;
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
    this.H = window.innerHeight;
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
      this.H = window.innerHeight;
      this.canvas.width  = this.W;
      this.canvas.height = this.H;
      this.nebulaOffscreen = this._buildNebulaOffscreen();
      if (this.levelData) this._spawnLevel();
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  loadLevel(levelData) {
    this.levelData = levelData;
    this.nebulaOffscreen = this._buildNebulaOffscreen();
    this._spawnLevel();
    this._bindInput();
    if (!this._rafId) this._rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  // ── Level setup ────────────────────────────────────────────────────────────

  _spawnLevel() {
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

    if (ld.objects) {
      ld.objects.forEach(function(objDef) {
        var x = (objDef.rx !== undefined ? objDef.rx * W : objDef.x || W * 0.5);
        var y = (objDef.ry !== undefined ? objDef.ry * self.floorY() : objDef.y || self.floorY() * 0.5);
        var obj = null;
        switch (objDef.type) {
          case 'button':
            obj = new Button(x, y, objDef.r || 18, objDef.id);
            self.buttons.push(obj);
            break;
          case 'breakable_brick':
            obj = new BreakableBrick(x, y, objDef.w || 40, objDef.h || 22, objDef.health || 100, objDef.id, objDef.regenAfter || null);
            self.bricks.push(obj);
            break;
          case 'vertical_brick':
            obj = new VerticalBrick(x, y, objDef.w || 22, objDef.h || 60, objDef.health || 100, objDef.id, objDef.regenAfter || null);
            self.bricks.push(obj);
            break;
          case 'circular_brick':
            obj = new CircularBrick(x, y, objDef.r || 22, objDef.health || 100, objDef.id, objDef.regenAfter || null);
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
    this.won        = false;
    this.winTimer   = 0;
    this.collisions = 0;
    this.score      = 0;
    this.sling      = null;

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
      var rect = canvas.getBoundingClientRect();
      var src  = e.touches ? e.touches[0] : e;
      return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    }

    function isUI(t) {
      if (!t) return false;
      if (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'SELECT') return true;
      if (t.closest && (t.closest('#hud-overlay') || t.closest('#settings-panel') || t.closest('#objectives-panel'))) return true;
      return false;
    }

    function onDown(e) {
      if (isUI(e.target)) return;
      e.preventDefault();
      if (window.Sound) Sound.getCtx();

      var pos = getPos(e);

      // ── Editor mode ──────────────────────────────────────────────────────────
      if (self._editorMode) {
        // Check editor panel buttons first
        if (self._editorTypeBtns) {
          for (var ti = 0; ti < self._editorTypeBtns.length; ti++) {
            var tb = self._editorTypeBtns[ti];
            if (pos.x >= tb.x && pos.x <= tb.x + tb.w && pos.y >= tb.y && pos.y <= tb.y + tb.h) {
              self._editorBrickType = tb.type; return;
            }
          }
        }
        if (self._editorDelBtn) {
          var db = self._editorDelBtn;
          if (pos.x >= db.x && pos.x <= db.x + db.w && pos.y >= db.y && pos.y <= db.y + db.h) {
            self._editorDeleteSelected(); return;
          }
        }
        if (self._editorDoneBtn) {
          var dnb = self._editorDoneBtn;
          if (pos.x >= dnb.x && pos.x <= dnb.x + dnb.w && pos.y >= dnb.y && pos.y <= dnb.y + dnb.h) {
            self.toggleEditor(); return;
          }
        }
        self._editorOnDown(pos);
        return;
      }

      // ── Speed slider ─────────────────────────────────────────────────────
      if (self._sliderRect) {
        var sr = self._sliderRect;
        if (pos.y >= sr.y - 10 && pos.y <= sr.y + sr.h + 10 &&
            pos.x >= sr.x - 15  && pos.x <= sr.x + sr.w + 15) {
          self._draggingSlider = true;
          var t = Math.max(0, Math.min(1, (pos.x - sr.x) / sr.w));
          // Map 0→1 to 0.125→1.0
          self.speedMult = 0.125 + t * 0.875;
          return;
        }
      }
      if (self._chuteButtonRects) {
        for (var bi = 0; bi < self._chuteButtonRects.length; bi++) {
          var br = self._chuteButtonRects[bi];
          if (pos.x >= br.x && pos.x <= br.x + br.w &&
              pos.y >= br.y && pos.y <= br.y + br.h) {
            self._chuteDropBall(br.type);
            return;
          }
        }
      }
      if (self._chuteDeleteRect) {
        var dr = self._chuteDeleteRect;
        if (pos.x >= dr.x && pos.x <= dr.x + dr.w &&
            pos.y >= dr.y && pos.y <= dr.y + dr.h) {
          self._toggleDeleteMode();
          return;
        }
      }
      // ── Aim mode toggle ──────────────────────────────────────────────────
      if (self._chuteAimRect) {
        var ar = self._chuteAimRect;
        if (pos.x >= ar.x && pos.x <= ar.x + ar.w &&
            pos.y >= ar.y && pos.y <= ar.y + ar.h) {
          self._aimMode = self._aimMode === 'pull' ? 'push' : 'pull';
          return;
        }
      }

      // ── Delete mode: tap a ball to remove it ─────────────────────────────
      if (self._deleteMode) {
        if (self._tryDeleteBall(pos.x, pos.y)) return;
      }

      // ── Tap stuck sticky ball — bounce off with dead zone randomization ──────
      for (var si = 0; si < self.objects.length; si++) {
        var sobj = self.objects[si];
        if (sobj.type === BALL_TYPES.STICKY && sobj.stuckTo === '_wall_') {
          if (Math.hypot(pos.x - sobj.x, pos.y - sobj.y) < sobj.r + 14) {
            var bs_s       = BallSettings.sticky;
            var maxY       = bs_s.bounceHeightY   || 80;
            var maxX       = bs_s.bounceDistanceX || 60;
            var deadZone   = (bs_s.deadZonePercent || 30) / 100;
            var deadRadius = maxX * deadZone;          // half the blocked center range
            // Pick X with dead zone: random in [-maxX,-deadRadius] or [deadRadius,maxX]
            var side   = Math.random() > 0.5 ? 1 : -1;
            var rawX   = deadRadius + Math.random() * (maxX - deadRadius);
            var launchX = rawX * side;
            // Convert pixel targets to per-frame velocities (approximate 30 frames to peak)
            sobj.vx       = launchX / 22;
            sobj.vy       = -maxY / 18;
            sobj.stuckTo  = null;
            sobj.inFlight = true;
            // Nudge away from walls
            if (sobj.x - sobj.r <= sobj.r + 4) { sobj.x += sobj.r + 6; sobj.vx = Math.abs(sobj.vx); }
            else if (sobj.x + sobj.r >= self.W - sobj.r - 4) { sobj.x -= sobj.r + 6; sobj.vx = -Math.abs(sobj.vx); }
            if (window.Sound) Sound.thud(3);
            return;
          }
        }
      }

      // ── Ball selection: floor-resting sticky can be re-slung ─────────────
      var best = null, bestDist = 9999;
      for (var i = 0; i < self.objects.length; i++) {
        var obj = self.objects[i];
        if (obj.dead || obj.exploded) continue;
        // Skip wall-stuck sticky (handled above) and ball-stuck
        if (obj.stuckTo && obj.stuckTo !== '_wall_') continue;
        if (obj.stuckTo === '_wall_') continue;
        // Sticky on floor: allow re-sling
        if (obj.inFlight) continue;
        var dx = pos.x - obj.x, dy = pos.y - obj.y;
        if (self._aimMode === 'push') {
          // Push mode: tap anywhere near a ball (wider pick radius, no direction constraint)
          if (Math.hypot(dx, dy) < obj.r * 3.5) {
            var d = Math.hypot(dx, dy);
            if (d < bestDist) { bestDist = d; best = obj; }
          }
        } else {
          // Pull mode: classic — touch above or beside ball
          if (Math.abs(dx) < obj.r * 2.8 && dy >= -obj.r) {
            var d = Math.hypot(dx, dy);
            if (d < bestDist) { bestDist = d; best = obj; }
          }
        }
      }
      if (best) {
        best.vx = 0; best.vy = 0; best.pinned = true;
        self.sling = { obj: best, anchorX: best.x, anchorY: best.y,
                       startX: pos.x, startY: pos.y, pullX: pos.x, pullY: pos.y };
      }
    }

    function onMove(e) {
      e.preventDefault();
      var pos = getPos(e);
      if (self._editorMode) { self._editorOnMove(pos); return; }
      if (self._draggingSlider && self._sliderRect) {
        var sr = self._sliderRect;
        var t  = Math.max(0, Math.min(1, (pos.x - sr.x) / sr.w));
        self.speedMult = 0.125 + t * 0.875;
        return;
      }
      if (!self.sling) return;
      var pos = getPos(e);
      self.sling.pullX = pos.x; self.sling.pullY = pos.y;
      var dx = self.sling.anchorX - pos.x, dy = self.sling.anchorY - pos.y;
      var dist = Math.hypot(dx, dy);
      if (dist > SLING_MIN_OFFSET && window.Sound) Sound.stretch(Math.min(dist, SLING_MAX_PULL) / SLING_MAX_PULL);
    }

    function onUp(e) {
      e.preventDefault();
      self._draggingSlider = false;
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

    window._gameSparks = this.sparks;

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
    for (i = 0; i < this.bricks.length;     i++) this.bricks[i].updateRegen(dt);

    // Chute feed
    this._updateChute(dt);

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
        // Run multiple sub-steps at reduced scale for slow-mo accuracy
        var steps = sm < 0.3 ? 1 : 1;
        Physics.stepObject(obj, this.W, floorY, this.sparks, { gravityMult: Settings.gravityMult * sm, bounceMult: bs.bounciness, speedMult: sm });
        // Sticky: only try to stick if ball is actually touching a wall or floor
        if (obj.type === BALL_TYPES.STICKY && !obj._fromChute && !obj.stuckTo) {
          var touchingFloor  = obj.y + obj.r >= floorY - 1;
          var touchingWall   = obj.x - obj.r <= 1 || obj.x + obj.r >= this.W - 1;
          var touchingTop    = obj.y - obj.r <= 1;
          var touchingChute  = obj.y >= g2.TOP_Y && obj.x + obj.r >= g2.LEFT_X - 1;
          if ((touchingWall || touchingTop || touchingChute) && !touchingFloor) {
            this._checkStickyWall(obj);
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

    // Enforce chute left wall as physics boundary
    this._enforceChuteWall();

    this.target.update();
    Physics.stepSparks(this.sparks);

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
          // Sticky knock — check if a fast ball hits a wall-stuck sticky
          if (a.type === BALL_TYPES.STICKY && a.stuckTo === '_wall_') {
            this._tryKnockSticky(a, Math.hypot(b.vx, b.vy));
          }
          if (b.type === BALL_TYPES.STICKY && b.stuckTo === '_wall_') {
            this._tryKnockSticky(b, Math.hypot(a.vx, a.vy));
          }
          // Exploder countdown — only after manually slung
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

    // Phase 2: Collisions with interactive objects
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

        // Per-ball-per-brick contact cooldown — prevents going through on overlap
        var coolKey = '_brickCool_' + brick.id;
        if (ball[coolKey] > 0) { ball[coolKey]--; continue; }

        if (!brick.overlaps(ball)) continue;

        // Set cooldown so this ball won't re-trigger same brick for 20 frames
        ball[coolKey] = 20;

        // Push ball out of brick (handles both rect and circular bricks)
        var bEdgeX, bEdgeY, bndx, bndy, bndist, bnx, bny;
        if (brick instanceof CircularBrick) {
          // Circle: push directly away from center
          bndx   = ball.x - brick.x;
          bndy   = ball.y - brick.y;
          bndist = Math.hypot(bndx, bndy) || 1;
          bnx = bndx / bndist; bny = bndy / bndist;
          var overlap2 = (brick.r + ball.r * 0.9) - bndist;
          if (overlap2 > 0) { ball.x += bnx * (overlap2 + 1); ball.y += bny * (overlap2 + 1); }
        } else {
          bEdgeX = Math.max(brick.x - brick.w/2, Math.min(ball.x, brick.x + brick.w/2));
          bEdgeY = Math.max(brick.y - brick.h/2, Math.min(ball.y, brick.y + brick.h/2));
          bndx   = ball.x - bEdgeX; bndy = ball.y - bEdgeY;
          bndist = Math.hypot(bndx, bndy) || 1;
          bnx = bndx / bndist; bny = bndy / bndist;
          var overlap3 = (ball.r * 0.9) - bndist;
          if (overlap3 > 0) { ball.x += bnx * (overlap3 + 1); ball.y += bny * (overlap3 + 1); }
        }
        // Reflect velocity
        var dot = ball.vx * bnx + ball.vy * bny;
        if (dot < 0) {
          ball.vx -= 2 * dot * bnx;
          ball.vy -= 2 * dot * bny;
          // Apply some energy loss on brick bounce
          ball.vx *= 0.82;
          ball.vy *= 0.82;
        }

        // Damage = baseDamage × density × velocity factor
        var bsBall    = BallSettings[ball.type] || BallSettings.bouncer;
        var speed     = Math.hypot(ball.vx, ball.vy);
        var velFactor = Math.max(0.5, Math.min(speed / 8, 3.0));
        var dmg       = Math.round((bsBall.baseDamage || 20) * (bsBall.density || 1.0) * velFactor);
        var destroyed = brick.takeDamage(dmg);

        if (window.spawnBrickShards) spawnBrickShards(this.sparks, brick, ball);
        if (window.Sound) Sound.brickShatter(dmg * 0.01);

        if (ball.type === BALL_TYPES.STICKY) this._checkStickyWall(ball);

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
          EventManager.dispatch(brick.id + '_triggered');
          // §1.1: Detach any sticky balls near this brick
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
          }
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
          if (Math.hypot(dx, dy) < this.target.r + ball.r) {
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
    var threshold = (window.BallSettings && BallSettings.sticky.stickThreshold) || 6;
    var speed = Math.hypot(obj.vx, obj.vy);
    if (speed < threshold) {
      var touchingFloor = obj.y + obj.r >= this.floorY() - 2;
      // Never stick to floor — only walls/ceiling/bricks
      if (touchingFloor) return;
      obj.vx = 0; obj.vy = 0;
      obj.inFlight = false;
      obj.stuckTo  = '_wall_';
      obj._stickOffX = 0; obj._stickOffY = 0;
      if (window.Sound) Sound.thud(4);
    }
  }

  // Try to unstick a sticky ball that was hit by another ball
  _tryKnockSticky(sticky, impactSpeed) {
    if (sticky.type !== BALL_TYPES.STICKY || sticky.stuckTo !== '_wall_') return;
    var threshold = (window.BallSettings && BallSettings.sticky.stickThreshold) || 6;
    if (impactSpeed > threshold * 1.5) {
      // Hard enough — knock it free
      sticky.stuckTo  = null;
      sticky.inFlight = true;
      sticky.vy = -impactSpeed * 0.4;
      sticky.vx = (Math.random() - 0.5) * impactSpeed * 0.3;
      if (window.Sound) Sound.thud(impactSpeed);
    } else {
      // Too soft — wiggle in place
      sticky._wiggleTimer = 12;
      sticky._wiggleAmt   = 3;
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

  _chuteGeom() {
    var W        = this.W;
    var floorY   = this.floorY();
    var CHUTE_W  = 46;
    var TURN_R   = 30;
    var LEFT_X   = W - CHUTE_W;
    var CENTER_X = W - CHUTE_W / 2;
    var TOP_Y    = 160;   // where buttons start (below HUD)
    // The left wall goes straight down from TOP_Y to DIAG_Y,
    // then angles 45° right up to screen top-right corner.
    var DIAG_Y   = TOP_Y;  // diagonal starts right at the top of the button area
    return { W, floorY, CHUTE_W, TURN_R, LEFT_X, CENTER_X, TOP_Y, DIAG_Y };
  }

  // Called from physics loop — enforce left wall as hard boundary
  _enforceChuteWall() {
    var g = this._chuteGeom();
    for (var i = 0; i < this.objects.length; i++) {
      var obj = this.objects[i];
      if (obj.dead || obj._inChute) continue;
      // Only enforce below the diagonal start — above that, full screen width is open
      if (obj.y < g.TOP_Y) continue;
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
          // Exit velocity: 25%–80% of screen width
          var minV = (leftX * 0.25) / 28;
          var maxV = (leftX * 0.80) / 20;
          b.vx = -(minV + Math.random() * (maxV - minV));
          b.vy = -(0.5 + Math.random() * 1.0);
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
    for (var i = this.objects.length - 1; i >= 0; i--) {
      var obj = this.objects[i];
      if (obj.dead) continue;
      if (Math.hypot(px - obj.x, py - obj.y) < obj.r + 10) {
        this.objects.splice(i, 1);
        this.ui.attachObjects(this.objects);
        Physics.spawnSparks(this.sparks, obj.x, obj.y, '#ff4444', 18);
        if (window.Sound) Sound.thud(10);
        this._deleteMode = false;
        return true;
      }
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

    // ── LEFT WALL — diagonal → straight down → J curve ───────────────────────
    var diagEndX = W;
    var diagEndY = topY - (W - leftX);
    if (diagEndY < 0) diagEndY = 0;

    ctx.strokeStyle = 'rgba(0,200,255,0.85)';
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur  = 10;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    ctx.beginPath();
    ctx.moveTo(diagEndX, diagEndY);
    ctx.lineTo(leftX, topY);
    ctx.lineTo(leftX, floorY - turnR);
    ctx.quadraticCurveTo(leftX, floorY, leftX - turnR, floorY);
    ctx.stroke();

    // Inner tube rim line (gives the pipe a second wall thickness)
    ctx.strokeStyle = 'rgba(0,140,200,0.35)';
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 3;
    var innerOff = 4;
    ctx.beginPath();
    ctx.moveTo(diagEndX - innerOff, diagEndY + innerOff);
    ctx.lineTo(leftX + innerOff, topY + innerOff);
    ctx.lineTo(leftX + innerOff, floorY - turnR - innerOff);
    ctx.quadraticCurveTo(leftX + innerOff, floorY - innerOff, leftX - turnR + innerOff, floorY - innerOff);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── RIGHT WALL ────────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0,140,210,0.30)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(W, topY);
    ctx.lineTo(W, floorY);
    ctx.stroke();

    // ── FUTURISTIC BALL GENERATOR CAP at top ──────────────────────────────────
    var capH   = 32;
    var capY   = topY - capH;
    var capX   = leftX;
    var capW   = CW;

    // Cap body
    ctx.fillStyle = 'rgba(0,25,55,0.85)';
    ctx.beginPath();
    ctx.roundRect(capX, capY, capW, capH, [6, 6, 0, 0]);
    ctx.fill();

    // Cap neon border
    ctx.strokeStyle = 'rgba(0,200,255,0.80)';
    ctx.lineWidth   = 1.8;
    ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(capX, capY, capW, capH, [6, 6, 0, 0]);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Cap inner glow
    var gCap = ctx.createLinearGradient(capX, capY, capX, capY + capH);
    gCap.addColorStop(0, 'rgba(0,200,255,0.25)');
    gCap.addColorStop(1, 'rgba(0,100,180,0.05)');
    ctx.fillStyle = gCap;
    ctx.beginPath(); ctx.roundRect(capX + 2, capY + 2, capW - 4, capH - 4, [4, 4, 0, 0]); ctx.fill();

    // Cap ▼ indicator
    ctx.fillStyle = 'rgba(0,220,255,0.8)';
    ctx.font      = "bold 10px 'Share Tech Mono', monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▼ LOAD', capX + capW / 2, capY + capH / 2);

    // Horizontal scan line on cap
    ctx.strokeStyle = 'rgba(0,200,255,0.25)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(capX + 4, capY + capH * 0.55);
    ctx.lineTo(capX + capW - 4, capY + capH * 0.55);
    ctx.stroke();

    // ── SMALL BUMP removed per request ───────────────────────────────────────

    // ── LEFT RAMP — quarter-circle at left wall, slightly raised above floor ──
    // Center at (rampR, floorY - 10) so bottom just grazes floor, ball fits under
    var rampR  = 52;
    var rampCY = floorY - 10;   // just a little above floor, not too high
    ctx.strokeStyle = 'rgba(0,190,255,0.60)';
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(rampR, rampCY, rampR, Math.PI, Math.PI / 2, true);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Buttons inside the shaft ──────────────────────────────────────────────
    var btnTypes  = ['bouncer','exploder','sticky','splitter','gravity'];
    var btnColors = ['#4488ff','#ff4400','#44ff44','#ff44ff','#00ffee'];
    var btnH   = 30;
    var btnW   = CW - 6;
    var btnX   = leftX + 3;
    var curveTop  = floorY - turnR;
    var btnBlockH = 5 * (btnH + 4) + btnH + 8;
    var btnStartY = curveTop - btnBlockH - 10;
    if (btnStartY < topY + 4) btnStartY = topY + 4;

    this._chuteButtonRects = [];
    var onField = this.objects.filter(function(o) { return !o.dead; }).length
                + (this._chuteActive ? this._chuteActive.length : 0)
                + (this._chuteQueue  ? this._chuteQueue.length  : 0);
    var atMax = onField >= 15;

    // ── Aim mode toggle button — sits just above the ball buttons ─────────────
    var aimBtnH = 26;
    var aimBtnY = btnStartY - aimBtnH - 6;
    this._chuteAimRect = { x: btnX, y: aimBtnY, w: btnW, h: aimBtnH };
    var isPush    = this._aimMode === 'push';
    var aimColor  = isPush ? '#ffcc30' : '#00ccff';
    ctx.fillStyle = isPush ? 'rgba(60,45,0,0.80)' : 'rgba(0,20,45,0.80)';
    ctx.beginPath(); ctx.roundRect(btnX, aimBtnY, btnW, aimBtnH, 6); ctx.fill();
    ctx.strokeStyle = aimColor;
    ctx.lineWidth   = 1.8; ctx.shadowColor = aimColor; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.roundRect(btnX, aimBtnY, btnW, aimBtnH, 6); ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = aimColor;
    ctx.font        = "bold 8px 'Share Tech Mono', monospace";
    ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(isPush ? '↑ PUSH' : '← PULL', btnX + btnW / 2, aimBtnY + aimBtnH / 2);

    for (var bi = 0; bi < btnTypes.length; bi++) {
      var by    = btnStartY + bi * (btnH + 4);
      var btype = btnTypes[bi];
      var bcol  = btnColors[bi];
      var alpha = atMax ? 0.3 : 0.9;

      this._chuteButtonRects.push({ x: btnX, y: by, w: btnW, h: btnH, type: btype });

      // Pill background
      ctx.fillStyle = 'rgba(0,10,28,0.80)';
      ctx.beginPath(); ctx.roundRect(btnX, by, btnW, btnH, 7); ctx.fill();

      // Glowing border
      var hexAlpha = Math.round(alpha * 255).toString(16).padStart(2,'0');
      ctx.strokeStyle = bcol + hexAlpha;
      ctx.lineWidth   = 1.8;
      ctx.shadowColor = bcol;
      ctx.shadowBlur  = atMax ? 2 : 10;
      ctx.beginPath(); ctx.roundRect(btnX, by, btnW, btnH, 7); ctx.stroke();
      ctx.shadowBlur  = 0;

      // Dot
      var dotR = 7, dotX = btnX + dotR + 3, dotY = by + btnH / 2;
      ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = bcol + hexAlpha; ctx.fill();

      // Label (abbreviated)
      var labels = {bouncer:'BNC',exploder:'EXP',sticky:'STK',splitter:'SPL',gravity:'GRV'};
      ctx.fillStyle    = 'rgba(210,235,255,' + alpha + ')';
      ctx.font         = "bold 9px 'Share Tech Mono', monospace";
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[btype] || btype.slice(0,3).toUpperCase(), dotX + dotR + 4, dotY);
    }

    // Delete button
    var delY      = btnStartY + 5 * (btnH + 4) + 4;
    var delActive = this._deleteMode;
    this._chuteDeleteRect = { x: btnX, y: delY, w: btnW, h: btnH };
    ctx.fillStyle = delActive ? 'rgba(200,20,20,0.40)' : 'rgba(0,10,28,0.80)';
    ctx.beginPath(); ctx.roundRect(btnX, delY, btnW, btnH, 7); ctx.fill();
    ctx.strokeStyle = delActive ? '#ff3333' : 'rgba(255,60,60,0.55)';
    ctx.lineWidth = 1.8; ctx.shadowColor = '#ff2222';
    ctx.shadowBlur = delActive ? 12 : 3;
    ctx.beginPath(); ctx.roundRect(btnX, delY, btnW, btnH, 7); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle    = delActive ? '#ff8888' : 'rgba(255,100,100,0.8)';
    ctx.font         = "bold 9px 'Share Tech Mono', monospace";
    ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(delActive ? '✕ TAP BALL' : '✕ DEL', btnX + btnW / 2, delY + btnH / 2);

    // ── Balls in chute ───────────────────────────────────────────────────────
    if (this._chuteActive) {
      for (var ci = 0; ci < this._chuteActive.length; ci++) {
        this._drawBall(this._chuteActive[ci]);
      }
    }

    ctx.restore();
  }

  _triggerWin() {
    this.won = true; this.winTimer = 180;
    var bonus = Math.max(0, 10 - this.collisions) * 50;
    this.score += 200 + bonus;
    this.ui.setScore(this.score);
    this.target.hit = true; this.target.flash = 1;
    Physics.spawnSparks(this.sparks, this.target.x, this.target.y, '#00ff88', 60);
    Physics.spawnSparks(this.sparks, this.target.x, this.target.y, '#ffffff', 30);
    this.ui.showWin('LEVEL COMPLETE!', bonus > 0 ? '+' + bonus + ' EFFICIENCY BONUS' : '');
    if (window.Sound) Sound.win();
    var self = this;
    setTimeout(function() { self.stop(); self.onBackToMenu(); }, 3200);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _draw() {
    var ctx = this.ctx, W = this.W, H = this.H, floorY = this.floorY();
    ctx.fillStyle = '#030a18'; ctx.fillRect(0, 0, W, H);
    if (this.nebulaOffscreen) ctx.drawImage(this.nebulaOffscreen, 0, 0);
    this._drawGrid(); this._drawStars();

    for (var g = 0; g < this.objects.length; g++) {
      if (this.objects[g].type === BALL_TYPES.GRAVITY && this.objects[g].gravActive) this._drawGravityRange(this.objects[g]);
    }

    this._drawFloor(floorY);
    this._drawChute();   // chute rendered above floor, below balls
    this.barrier.draw(ctx);
    this.target.draw(ctx);
    for (var i = 0; i < this.obstacles.length; i++) this.obstacles[i].draw(ctx, this.frame);

    // Phase 2: Draw interactive objects (below balls so balls appear on top)
    for (var i = 0; i < this.buttons.length;    i++) this.buttons[i].draw(ctx);
    for (var i = 0; i < this.bricks.length;     i++) this.bricks[i].draw(ctx);  // draws regen ghost when dead
    for (var i = 0; i < this.turnstiles.length; i++) this.turnstiles[i].draw(ctx);
    for (var i = 0; i < this.ports.length;      i++) this.ports[i].draw(ctx);
    for (var i = 0; i < this.spawners.length;   i++) this.spawners[i].draw(ctx);

    for (var j = 0; j < this.objects.length;   j++) this._drawBall(this.objects[j]);
    if (this.sling) this._drawSling();
    this._drawSparks();
    this._drawSpeedSlider();
    if (this._editorMode) this._drawEditor();
  }

  // ── Brick Editor (§4.3) ───────────────────────────────────────────────────

  toggleEditor() {
    this._editorMode = !this._editorMode;
    if (this._editorMode) {
      this._editorBrickType   = 'breakable_brick';
      this._editorDragging    = null;
      this._editorSelected    = null;
    }
  }

  _editorOnDown(pos) {
    // Check if tapping an existing brick to select it
    for (var i = this.bricks.length - 1; i >= 0; i--) {
      var b = this.bricks[i];
      var hw = (b.w || b.r * 2) / 2, hh = (b.h || b.r * 2) / 2;
      if (Math.abs(pos.x - b.x) < hw + 8 && Math.abs(pos.y - b.y) < hh + 8) {
        this._editorSelected = b;
        this._editorDragOffX = pos.x - b.x;
        this._editorDragOffY = pos.y - b.y;
        this._editorDragging = b;
        return;
      }
    }
    // Place new brick
    var id  = 'brick_' + Date.now();
    var obj = null;
    if (this._editorBrickType === 'vertical_brick') {
      obj = new VerticalBrick(pos.x, pos.y, 22, 60, 100, id, 5000);
    } else if (this._editorBrickType === 'circular_brick') {
      obj = new CircularBrick(pos.x, pos.y, 22, 100, id, 5000);
    } else {
      obj = new BreakableBrick(pos.x, pos.y, 60, 22, 100, id, 5000);
    }
    this.bricks.push(obj);
    EventManager.registerTarget(id, obj);
    this._editorSelected = obj;
    this._editorDragging = obj;
    this._editorDragOffX = 0;
    this._editorDragOffY = 0;
  }

  _editorOnMove(pos) {
    if (!this._editorDragging) return;
    this._editorDragging.x = pos.x - (this._editorDragOffX || 0);
    this._editorDragging.y = pos.y - (this._editorDragOffY || 0);
  }

  _editorOnUp() {
    this._editorDragging = null;
  }

  _editorDeleteSelected() {
    if (!this._editorSelected) return;
    var idx = this.bricks.indexOf(this._editorSelected);
    if (idx >= 0) this.bricks.splice(idx, 1);
    this._editorSelected = null;
  }

  _drawEditor() {
    var ctx = this.ctx, W = this.W;

    // Semi-transparent editor overlay strip at bottom of play area (above floor)
    var panelH  = 72;
    var panelY  = this.floorY() - panelH - 4;

    ctx.save();
    ctx.fillStyle = 'rgba(0,10,30,0.88)';
    ctx.beginPath(); ctx.roundRect(6, panelY, W - 12, panelH, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,200,255,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(6, panelY, W - 12, panelH, 8); ctx.stroke();

    // Label
    ctx.fillStyle = '#00ffee'; ctx.font = "bold 9px 'Share Tech Mono',monospace";
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('BRICK EDITOR', 14, panelY + 5);

    // Brick type buttons
    var types  = ['breakable_brick', 'vertical_brick', 'circular_brick'];
    var labels = ['HORIZ', 'VERT', 'ROUND'];
    var colors = ['#4488ff', '#ff8844', '#44ff88'];
    var btnW   = 54, btnH = 24, startX = 14, btnY = panelY + 18;
    this._editorTypeBtns = [];
    for (var ti = 0; ti < types.length; ti++) {
      var bx = startX + ti * (btnW + 6);
      var active = this._editorBrickType === types[ti];
      ctx.fillStyle = active ? colors[ti] + '44' : 'rgba(0,15,40,0.8)';
      ctx.beginPath(); ctx.roundRect(bx, btnY, btnW, btnH, 4); ctx.fill();
      ctx.strokeStyle = active ? colors[ti] : colors[ti] + '66';
      ctx.lineWidth = active ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(bx, btnY, btnW, btnH, 4); ctx.stroke();
      ctx.fillStyle = active ? colors[ti] : colors[ti] + 'aa';
      ctx.font = "bold 9px 'Share Tech Mono',monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(labels[ti], bx + btnW / 2, btnY + btnH / 2);
      this._editorTypeBtns.push({ x: bx, y: btnY, w: btnW, h: btnH, type: types[ti] });
    }

    // Delete button
    var delX = startX + types.length * (btnW + 6) + 10;
    this._editorDelBtn = { x: delX, y: btnY, w: 40, h: btnH };
    ctx.fillStyle = this._editorSelected ? 'rgba(120,0,0,0.7)' : 'rgba(40,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(delX, btnY, 40, btnH, 4); ctx.fill();
    ctx.strokeStyle = this._editorSelected ? '#ff4444' : '#882222';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(delX, btnY, 40, btnH, 4); ctx.stroke();
    ctx.fillStyle = this._editorSelected ? '#ff6666' : '#884444';
    ctx.font = "bold 9px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DEL', delX + 20, btnY + btnH / 2);

    // Done button
    var doneX = W - 60;
    this._editorDoneBtn = { x: doneX, y: btnY, w: 50, h: btnH };
    ctx.fillStyle = 'rgba(0,60,30,0.8)';
    ctx.beginPath(); ctx.roundRect(doneX, btnY, 50, btnH, 4); ctx.fill();
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(doneX, btnY, 50, btnH, 4); ctx.stroke();
    ctx.fillStyle = '#00ff88';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DONE', doneX + 25, btnY + btnH / 2);

    // Instruction
    ctx.fillStyle = 'rgba(150,200,255,0.55)';
    ctx.font = "8px 'Share Tech Mono',monospace";
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('Tap canvas to place • drag to move', 14, panelY + panelH - 13);

    // Highlight selected brick
    if (this._editorSelected) {
      var sb = this._editorSelected;
      ctx.strokeStyle = 'rgba(255,255,100,0.8)';
      ctx.lineWidth   = 2;
      ctx.setLineDash([4, 4]);
      if (sb instanceof CircularBrick) {
        ctx.beginPath(); ctx.arc(sb.x, sb.y, sb.r + 6, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.roundRect(sb.x - sb.w/2 - 4, sb.y - sb.h/2 - 4, sb.w + 8, sb.h + 8, 4); ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  _drawBall(obj) {
    if (obj.dead || obj.exploded) return;
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
      // Ring darkness by tier: tier3 = darkest outer rings
      var ringDefs = [
        // tier1: 1 medium ring
        [[1.0, 'rgba(180,30,0,0.55)', 2.5]],
        // tier2: 2 rings — inner lighter, outer darker
        [[1.0, 'rgba(140,20,0,0.50)', 2], [1.55, 'rgba(200,40,0,0.70)', 2.5]],
        // tier3: 3 rings — graduated dark
        [[1.0, 'rgba(120,15,0,0.45)', 1.8], [1.5, 'rgba(170,25,0,0.60)', 2.2], [2.1, 'rgba(220,40,0,0.75)', 2.8]],
      ];
      var rings = ringDefs[tier - 1] || ringDefs[0];
      for (var ri = 0; ri < rings.length; ri++) {
        var rDef = rings[ri];
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.r * rDef[0] + 3 + pulse * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = rDef[1];
        ctx.lineWidth   = rDef[2];
        ctx.shadowColor = '#ff3300'; ctx.shadowBlur = 4 + ri * 2;
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
    obj.draw(ctx);
    if (wx !== 0 || wy !== 0) { obj.x = origX; obj.y = origY; }
    ctx.fillStyle = bs.glow + 'aa'; ctx.font = "8px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(bs.label, obj.x, obj.y + obj.r + (obj.type === BALL_TYPES.EXPLODER ? 10 : 3));
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
    ctx.strokeStyle = 'rgba(0,180,255,0.55)'; ctx.lineWidth = 2;
    ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(W, floorY); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,140,200,0.22)'; ctx.font = "9px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var hint = this._aimMode === 'push' ? '↑  DRAG UP TO AIM  ↑' : '▼  PULL DOWN TO AIM  ▼';
    ctx.fillText(hint, W / 2, floorY + 6);
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
  }

  _drawSpeedSlider() {
    var ctx    = this.ctx;
    var W      = this.W;
    var H      = this.H;
    var sliderW = Math.min(W * 0.55, 220);
    var sliderH = 28;
    var sx     = (W - sliderW) / 2;
    var sy     = H - 36;  // sits below the floor line, above bottom of screen
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
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.stroke();

    // Labels
    ctx.fillStyle    = 'rgba(0,180,255,0.6)';
    ctx.font         = "bold 8px 'Share Tech Mono', monospace";
    ctx.textAlign    = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('1/8', sx - 8, trackY);
    ctx.textAlign = 'right';
    ctx.fillText('1x', sx + sliderW + 8, trackY);

    // Current speed label
    var pct = Math.round(this.speedMult * 100);
    ctx.fillStyle    = 'rgba(180,230,255,0.9)';
    ctx.font         = "bold 9px 'Share Tech Mono', monospace";
    ctx.textAlign    = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('SPEED ' + pct + '%', sx + sliderW / 2, sy - 1);

    ctx.restore();
  }

  _drawGrid() {
    var ctx = this.ctx, W = this.W, H = this.H;
    ctx.strokeStyle = '#ffffff04'; ctx.lineWidth = 1;
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
