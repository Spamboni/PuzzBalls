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

    // Spawn active balls on the floor
    this.objects = this.ballQueue.map(function(type, i) {
      return self._makeBall(type, getSpawnX(i, self.ballQueue.length, W));
    });

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
            obj = new BreakableBrick(x, y, objDef.w || 40, objDef.h || 60, objDef.health || 3, objDef.id);
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
    var bs = BallSettings[type];
    var r  = bs.size;
    var y  = this.floorY() - r;
    var obj = new PhysObj(x, y, r, r / 10, bs.color, bs.glow, bs.label.slice(0, 3));
    obj.type     = type;
    obj.inFlight = false;
    obj.pinned   = false;
    obj.exploded = false;
    obj.dead     = false;
    obj.hasStuck = false;
    obj.hasSplit = false;
    obj.stuckTo  = null;
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

      var pos  = getPos(e);
      var best = null, bestDist = 9999;
      for (var i = 0; i < self.objects.length; i++) {
        var obj = self.objects[i];
        if (obj.inFlight || obj.stuckTo || obj.dead || obj.exploded) continue;
        var dx = pos.x - obj.x, dy = pos.y - obj.y;
        if (Math.abs(dx) < obj.r * 2.8 && dy >= -obj.r) {
          var d = Math.hypot(dx, dy);
          if (d < bestDist) { bestDist = d; best = obj; }
        }
      }
      if (best) {
        best.vx = 0; best.vy = 0; best.pinned = true;
        self.sling = { obj: best, anchorX: best.x, anchorY: best.y, pullX: pos.x, pullY: pos.y };
      }
    }

    function onMove(e) {
      e.preventDefault();
      if (!self.sling) return;
      var pos = getPos(e);
      self.sling.pullX = pos.x; self.sling.pullY = pos.y;
      var dx = self.sling.anchorX - pos.x, dy = self.sling.anchorY - pos.y;
      var dist = Math.hypot(dx, dy);
      if (dist > SLING_MIN_OFFSET && window.Sound) Sound.stretch(Math.min(dist, SLING_MAX_PULL) / SLING_MAX_PULL);
    }

    function onUp(e) {
      e.preventDefault();
      if (!self.sling) return;
      var s = self.sling, obj = s.obj;
      var dx = s.anchorX - s.pullX, dy = s.anchorY - s.pullY;
      var dist = Math.hypot(dx, dy);
      if (dist > SLING_MIN_OFFSET) {
        var bs    = BallSettings[obj.type] || BallSettings.bouncer;
        var power = Math.min(dist, SLING_MAX_PULL) * SLING_POWER * (bs.velocity || 1.0);
        obj.vx = (dx / dist) * power;
        obj.vy = (dy / dist) * power;
        obj.inFlight = true;
        if (window.Sound) Sound.snap(Math.min(dist, SLING_MAX_PULL) / SLING_MAX_PULL);
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

    // Gravity wells
    for (i = 0; i < this.objects.length; i++) {
      var gw = this.objects[i];
      if (gw.type === BALL_TYPES.GRAVITY && gw.inFlight) applyGravityWell(gw, this.objects);
      if (gw.type === BALL_TYPES.GRAVITY && !gw.inFlight && gw._slungIds && gw._slungIds.length) resetGravityWell(gw);
    }

    // Phase 2: Update interactive objects
    var dt = 16;
    for (i = 0; i < this.buttons.length;    i++) this.buttons[i].update();
    for (i = 0; i < this.ports.length;      i++) this.ports[i].update();
    for (i = 0; i < this.turnstiles.length; i++) this.turnstiles[i].update(dt);
    for (i = 0; i < this.spawners.length;   i++) this.spawners[i].update(dt);

    // Physics step
    for (i = 0; i < this.objects.length; i++) {
      var obj = this.objects[i];
      if (obj.dead) continue;
      if (obj.stuckTo) { obj.x = obj.stuckTo.x + (obj._stickOffX||0); obj.y = obj.stuckTo.y + (obj._stickOffY||0); continue; }
      if (!obj.pinned) {
        var bs = BallSettings[obj.type] || BallSettings.bouncer;
        Physics.stepObject(obj, this.W, floorY, this.sparks, { gravityMult: Settings.gravityMult, bounceMult: bs.bounciness });
      }
      if (obj.inFlight && Math.abs(obj.vy) < 1.2 && Math.abs(obj.vx) < 1.2) obj.inFlight = false;
    }

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
          if (a.type === BALL_TYPES.EXPLODER && !a.exploded) triggerExplosion(a, this.objects, this.sparks);
          if (b.type === BALL_TYPES.EXPLODER && !b.exploded) triggerExplosion(b, this.objects, this.sparks);
          this._tryStick(a, b); this._tryStick(b, a);
          if (a.type === BALL_TYPES.SPLITTER && !a.hasSplit && !a.isSplitChild && a.inFlight) { a.hasSplit = true; toAdd = toAdd.concat(makeSplitChildren(a, BallSettings.splitter.splitCount)); }
          if (b.type === BALL_TYPES.SPLITTER && !b.hasSplit && !b.isSplitChild && b.inFlight) { b.hasSplit = true; toAdd = toAdd.concat(makeSplitChildren(b, BallSettings.splitter.splitCount)); }
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
        if (!ball.dead && brick.overlaps(ball)) {
          var damage = ball.inFlight ? 2 : 1;
          if (brick.takeDamage(damage)) {
            EventManager.dispatch(brick.id + '_triggered');
          }
          this.collisions++;
          this.ui.setCollisions(this.collisions);
        }
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

    // Remove dead exploders, respawn
    var deadIdx = -1;
    for (i = 0; i < this.objects.length; i++) { if (this.objects[i].dead) { deadIdx = i; break; } }
    if (deadIdx >= 0) { this.objects.splice(deadIdx, 1); this._spawnFallingExploder(); }

    // Obstacle hits
    for (i = 0; i < this.obstacles.length; i++) {
      for (j = 0; j < this.objects.length; j++) {
        var o = this.objects[j];
        if (o.dead || o.stuckTo) continue;
        var oh = Physics.bounceOffObstacle(o, this.obstacles[i], this.sparks);
        if (oh && o.type === BALL_TYPES.EXPLODER && !o.exploded) triggerExplosion(o, this.objects, this.sparks);
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
    if (sticky.type !== BALL_TYPES.STICKY || sticky.stuckTo || other.stuckTo || other.dead) return;
    sticky.stuckTo = other; sticky._stickOffX = sticky.x - other.x; sticky._stickOffY = sticky.y - other.y;
    sticky.vx = 0; sticky.vy = 0; sticky.inFlight = false;
    if (window.Sound) Sound.thud(8);
  }

  _spawnFallingExploder() {
    var bs = BallSettings.exploder, r = bs.size;
    var obj = new PhysObj((0.2 + Math.random() * 0.6) * this.W, -r * 3, r, r/10, bs.color, bs.glow, 'EXP');
    obj.type = BALL_TYPES.EXPLODER; obj.inFlight = true; obj.pinned = false;
    obj.exploded = false; obj.dead = false; obj.hasStuck = false; obj.hasSplit = false; obj.stuckTo = null;
    obj.vx = (Math.random() - 0.5) * 3; obj.vy = 2;
    this.objects.push(obj);
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
      if (this.objects[g].type === BALL_TYPES.GRAVITY && this.objects[g].inFlight) this._drawGravityRange(this.objects[g]);
    }

    this._drawFloor(floorY);
    this.barrier.draw(ctx);
    this.target.draw(ctx);
    for (var i = 0; i < this.obstacles.length; i++) this.obstacles[i].draw(ctx, this.frame);

    // Phase 2: Draw interactive objects (below balls so balls appear on top)
    for (var i = 0; i < this.buttons.length;    i++) this.buttons[i].draw(ctx);
    for (var i = 0; i < this.bricks.length;     i++) { if (this.bricks[i].isAlive()) this.bricks[i].draw(ctx); }
    for (var i = 0; i < this.turnstiles.length; i++) this.turnstiles[i].draw(ctx);
    for (var i = 0; i < this.ports.length;      i++) this.ports[i].draw(ctx);
    for (var i = 0; i < this.spawners.length;   i++) this.spawners[i].draw(ctx);

    for (var j = 0; j < this.objects.length;   j++) this._drawBall(this.objects[j]);
    if (this.sling) this._drawSling();
    this._drawSparks();
  }

  _drawBall(obj) {
    if (obj.dead || obj.exploded) return;
    var ctx = this.ctx, bs = BallSettings[obj.type] || BallSettings.bouncer;
    var pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.06 + obj.r);
    if (obj.type !== BALL_TYPES.BOUNCER) {
      ctx.beginPath(); ctx.arc(obj.x, obj.y, obj.r + 4 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = bs.glow + '66'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    obj.draw(ctx);
    ctx.fillStyle = bs.glow + 'aa'; ctx.font = "8px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(bs.label, obj.x, obj.y + obj.r + 3);
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
    ctx.fillText('▼  PULL DOWN TO AIM  ▼', W / 2, floorY + 6);
    ctx.restore();
  }

  _drawSling() {
    var ctx = this.ctx, s = this.sling, obj = s.obj;
    var dx = s.anchorX - s.pullX, dy = s.anchorY - s.pullY;
    var dist = Math.hypot(dx, dy);
    if (dist < SLING_MIN_OFFSET) return;
    var power = Math.min(dist, SLING_MAX_PULL) / SLING_MAX_PULL;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,200,60,' + (0.45 + power * 0.5) + ')';
    ctx.lineWidth = 2.5; ctx.shadowColor = '#ffcc30'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(obj.x - obj.r * 0.5, obj.y); ctx.lineTo(s.pullX, s.pullY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(obj.x + obj.r * 0.5, obj.y); ctx.lineTo(s.pullX, s.pullY); ctx.stroke();
    ctx.shadowBlur = 0;
    var bs = BallSettings[obj.type] || BallSettings.bouncer;
    var vx = (dx/dist) * Math.min(dist, SLING_MAX_PULL) * SLING_POWER * (bs.velocity||1);
    var vy = (dy/dist) * Math.min(dist, SLING_MAX_PULL) * SLING_POWER * (bs.velocity||1);
    var px = obj.x, py = obj.y, grav = Physics.PHYSICS.GRAVITY * Settings.gravityMult, fric = Physics.PHYSICS.FRICTION;
    for (var i = 0; i < 34; i++) {
      vy += grav; vx *= fric; vy *= fric; px += vx; py += vy;
      if (px < 0 || px > this.W || py < 0 || py > this.floorY()) break;
      ctx.beginPath(); ctx.arc(px, py, (1 - i/34) * 4.5 * power + 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,220,80,' + (1-i/34)*power*0.75 + ')'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(s.pullX, s.pullY, 10 + power * 7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,200,60,' + (0.35 + power*0.5) + ')'; ctx.lineWidth = 2; ctx.stroke();
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
