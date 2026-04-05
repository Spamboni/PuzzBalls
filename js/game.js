window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_FILE_VERSION['game.js'] = 1438;
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
    this.brickSpeedMult = 0.5;  // brick movement speed multiplier
    this._slingZoneH    = 100;  // px above floor that balls can be tapped
    this.tubes          = new TubeManager();
    this._tubeSelected  = null;
    this._tubeDragging  = null;
    this._editorTubeMode = false;
    this._viewScrollY     = 0;   // px the whole view is shifted up
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

      // ── Corner HUD buttons (bottom strip) ───────────────────────────────────
      if (self._cornerBrickBtns) {
        for (var cbi = 0; cbi < self._cornerBrickBtns.length; cbi++) {
          var cbr = self._cornerBrickBtns[cbi];
          if (pos.x >= cbr.x && pos.x <= cbr.x + cbr.w && pos.y >= cbr.y && pos.y <= cbr.y + cbr.h) {
            if (window.Sound && Sound.uiToggle) Sound.uiToggle(!window[cbr.key]);
            window[cbr.key] = !window[cbr.key]; return;
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
            else if (hcb.type===1) { self.objects.forEach(function(o){o.dead=true;}); }
            else if (hcb.type===2) { self.tubes.tubes=[]; }
            if(window.Sound&&Sound.uiTap)Sound.uiTap(0.3); return;
          }
        }
      }
      // ── Editor mode ──────────────────────────────────────────────────────────
      if (self._editorMode) {
        // Taps in the chute column (right strip) always start a scroll — never build there
        var chuteX = self.W - 50;
        if (pos.x >= chuteX && pos.y < self.floorY() + (self._viewScrollY || 0)) {
          self._editorScrollPending  = true;
          self._editorScrollDragging = false;
          self._editorScrollStart    = self._viewScrollY || 0;
          self._editorScrollDragY    = pos.y;
          return;
        }
        // Panel boundary in screen space = floorY shifted by viewScrollY
        var _screenFloorY = self.floorY() + (self._viewScrollY || 0);
        var inPanel = pos.y >= _screenFloorY;

        // Always check panel buttons regardless of Y position (buttons are below floor)
        if (self._editorModeBtn) {
          var mb2 = self._editorModeBtn;
          if (pos.x >= mb2.x && pos.x <= mb2.x + mb2.w && pos.y >= mb2.y && pos.y <= mb2.y + mb2.h) {
            self._editorSelectMode = !self._editorSelectMode;
            self._editorSelected   = null;
            return;
          }
        }
        // Clear all bricks
        if (self._editorResetDefBtn) {
          var rdb = self._editorResetDefBtn;
          if (pos.x >= rdb.x && pos.x <= rdb.x+rdb.w && pos.y >= rdb.y && pos.y <= rdb.y+rdb.h) {
            self._editorLastSettings = null;  // clear last-used template
            if (self._editorSelected) {
              // Reset selected brick to factory defaults
              var bd3 = window.BrickDefaults || {};
              var sb_r = self._editorSelected;
              sb_r.maxHealth = bd3.rectHP || 100; sb_r.health = sb_r.maxHealth;
              sb_r.regenAfter = bd3.rectRegen || 2000;
              sb_r._density = bd3.density || 1.0;
              sb_r._maxTravel = bd3.maxTravel || 60;
              sb_r._decel = bd3.decel || 0.88;
              sb_r._rotSpeed = 0.5; sb_r._rotDecel = 0.88;
              sb_r._invincible = false; sb_r._noRegen = false;
              sb_r._noteConfig = null; sb_r._movable = false;
            }
            return;
          }
        }
        if (self._editorClearBtn) {
          var cb = self._editorClearBtn;
          if (pos.x >= cb.x && pos.x <= cb.x + cb.w && pos.y >= cb.y && pos.y <= cb.y + cb.h) {
            self.bricks = [];
            self._editorSelected = null;
            return;
          }
        }
        // Check editor panel buttons first
        if (self._editorTypeBtns) {
          for (var ti = 0; ti < self._editorTypeBtns.length; ti++) {
            var tb = self._editorTypeBtns[ti];
            if (pos.x >= tb.x && pos.x <= tb.x + tb.w && pos.y >= tb.y && pos.y <= tb.y + tb.h) {
              self._editorBrickType = tb.type; return;
            }
          }
        }
        // Slider drag start — check all sliders
        if (self._editorSliders) {
          var sliderDefs = [
            { id:'hp',     key:'maxHealth',  defKey:'rectHP',    step:5,    min:10,   max:400,  invert:false },
            { id:'regen',  key:'regenAfter', defKey:'rectRegen', step:100,  min:200,  max:10000,invert:false },
            { id:'dens',   key:'_density',   defKey:'density',   step:0.1,  min:0.5,  max:5.0,  invert:false },
            { id:'dist',   key:'_maxTravel', defKey:'maxTravel', step:10,   min:0,    max:900,  invert:false },
            { id:'decel',  key:'_decel',     defKey:'decel',     step:0.01, min:0.50, max:0.99, invert:true  },
            { id:'rotspd', key:'_rotSpeed',  defKey:'rotSpeed',  step:0.05, min:0.0,  max:1.0,  invert:false },
            { id:'rotdec', key:'_rotDecel',  defKey:'rotDecel',  step:0.01, min:0.05, max:0.95, invert:true  },
            { id:'blen',   key:'_blen',      defKey:'rectW',     step:5,    min:5,    max:900,  invert:false, isDim:true },
            { id:'bwid',   key:'_bwid',      defKey:'rectH',     step:1,    min:2,    max:200,  invert:false, isDim:true },
            { id:'rot',    key:'_rotDeg',    defKey:null,        step:1,    min:-180, max:180,  invert:false, isRot:true },
            { id:'wbounce',key:'_wallBounce',defKey:'wallBounce', step:0.05, min:0.0,  max:1.0,  invert:false },
          ];
          var movNow = self._editorSelected ? (self._editorSelected._movable||false) : (self._editorMovable||false);
          for (var sdi = 0; sdi < sliderDefs.length; sdi++) {
            var sd  = sliderDefs[sdi];
            var sl2 = self._editorSliders[sd.id];
            if (!sl2) continue;
            // Skip DENS/DIST if not movable
            if ((sd.id === 'dens' || sd.id === 'dist') && !movNow) continue;
            if (pos.x >= sl2.trackX - 8 && pos.x <= sl2.trackX + sl2.trackW + (sl2.infRect ? sl2.infRect.w + 10 : 8) &&
                pos.y >= sl2.y + 2 && pos.y <= sl2.y + sl2.h - 2) {
              // Check ∞ button on HP (invincible) and REGEN (no regen)
              if (sl2.infRect) {
                var ir = sl2.infRect;
                if (pos.x >= ir.x && pos.x <= ir.x + ir.w && pos.y >= ir.y && pos.y <= ir.y + ir.h) {
                  if (sd.id === 'hp') {
                    if (self._editorSelected) {
                      var sb_inv = self._editorSelected;
                      sb_inv._invincible = !sb_inv._invincible;
                      if (!sb_inv._invincible) {
                        sb_inv.maxHealth = sb_inv.maxHealth || 100;
                        sb_inv.health    = sb_inv.maxHealth;
                      } else {
                        sb_inv.health = sb_inv.maxHealth;  // full health when made invincible
                      }
                    }
                  } else if (sd.id === 'regen') {
                    if (self._editorSelected) self._editorSelected._noRegen = !self._editorSelected._noRegen;
                  }
                  return;
                }
              }
              // Double-tap: only in brick mode, not tube mode
              if (self._editorTubeMode) {
                self._editorDragSlider = Object.assign({ key: sd.key, defKey: sd.defKey, step: sd.step, invert: sd.invert, isDim: sd.isDim, isRot: sd.isRot, id: sd.id }, sl2);
                return;
              }
              var elapsed2 = performance.now() - (self._lastSliderTap || 0);
              if (elapsed2 < 350 && self._lastSliderTapId === sd.id) {
                self._lastSliderTap = 0;
                var curVal2 = self._editorSelected ? (self._editorSelected[sd.key] || 0) : (window.BrickDefaults && window.BrickDefaults[sd.defKey] || 0);
                var entered = prompt(sd.id.toUpperCase() + ' (' + sd.min + ' - ' + sd.max + '):', sd.invert ? (1-curVal2).toFixed(2) : String(curVal2));
                if (entered !== null) {
                  var parsed = parseFloat(entered);
                  if (!isNaN(parsed)) {
                    var clamped = Math.max(sd.min, Math.min(sd.max, parsed));
                    var actual = sd.invert ? (1 - clamped) : clamped;
                    self._setSliderVal(sd.key, sd.defKey, actual, sd);
                  }
                }
                return;
              }
              self._lastSliderTap = performance.now();
              self._lastSliderTapId = sd.id;
              // Start drag on track
              self._editorDragSlider = Object.assign({ key: sd.key, defKey: sd.defKey, step: sd.step, invert: sd.invert, isDim: sd.isDim, isRot: sd.isRot, id: sd.id }, sl2);
              return;
            }
          }
        }
        // Inline movable toggle
        if (self._editorMovInlineRect) {
          var mr2 = self._editorMovInlineRect;
          if (pos.x >= mr2.x && pos.x <= mr2.x + mr2.w && pos.y >= mr2.y && pos.y <= mr2.y + mr2.h) {
            if (self._editorSelected) {
              self._editorSelected._movable = !self._editorSelected._movable;
              self._editorMovable = self._editorSelected._movable;
            } else {
              self._editorMovable = !self._editorMovable;
            }
            return;
          }
        }
        // Pivot selector
        if (self._editorPivotRects) {
          for (var piv = 0; piv < self._editorPivotRects.length; piv++) {
            var pr = self._editorPivotRects[piv];
            if (!pr.enabled) continue;  // greyed out — ignore tap
            if (pos.x >= pr.x && pos.x <= pr.x + pr.w && pos.y >= pr.y && pos.y <= pr.y + pr.h) {
              if (self._editorSelected) self._editorSelected._pivot = pr.val;
              self._editorPivot = pr.val;
              return;
            }
          }
        }
        // Translate toggle
        if (self._editorTransRect) {
          var tr2 = self._editorTransRect;
          if (pos.x >= tr2.x && pos.x <= tr2.x + tr2.w && pos.y >= tr2.y && pos.y <= tr2.y + tr2.h) {
            if (self._editorSelected) {
              self._editorSelected._translateOnRotate = !(self._editorSelected._translateOnRotate !== false);
              self._editorTranslate = self._editorSelected._translateOnRotate;
            } else {
              self._editorTranslate = !(self._editorTranslate !== false);
            }
            return;
          }
        }
        // Note popup interactions (checked before other panel buttons to intercept)
        if (self._editorNotePopup && self._editorSelected) {
          var sb3 = self._editorSelected;
          // Close button
          if (self._notePopupClose) {
            var nc2 = self._notePopupClose;
            if (pos.x >= nc2.x && pos.x <= nc2.x + nc2.w && pos.y >= nc2.y && pos.y <= nc2.y + nc2.h) {
              self._editorNotePopup = false; return;
            }
          }
          // Note buttons
          if (self._notePopupNoteRects) {
            for (var nni = 0; nni < self._notePopupNoteRects.length; nni++) {
              var nnr = self._notePopupNoteRects[nni];
              if (pos.x >= nnr.x && pos.x <= nnr.x+nnr.w && pos.y >= nnr.y && pos.y <= nnr.y+nnr.h) {
                sb3._noteConfig = sb3._noteConfig || {};
                sb3._noteConfig.note = nnr.val;
                // Auto-preview
                if (window.BrickNote) window.BrickNote.playNote(nnr.val, sb3._noteConfig.octave||4, sb3._noteConfig.timbre||'marimba', (sb3._noteConfig.vol||0.6));
                return;
              }
            }
          }
          // Octave buttons
          if (self._notePopupOctaveRects) {
            for (var noi = 0; noi < self._notePopupOctaveRects.length; noi++) {
              var nor2 = self._notePopupOctaveRects[noi];
              if (pos.x >= nor2.x && pos.x <= nor2.x+nor2.w && pos.y >= nor2.y && pos.y <= nor2.y+nor2.h) {
                sb3._noteConfig = sb3._noteConfig || {};
                sb3._noteConfig.octave = nor2.val;
                if (window.BrickNote) window.BrickNote.playNote(sb3._noteConfig.note||'C', nor2.val, sb3._noteConfig.timbre||'marimba', (sb3._noteConfig.vol||0.6));
                return;
              }
            }
          }
          // Timbre buttons
          if (self._notePopupTimbreRects) {
            for (var nti4 = 0; nti4 < self._notePopupTimbreRects.length; nti4++) {
              var ntr = self._notePopupTimbreRects[nti4];
              if (pos.x >= ntr.x && pos.x <= ntr.x+ntr.w && pos.y >= ntr.y && pos.y <= ntr.y+ntr.h) {
                sb3._noteConfig = sb3._noteConfig || {};
                sb3._noteConfig.timbre = ntr.val;
                // Preview the sound
                if (window.BrickNote) window.BrickNote.playNote(sb3._noteConfig.note||'C', sb3._noteConfig.octave||4, ntr.val, 0.5);
                return;
              }
            }
          }
          // Preview button
          if (self._notePopupPreviewBtn) {
            var pb = self._notePopupPreviewBtn;
            if (pos.x >= pb.x && pos.x <= pb.x+pb.w && pos.y >= pb.y && pos.y <= pb.y+pb.h) {
              var cfg2 = sb3._noteConfig || {};
              if (window.BrickNote) window.BrickNote.playNote(cfg2.note||'C', cfg2.octave||4, cfg2.timbre||'marimba', 0.6);
              return;
            }
          }
          // Clear button
          if (self._notePopupClearBtn) {
            var clb = self._notePopupClearBtn;
            if (pos.x >= clb.x && pos.x <= clb.x+clb.w && pos.y >= clb.y && pos.y <= clb.y+clb.h) {
              sb3._noteConfig = null; self._editorNotePopup = false; return;
            }
          }
          // Volume slider drag
          if (self._notePopupVolSlider) {
            var vs = self._notePopupVolSlider;
            if (pos.x >= vs.x && pos.x <= vs.x + vs.w && pos.y >= vs.y && pos.y <= vs.y + vs.h) {
              var t2 = Math.max(0, Math.min(1, (pos.x - vs.trackX) / vs.trackW));
              sb3._noteConfig = sb3._noteConfig || {};
              sb3._noteConfig.vol = parseFloat((0.05 + t2 * 1.15).toFixed(2));
              return;
            }
          }
          return; // block other taps while popup is open
        }
        // Note button tap
        if (self._editorNoteBtn && self._editorSelected) {
          var nb = self._editorNoteBtn;
          if (pos.x >= nb.x && pos.x <= nb.x+nb.w && pos.y >= nb.y && pos.y <= nb.y+nb.h) {
            self._editorNotePopup = !self._editorNotePopup;
            if (!self._editorSelected._noteConfig) self._editorSelected._noteConfig = { note:'C', octave:4, timbre:'marimba' };
            return;
          }
        }
        // Tab switching — ALWAYS checked first, before any panel content routing
        // Quick-clear buttons
        var _tabY = pos.y - (self._viewScrollY || 0);
        if (self._editorQuickClearBtns) {
          for (var qci2=0;qci2<self._editorQuickClearBtns.length;qci2++) {
            var qcb=self._editorQuickClearBtns[qci2];
            if (pos.x>=qcb.x&&pos.x<=qcb.x+qcb.w&&_tabY>=qcb.y&&_tabY<=qcb.y+qcb.h) {
              if (qcb.type===0) { self._undoPush(); self.bricks=[]; }
              else if (qcb.type===1) { self.objects.forEach(function(o){o.dead=true;}); }
              else if (qcb.type===2) { self.tubes.tubes=[]; }
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.3); return;
            }
          }
        }
        // Tab checks — translate to editor coordinate space
        if (self._editorBrickTab) {
          var bt = self._editorBrickTab;
          if (pos.x >= bt.x-6 && pos.x <= bt.x+bt.w+6 && _tabY >= bt.y-6 && _tabY <= bt.y+bt.h+10) {
            self._editorTubeMode = false; window._tubeEditorMode = false;
            if (window.Sound && Sound.uiTap) Sound.uiTap(0.2); return;
          }
        }
        if (self._editorTubeTab) {
          var tt = self._editorTubeTab;
          if (pos.x >= tt.x-6 && pos.x <= tt.x+tt.w+6 && _tabY >= tt.y-6 && _tabY <= tt.y+tt.h+10) {
            self._editorTubeMode = true; window._tubeEditorMode = true;
            if (window.Sound && Sound.uiTap) Sound.uiTap(0.2); return;
          }
        }
        // Done button — in both brick and tube modes
        if (self._editorDoneBtn) {
          var dnb2 = self._editorDoneBtn;
          if (pos.x >= dnb2.x-4 && pos.x <= dnb2.x+dnb2.w+4 && _tabY >= dnb2.y-4 && _tabY <= dnb2.y+dnb2.h+4) {
            self.toggleEditor(); return;
          }
        }
        // In tube editor mode — handle tube panel taps
        if (self._editorTubeMode && inPanel) {
          // Translate tap position into editor coordinate space
          var _tpy = pos.y - (self._viewScrollY || 0);
          var _tpx = pos.x;
          // Type buttons
          if (self._tubeBtns) for (var tbi=0;tbi<self._tubeBtns.length;tbi++) {
            var tb=self._tubeBtns[tbi];
            if (_tpx>=tb.x-2&&_tpx<=tb.x+tb.w+2&&_tpy>=tb.y-2&&_tpy<=tb.y+tb.h+2) {
              self._tubeType=tb.val; if(window.Sound&&Sound.uiTap)Sound.uiTap(0.22); return;
            }
          }
          // Style buttons
          if (self._tubeStyleBtns) for (var tsb=0;tsb<self._tubeStyleBtns.length;tsb++) {
            var tsbt=self._tubeStyleBtns[tsb];
            if (_tpx>=tsbt.x&&_tpx<=tsbt.x+tsbt.w&&_tpy>=tsbt.y&&_tpy<=tsbt.y+tsbt.h) { self._tubeStyle=tsbt.val; if(self._tubeSelected)self._tubeSelected.style=tsbt.val; return; }
          }
          // Anchor buttons
          if (self._tubeAnchorBtns) for (var tab2=0;tab2<self._tubeAnchorBtns.length;tab2++) {
            var tabtn=self._tubeAnchorBtns[tab2];
            if (_tpx>=tabtn.x&&_tpx<=tabtn.x+tabtn.w&&_tpy>=tabtn.y&&_tpy<=tabtn.y+tabtn.h) {
              self._tubeAnchor=tabtn.val; return;
            }
          }
          // Layer buttons
          if (self._tubeLayerBtns) for (var tlb=0;tlb<self._tubeLayerBtns.length;tlb++) {
            var tlbt=self._tubeLayerBtns[tlb];
            if (_tpx>=tlbt.x&&_tpx<=tlbt.x+tlbt.w&&_tpy>=tlbt.y&&_tpy<=tlbt.y+tlbt.h) { self._tubeLayer=tlbt.val; if(self._tubeSelected)self._tubeSelected.layer=tlbt.val; return; }
          }
          // Delete tube button
          if (self._tubeDelBtn) {
            var tdb=self._tubeDelBtn;
            if (_tpx>=tdb.x&&_tpx<=tdb.x+tdb.w&&_tpy>=tdb.y&&_tpy<=tdb.y+tdb.h) {
              self.tubes.remove(self._tubeSelected); self._tubeSelected=null;
              if(window.Sound&&Sound.uiTap)Sound.uiTap(0.25); return;
            }
          }
          // Build/Select mode toggle
          if (self._tubeModeBtn) {
            var tmb=self._tubeModeBtn;
            if (pos.x>=tmb.x&&pos.x<=tmb.x+tmb.w&&pos.y>=tmb.y&&pos.y<=tmb.y+tmb.h) {
              self._tubeSelectMode=!self._tubeSelectMode;
              if(window.Sound&&Sound.uiToggle)Sound.uiToggle(self._tubeSelectMode); return;
            }
          }
          // Sliders
          var tubeSliders = [
            { sl:self._tubeSliderLen, cb:function(v){self._tubeLength=v;if(self._tubeSelected){self._tubeSelected.length=v;self._tubeSelected.rebuild();}} },
            { sl:self._tubeSliderSpd, cb:function(v){self._tubeSpeedMod=v;if(self._tubeSelected)self._tubeSelected.speedMod=v;} },
            { sl:self._tubeSliderRot, cb:function(v){self._tubeRotation=v*Math.PI/180;if(self._tubeSelected){self._tubeSelected.rotation=v*Math.PI/180;self._tubeSelected.rebuild();}} },
          ];
          for (var tsi=0;tsi<tubeSliders.length;tsi++) {
            var tsl=tubeSliders[tsi].sl, tcb=tubeSliders[tsi].cb;
            if (!tsl) continue;
            // Use generous hit area — full row height around the slider track
            if (_tpx>=tsl.trackX-16&&_tpx<=tsl.trackX+tsl.trackW+16&&
                _tpy>=tsl.y-8&&_tpy<=tsl.y+tsl.h+8) {
              self._tubeDragSlider={sl:tsl,cb:tcb}; return;
            }
          }
          return;
        }

        // In tube editor mode — handle tube taps
        if (self._editorTubeMode) {
          // Tube placement and selection handled by _tubeEditorOnDown
          if (!inPanel) self._tubeEditorOnDown(pos);
          return;
        }
        // GRID toggle
        if (self._editorGridBtn) {
          var gb = self._editorGridBtn;
          if (pos.x >= gb.x && pos.x <= gb.x+gb.w && pos.y >= gb.y && pos.y <= gb.y+gb.h) {
            window._showEditorGrid = !window._showEditorGrid; return;
          }
        }
        if (self._editorGridSizeBtn) {
          var gsb = self._editorGridSizeBtn;
          if (pos.x >= gsb.x && pos.x <= gsb.x+gsb.w && pos.y >= gsb.y && pos.y <= gsb.y+gsb.h) {
            var gv = prompt('Grid size (5-100px):', String(window._gridSize||20));
            if (gv !== null) { var gn = parseInt(gv); if (!isNaN(gn) && gn >= 5 && gn <= 100) window._gridSize = gn; }
            return;
          }
        }
        // SNAP-GRID toggle
        if (self._editorSnapGridBtn) {
          var sgb = self._editorSnapGridBtn;
          if (pos.x >= sgb.x && pos.x <= sgb.x+sgb.w && pos.y >= sgb.y && pos.y <= sgb.y+sgb.h) {
            window._snapToGrid = !window._snapToGrid; return;
          }
        }
        // Snap selector cycle
        if (self._editorSnapBtn) {
          var sb = self._editorSnapBtn;
          if (pos.x >= sb.x && pos.x <= sb.x + sb.w && pos.y >= sb.y && pos.y <= sb.y + sb.h) {
            var snaps = [0, 15, 30, 45];
            var cur = snaps.indexOf(self._editorSnapDeg || 0);
            self._editorSnapDeg = snaps[(cur + 1) % snaps.length];
            return;
          }
        }
        // Movable toggle
        if (self._editorMovBtn) {
          var mb = self._editorMovBtn;
          if (pos.x >= mb.x && pos.x <= mb.x + mb.w && pos.y >= mb.y && pos.y <= mb.y + mb.h) {
            self._editorMovable = !self._editorMovable;
            if (self._editorSelected) {
              self._editorSelected._movable = self._editorMovable;
            }
            return;
          }
        }
        if (self._editorDelBtn) {
          var db = self._editorDelBtn;
          if (pos.x >= db.x && pos.x <= db.x + db.w && pos.y >= db.y && pos.y <= db.y + db.h) {
            self._editorDeleteSelected(); return;
          }
        }
        if (self._editorUndoBtn) {
          var ub = self._editorUndoBtn;
          if (pos.x >= ub.x && pos.x <= ub.x+ub.w && pos.y >= ub.y && pos.y <= ub.y+ub.h) {
            if (self._undoHistory && self._undoHistory.length > 0) {
              self._redoHistory.push(self._undoHistory.pop());
              var snap = self._undoHistory[self._undoHistory.length-1];
              if (snap) self._undoApply(snap);
              else self.bricks = [];
            }
            return;
          }
        }
        if (self._editorRedoBtn) {
          var rb = self._editorRedoBtn;
          if (pos.x >= rb.x && pos.x <= rb.x+rb.w && pos.y >= rb.y && pos.y <= rb.y+rb.h) {
            if (self._redoHistory && self._redoHistory.length > 0) {
              var rSnap = self._redoHistory.pop();
              self._undoHistory.push(rSnap);
              self._undoApply(rSnap);
            }
            return;
          }
        }
        if (self._editorDoneBtn) {
          var dnb = self._editorDoneBtn;
          if (pos.x >= dnb.x && pos.x <= dnb.x + dnb.w && pos.y >= dnb.y && pos.y <= dnb.y + dnb.h) {
            self.toggleEditor(); return;
          }
        }
        // Only place/select bricks in the play area (above floor)
        // Only interact with play area for brick placement when NOT in tube mode
        // Convert screen pos to world pos (account for scroll)
        var _worldPos = { x: pos.x, y: pos.y - (self._viewScrollY || 0) };
        if (!inPanel && !self._editorTubeMode) self._editorOnDown(_worldPos);
        else if (!inPanel && self._editorTubeMode) self._tubeEditorOnDown(_worldPos);
        return;
      }

      // ── Speed slider ─────────────────────────────────────────────────────
      if (self._zoneSliderRect) {
        var zsr = self._zoneSliderRect;
        if (pos.y >= zsr.y - 10 && pos.y <= zsr.y + zsr.h + 10 &&
            pos.x >= zsr.x - 15  && pos.x <= zsr.x + zsr.w + 15) {
          self._draggingZoneSlider = true;
          var zt = Math.max(0, Math.min(1, (pos.x - zsr.x) / zsr.w));
          self._slingZoneH = Math.round(40 + zt * 260);
          return;
        }
      }
      if (self._brickSliderRect) {
        var bsr = self._brickSliderRect;
        if (pos.y >= bsr.y - 10 && pos.y <= bsr.y + bsr.h + 10 &&
            pos.x >= bsr.x - 15  && pos.x <= bsr.x + bsr.w + 15) {
          self._draggingBrickSlider = true;
          self.brickSpeedMult = Math.max(0, Math.min(1, (pos.x - bsr.x) / bsr.w));
          return;
        }
      }
      if (self._sliderRect) {
        var sr = self._sliderRect;
        if (pos.y >= sr.y - 10 && pos.y <= sr.y + sr.h + 10 &&
            pos.x >= sr.x - 15  && pos.x <= sr.x + sr.w + 15) {
          self._draggingSlider = true;
          var t = Math.max(0, Math.min(1, (pos.x - sr.x) / sr.w));
          self.speedMult = 0.125 + t * 0.875;
          return;
        }
      }
      if (self._chuteButtonRects) {
        for (var bi = 0; bi < self._chuteButtonRects.length; bi++) {
          var br = self._chuteButtonRects[bi];
          if (pos.x >= br.x && pos.x <= br.x + br.w &&
              pos.y >= br.y && pos.y <= br.y + br.h) {
            self._btnPressFlash = { type: br.type, frame: self.frame };
            if (window.Sound && Sound.uiTap) Sound.uiTap(0.28);
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
          if (window.Sound && Sound.uiToggle) Sound.uiToggle(self._deleteMode);
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

      // ── Tap stuck sticky ball — launch along stored surface normal ────────────
      for (var si = 0; si < self.objects.length; si++) {
        var sobj = self.objects[si];
        if (sobj.type === BALL_TYPES.STICKY && sobj.stuckTo === '_wall_') {
          if (Math.hypot(pos.x - sobj.x, pos.y - sobj.y) < sobj.r + 14) {
            var bs_s = BallSettings.sticky;
            // Direction = from ball toward tap point (flick in direction of tap)
            var tapDX = pos.x - sobj.x, tapDY = pos.y - sobj.y;
            var tapDist = Math.hypot(tapDX, tapDY) || 1;
            var tapNX = tapDX / tapDist, tapNY = tapDY / tapDist;

            // Surface normal (away from wall)
            var nx = sobj._stickNx !== undefined ? sobj._stickNx : 0;
            var ny = sobj._stickNy !== undefined ? sobj._stickNy : -1;

            // If tap is on the same side as the wall (would go into wall), reflect
            if (tapNX * nx + tapNY * ny < 0) { tapNX = -tapNX; tapNY = -tapNY; }

            // Fixed launch speed (set velocity, not random)
            var launchSpeed = (bs_s.bounceHeightY || 80) / 18;
            sobj.vx = tapNX * launchSpeed;
            sobj.vy = tapNY * launchSpeed;

            // Nudge away from wall
            sobj.x += nx * (sobj.r + 3);
            sobj.y += ny * (sobj.r + 3);

            sobj.stuckTo  = null;
            sobj.inFlight = true;
            sobj._stickNx = undefined;
            sobj._stickNy = undefined;
            if (window.Sound) Sound.thud(3);
            return;
          }
        }
      }

      // Fall-through: in editor mode, start tentative scroll (committed after 6px drag)
      if (self._editorMode) {
        self._editorScrollPending  = true;
        self._editorScrollDragging = false;
        self._editorScrollStart    = self._viewScrollY || 0;
        self._editorScrollDragY    = pos.y;
        return;
      }

      // ── Ball selection: resting balls + balls within sling zone ────────────
      var zoneH2   = self._slingZoneH !== undefined ? self._slingZoneH : 100;
      var zoneTop  = self.floorY() - zoneH2;
      var best = null, bestDist = 9999;
      for (var i = 0; i < self.objects.length; i++) {
        var obj = self.objects[i];
        if (obj.dead || obj.exploded) continue;
        if (obj.stuckTo && obj.stuckTo !== '_wall_') continue;
        if (obj.stuckTo === '_wall_') continue;
        // Allow: resting balls OR in-flight balls that are within the sling zone
        var inZone = obj.y >= zoneTop - obj.r;
        if (obj.inFlight && !inZone) continue;
        var dx = pos.x - obj.x, dy = pos.y - obj.y;
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
                         startX: pos.x, startY: pos.y, pullX: pos.x, pullY: pos.y };
        } else {
          best.vx = 0; best.vy = 0; best.pinned = true;
          self.sling = { obj: best, anchorX: best.x, anchorY: best.y,
                         startX: pos.x, startY: pos.y, pullX: pos.x, pullY: pos.y };
        }
      }
    }

    function onMove(e) {
      e.preventDefault();
      var pos = getPos(e);
      // Tube slider drag
      if (self._tubeDragSlider) {
        var tsl2 = self._tubeDragSlider.sl;
        var t3 = Math.max(0, Math.min(1, (pos.x - tsl2.trackX) / tsl2.trackW));  // X doesn't need scroll offset
        var v3 = tsl2.min + t3 * (tsl2.max - tsl2.min);
        self._tubeDragSlider.cb(v3);
        return;
      }
      // Tube piece drag
      // Two-finger tube manipulation
      if (self._tubeDragging && e.touches && e.touches.length >= 2 && !self._editorMode) {
        // handled below via _tubeHandleTouch
      }
      if (self._tubeDragging) {
        var td = self._tubeDragging;
        var conn = td.connectedA || td.connectedB;
        if (conn) {
          // Pivot around joint
          self.tubes.dragConnected(td, pos, self._tubeDragOffX || 0, self._tubeDragOffY || 0);
        } else {
          td.x = pos.x - (self._tubeDragOffX || 0);
          td.y = pos.y - (self._tubeDragOffY || 0);
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
            var maxScroll = -340;  // enough to see full editor
            self._viewScrollY = Math.max(maxScroll, Math.min(0, rawScroll));
            return;
          }
        }
        self._editorOnMove(pos); return;
      }
      // If dragging from a floor ball, check if it's a real drag (> 8px = sling, not pop)
      if (self._pendingFloorBall) {
        var pfb = self._pendingFloorBall;
        if (Math.hypot(pos.x - pfb.touchX, pos.y - pfb.touchY) > 8) {
          self._pendingFloorBall = null;  // committed to sling drag
        }
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
      self._draggingBrickSlider = false;
      self._draggingZoneSlider = false;
      // Release tube drag — apply snap if close enough
      if (self._tubeDragging) {
        var snapResult = self.tubes.checkSnap(self._tubeDragging);
        if (snapResult && snapResult.dist < self.tubes.SNAP_DIST) {
          self.tubes.applySnap(self._tubeDragging, snapResult, false);
        }
        self._tubeDragging = null;
      }
      self._tubeDragSlider = null;

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

        // Per-ball-per-brick contact cooldown — suppresses damage re-trigger
        var coolKey = '_brickCool_' + brick.id;
        var onCooldown = ball[coolKey] > 0;
        if (onCooldown) { ball[coolKey]--; }  // keep counting down but still eject below

        // Swept collision: if ball moved far this frame, check the path too
        if (onCooldown && !brick.overlaps(ball)) continue;  // already separated, skip
        var prevBX = ball.x - ball.vx, prevBY = ball.y - ball.vy;
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

        if (window.spawnBrickShards) spawnBrickShards(this.sparks, brick, ball);
        // Play brick note if configured, otherwise normal impact sound
        if (brick._noteConfig && window.BrickNote) {
          var nc3 = brick._noteConfig;
          window.BrickNote.playNote(nc3.note||'C', nc3.octave||4, nc3.timbre||'marimba', nc3.vol !== undefined ? nc3.vol : 0.6);
        } else if (window.Sound) {
          Sound.brickShatter(dmg * 0.01);
        }

        if (ball.type === BALL_TYPES.STICKY) {
          this._checkStickyWall(ball);
          // Store brick surface normal if it just stuck
          if (ball.stuckTo === '_wall_') {
            ball._stickNx = bnx;
            ball._stickNy = bny;
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
      else if (obj.x + obj.r >= this.W - 2)  { nx = -1; ny =  0; } // right wall → launch left
      else if (obj.y - obj.r <= 2)            { nx =  0; ny =  1; } // ceiling → launch down
      else                                    { nx =  0; ny = -1; } // default → launch up
      obj._stickNx = nx;
      obj._stickNy = ny;
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
    var TOP_Y    = 200;   // lowered — PULL/PUSH moved to corner
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
    for (var i = this.objects.length - 1; i >= 0; i--) {
      var obj = this.objects[i];
      if (obj.dead) continue;
      if (Math.hypot(px - obj.x, py - obj.y) < obj.r + 10) {
        this.objects.splice(i, 1);
        this.ui.attachObjects(this.objects);
        Physics.spawnSparks(this.sparks, obj.x, obj.y, '#ff4444', 18);
        if (window.Sound) Sound.thud(10);
        // Stay in delete mode — don't auto-exit
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

    // ── TRAPDOOR — pivot at bottom of DEL button, door swings CCW when ball exits
    // Compute pivot Y: DEL button is the 6th button (index 5) after btnStartY
    var _tdBtnH      = 30;
    var _tdBtnGap    = 4;
    var _tdCurveTop  = floorY - turnR;
    var _tdBtnBlockH = 5 * (_tdBtnH + _tdBtnGap) + _tdBtnH + 8;
    var _tdBtnStartY = _tdCurveTop - _tdBtnBlockH - 10;
    if (_tdBtnStartY < topY + 4) _tdBtnStartY = topY + 4;
    // DEL button bottom
    var _tdDelY  = _tdBtnStartY + 5 * (_tdBtnH + _tdBtnGap) + _tdBtnGap + _tdBtnH;
    var pivotY   = _tdDelY + 4;  // 4px gap below DEL button
    this._tdPivotY = pivotY;     // store for physics loop

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
    var capH   = 52;                 // taller to fit new layout
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
    var btnTypes  = ['bouncer','exploder','sticky','splitter','gravity'];
    var btnColors = ['#4488ff','#ff4400','#44ff44','#ff44ff','#00ffee'];
    var btnH   = 30;
    var btnW   = CW - 6;
    var btnX   = leftX + 3;
    var curveTop  = floorY - turnR;
    // DEL button goes right below the cap
    var delBtnY   = topY + 4;
    var btnGap    = 12;
    // Ball buttons: bottom of GRV (last ball button) should align with trapdoor pivot
    // pivotY = this._tdPivotY (set each frame during trapdoor draw)
    var pivotRef  = this._tdPivotY || (floorY - 60);
    // 5 buttons of height btnH + 4px gap, starting at btnStartY, ending at btnStartY + 5*(btnH+4)
    // We want btnStartY + 5*(btnH+4) = pivotRef, so:
    var btnStartY = pivotRef - 5 * (btnH + 4);
    // Clamp: DEL button must come before ball buttons
    if (btnStartY < delBtnY + btnH + btnGap) btnStartY = delBtnY + btnH + btnGap;

    this._chuteButtonRects = [];
    var onField = this.objects.filter(function(o) { return !o.dead; }).length
                + (this._chuteActive ? this._chuteActive.length : 0)
                + (this._chuteQueue  ? this._chuteQueue.length  : 0);
    var atMax = onField >= 15;

    this._chuteAimRect = null;  // aim button moved to corner

    for (var bi = 0; bi < btnTypes.length; bi++) {
      var by    = btnStartY + bi * (btnH + 4);
      var btype = btnTypes[bi];
      var bcol  = btnColors[bi];
      var alpha = atMax ? 0.28 : 1.0;
      var pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.055 + bi * 1.3);
      var pressFlash = this._btnPressFlash && this._btnPressFlash.type === btype
        ? Math.max(0, 1 - (this.frame - this._btnPressFlash.frame) / 12) : 0;

      this._chuteButtonRects.push({ x: btnX, y: by, w: btnW, h: btnH, type: btype });

      // Parse hex color to rgb for gradients
      var r = parseInt(bcol.slice(1,3),16);
      var g = parseInt(bcol.slice(3,5),16);
      var b = parseInt(bcol.slice(5,7),16);

      // ── Background: 25% opacity with tube-wrap horizontal gradient ──────────
      // Tube-wrap: dark edges, brighter centre (simulates cylindrical depth)
      ctx.beginPath(); ctx.roundRect(btnX, by, btnW, btnH, 8);
      // Press flash: slightly inset + brighter on recent tap
      var bxOff = pressFlash > 0 ? 1 : 0;
      var bgGrad = ctx.createLinearGradient(btnX, by, btnX + btnW, by);
      bgGrad.addColorStop(0,    'rgba(0,4,14,' + (alpha * (0.25 + pressFlash * 0.4)) + ')');
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
      ctx.beginPath(); ctx.roundRect(btnX, by, btnW, btnH, 8);
      var borderGrad = ctx.createLinearGradient(btnX, by, btnX, by + btnH);
      borderGrad.addColorStop(0,   'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.9) + ')');
      borderGrad.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.55) + ')');
      borderGrad.addColorStop(1,   'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.9) + ')');
      ctx.strokeStyle = borderGrad;
      ctx.lineWidth   = 1.8;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // ── Top highlight bevel (makes it look raised) ─────────────────────────
      ctx.beginPath(); ctx.roundRect(btnX + 1.5, by + 1.5, btnW - 3, btnH * 0.45, [7,7,0,0]);
      var hiliteGrad = ctx.createLinearGradient(btnX, by, btnX, by + btnH * 0.45);
      hiliteGrad.addColorStop(0,   'rgba(255,255,255,' + (alpha * 0.12) + ')');
      hiliteGrad.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = hiliteGrad; ctx.fill();

      // ── Inner colour fill (gives body of the button colour depth) ──────────
      ctx.beginPath(); ctx.roundRect(btnX + 2, by + 2, btnW - 4, btnH - 4, 6);
      var fillGrad = ctx.createLinearGradient(btnX, by, btnX + btnW, by + btnH);
      fillGrad.addColorStop(0,   'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.08) + ')');
      fillGrad.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.14) + ')');
      fillGrad.addColorStop(1,   'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.05) + ')');
      ctx.fillStyle = fillGrad; ctx.fill();

      // ── Ball orb ──────────────────────────────────────────────────────────
      var dotR = 8, dotX = btnX + dotR + 5, dotY = by + btnH / 2;

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

      // ── Label ──────────────────────────────────────────────────────────────
      var labels = {bouncer:'BNC',exploder:'EXP',sticky:'STK',splitter:'SPL',gravity:'GRV'};
      var lblText = labels[btype] || btype.slice(0,3).toUpperCase();

      // Label shadow for depth
      ctx.fillStyle = 'rgba(0,0,0,' + (alpha * 0.5) + ')';
      ctx.font = "bold 10px 'Share Tech Mono', monospace";
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(lblText, dotX + dotR + 5 + 1, dotY + 1);

      // Label main
      var lblGrad = ctx.createLinearGradient(0, by, 0, by + btnH);
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
    Physics.spawnSparks(this.sparks, this.target.x, this.target.y, '#ffffff', 30);
    this.ui.showWin('LEVEL COMPLETE!', bonus > 0 ? '+' + bonus + ' EFFICIENCY BONUS' : '');
    if (window.Sound) Sound.win();
    var self = this;
    setTimeout(function() { self.stop(); self.onBackToMenu(); }, 3200);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _draw() {
    var ctx = this.ctx, W = this.W, H = this.H, floorY = this.floorY();
    var vSY = this._viewScrollY || 0;
    ctx.fillStyle = '#030a18'; ctx.fillRect(0, 0, W, H);
    if (vSY !== 0) { ctx.save(); ctx.translate(0, vSY); }
    if (this.nebulaOffscreen) ctx.drawImage(this.nebulaOffscreen, 0, 0);
    this._drawGrid(); this._drawStars();

    for (var g = 0; g < this.objects.length; g++) {
      if (this.objects[g].type === BALL_TYPES.GRAVITY && this.objects[g].gravActive) this._drawGravityRange(this.objects[g]);
    }

    this._drawFloor(floorY);
    if (this._editorMode && window._showEditorGrid) { this._drawEditorGrid(floorY); }
    // Behind-layer tubes drawn first (under everything)
    this.tubes.draw(ctx, 'behind', this.frame, this._tubeSelected);
    // Chute balls drawn BEFORE buttons so they appear behind them
    if (this._chuteActive) { for (var ci=0;ci<this._chuteActive.length;ci++) this._drawBall(this._chuteActive[ci]); }
    this._drawChute();
    if (this.barrier) this.barrier.draw(ctx);
    if (this.target) this.target.draw(ctx);
    for (var i = 0; i < this.obstacles.length; i++) this.obstacles[i].draw(ctx, this.frame);
    // Main-layer tubes under bricks
    this.tubes.draw(ctx, 'main', this.frame, this._tubeSelected);
    for (var i = 0; i < this.buttons.length;    i++) this.buttons[i].draw(ctx);
    for (var i = 0; i < this.bricks.length; i++) {
      this.bricks[i].draw(ctx);
    }
    for (var i = 0; i < this.turnstiles.length; i++) this.turnstiles[i].draw(ctx);
    for (var i = 0; i < this.ports.length;      i++) this.ports[i].draw(ctx);
    for (var i = 0; i < this.spawners.length;   i++) this.spawners[i].draw(ctx);
    for (var j = 0; j < this.objects.length;   j++) this._drawBall(this.objects[j]);
    // Above-layer tubes on top of everything
    this.tubes.draw(ctx, 'above', this.frame, this._tubeSelected);
    if (this.sling) this._drawSling();
    this._drawSparks();
    if (this._editorMode) this._drawEditor();
    // Restore transform before fixed-position overlays
    if (vSY !== 0) ctx.restore();
    // CLR buttons always shown in top bar
    this._drawHudClearButtons();
    // Speed slider and corner buttons hidden when editor is open
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
    this._undoHistory.push(snap);
    if (this._undoHistory.length > 50) this._undoHistory.shift();
    this._redoHistory = [];
  }

  _undoApply(snap) {
    // Restore brick list to snapshot
    this.bricks = snap.map(function(s) {
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
  }

  toggleEditor() {
    this._editorMode = !this._editorMode;
    if (this._editorMode) {
      this._editorBrickType   = 'breakable_brick';
      this._editorDragging    = null;
      this._editorSelected    = null;
      if (!this._undoHistory) { this._undoHistory = []; this._redoHistory = []; }
      if (this._editorTranslate === undefined) this._editorTranslate = false;
      if (window.Sound && Sound.editorOpen) Sound.editorOpen();  // default ⊕ROT
    } else {
      this._editorNotePopup = false;
      this._viewScrollY = 0;
      this._tubeSelected = null;   // clear so bounding box doesn't persist
      this._tubeDragging = null;
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
      this._editorSelected = b;
      this._editorDragOffX = pos.x - b.x;
      this._editorDragOffY = pos.y - b.y;
      this._editorDragging = b;
      this._editorMovable  = b._movable || false;
      this._showBrickSettings = true;
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
    var vSY  = this._viewScrollY || 0;
    var t0 = touches[0], t1 = touches[1];
    var p0 = { x: t0.clientX - rect.left, y: t0.clientY - rect.top - vSY };
    var p1 = { x: t1.clientX - rect.left, y: t1.clientY - rect.top - vSY };
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
    var vSY  = this._viewScrollY || 0;
    var t0 = touches[0], t1 = touches[1];
    var p0 = { x: t0.clientX - rect.left, y: t0.clientY - rect.top - vSY };
    var p1 = { x: t1.clientX - rect.left, y: t1.clientY - rect.top - vSY };
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
    var ANCHOR = 6;

    // New angle and length from finger positions
    var newAngle = Math.atan2(p1.y-p0.y, p1.x-p0.x);
    var snapDeg = this._editorSnapDeg || 0;
    if (snapDeg > 0) { var sr = snapDeg*Math.PI/180; newAngle = Math.round(newAngle/sr)*sr; }
    td.rotation = newAngle;

    if (td.type === 'straight') {
      td.length = Math.max(20, Math.min(600, Math.hypot(p1.x-p0.x, p1.y-p0.y)));
    }

    if (d0 < ANCHOR) {
      // Finger 0 anchors at p0 — that end stays
      td.x = p0.x + Math.cos(newAngle) * td.length / 2;
      td.y = p0.y + Math.sin(newAngle) * td.length / 2;
    } else if (d1 < ANCHOR) {
      td.x = p1.x - Math.cos(newAngle) * td.length / 2;
      td.y = p1.y - Math.sin(newAngle) * td.length / 2;
    } else {
      td.x = (p0.x + p1.x) / 2;
      td.y = (p0.y + p1.y) / 2;
    }
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
    if (!this._editorDragging) return;
    var nx = pos.x - (this._editorDragOffX || 0);
    var ny = pos.y - (this._editorDragOffY || 0) - (this._viewScrollY || 0);
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
    if (this._editorDragging || this._editorDragSlider) this._undoPush();
    this._editorDragging    = null;
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

  _drawEditor() {
    var ctx = this.ctx, W = this.W, H = this.H;
    var floorY = this.floorY();

    // Panel sits BELOW the floor line — play area fully visible above it
    // Editor panel is fixed — tabs start flush with the floor line
    var panelY = floorY;
    this._editorPanelRect = { y: floorY };  // taps below this line go to panel

    ctx.save();
    ctx.fillStyle = 'rgba(0,8,22,0.97)';
    ctx.fillRect(0, floorY, W, H - floorY + 400);  // extend down for scroll content
    ctx.strokeStyle = 'rgba(0,200,255,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, floorY + 1); ctx.lineTo(W, floorY + 1); ctx.stroke();

    // ── Quick-clear row above tabs ─────────────────────────────────────────
    var qcH = 20, qcY = panelY + 2;
    var qcW = Math.floor((W - 16) / 3);
    var qcLabels = ['CLR BRICKS','CLR BALLS','CLR TUBES'];
    var qcColors = ['#ff6600','#ff4466','#00ffaa'];
    this._editorQuickClearBtns = [];
    for (var qci = 0; qci < 3; qci++) {
      var qcx = 8 + qci * (qcW + 2);
      ctx.fillStyle = 'rgba(20,5,0,0.75)';
      ctx.beginPath(); ctx.roundRect(qcx, qcY, qcW, qcH, 3); ctx.fill();
      ctx.strokeStyle = qcColors[qci] + '99'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(qcx, qcY, qcW, qcH, 3); ctx.stroke();
      ctx.fillStyle = qcColors[qci]; ctx.font = "bold 6px 'Share Tech Mono',monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(qcLabels[qci], qcx + qcW/2, qcY + qcH/2);
      this._editorQuickClearBtns.push({ x:qcx, y:qcY, w:qcW, h:qcH, type:qci });
    }
    // Tab row: BRICKS | TUBES
    var tabW = 80, tabH = 22, tabY = panelY + 26 + 2;  // below quick-clear row
    var isBrickTab = !this._editorTubeMode;
    // Bricks tab
    ctx.fillStyle = isBrickTab ? 'rgba(0,180,255,0.25)' : 'rgba(0,10,30,0.5)';
    ctx.beginPath(); ctx.roundRect(8, tabY, tabW, tabH, [4,4,0,0]); ctx.fill();
    ctx.strokeStyle = isBrickTab ? '#00ccff' : '#224466'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(8, tabY, tabW, tabH, [4,4,0,0]); ctx.stroke();
    ctx.fillStyle = isBrickTab ? '#00ffee' : '#446688';
    ctx.font = "bold 8px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🧱 BRICKS', 8 + tabW/2, tabY + tabH/2);
    this._editorBrickTab = { x:8, y:tabY, w:tabW, h:tabH };
    // Tubes tab
    ctx.fillStyle = !isBrickTab ? 'rgba(0,200,120,0.25)' : 'rgba(0,10,30,0.5)';
    ctx.beginPath(); ctx.roundRect(8 + tabW + 4, tabY, tabW, tabH, [4,4,0,0]); ctx.fill();
    ctx.strokeStyle = !isBrickTab ? '#00ff88' : '#224466'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(8 + tabW + 4, tabY, tabW, tabH, [4,4,0,0]); ctx.stroke();
    ctx.fillStyle = !isBrickTab ? '#00ff88' : '#446688';
    ctx.fillText('🔧 TUBES', 8 + tabW + 4 + tabW/2, tabY + tabH/2);
    this._editorTubeTab = { x:8+tabW+4, y:tabY, w:tabW, h:tabH };

    // Branch to tube editor content if in tube mode
    if (this._editorTubeMode) {
      this._drawTubeEditor(ctx, panelY + 26 + 2 + tabH + 2);  // below qcRow + tabs
      ctx.restore();
      return;
    }

    var qcRowH = 26;  // quick-clear row height + gap
    var btnH = 26, btnY = panelY + qcRowH + tabH + 4, startX = 8;
    var isSelect = this._editorSelectMode || false;

    // ── ROW 1 — left side: mode + build options, right side: CLR ALL + DONE ──────
    // Right-anchored buttons first so we know available space
    var doneX = W - 60;
    this._editorDoneBtn = { x: doneX, y: btnY, w: 56, h: btnH };
    ctx.fillStyle = 'rgba(0,60,30,0.85)'; ctx.beginPath(); ctx.roundRect(doneX, btnY, 56, btnH, 4); ctx.fill();
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(doneX, btnY, 56, btnH, 4); ctx.stroke();
    ctx.fillStyle = '#00ff88'; ctx.font = "bold 8px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DONE', doneX + 28, btnY + btnH/2);

    var clearX = doneX - 56;
    this._editorClearBtn = { x: clearX, y: btnY, w: 52, h: btnH };
    ctx.fillStyle = 'rgba(80,20,0,0.8)'; ctx.beginPath(); ctx.roundRect(clearX, btnY, 52, btnH, 4); ctx.fill();
    ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(clearX, btnY, 52, btnH, 4); ctx.stroke();
    ctx.fillStyle = '#ff8844'; ctx.font = "bold 7px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CLR ALL', clearX + 26, btnY + btnH/2);

    // RESET DEF button
    var rstX = clearX - 54;
    this._editorResetDefBtn = { x: rstX, y: btnY, w: 50, h: btnH };
    ctx.fillStyle = 'rgba(0,20,60,0.8)'; ctx.beginPath(); ctx.roundRect(rstX, btnY, 50, btnH, 4); ctx.fill();
    ctx.strokeStyle = '#4488cc'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(rstX, btnY, 50, btnH, 4); ctx.stroke();
    ctx.fillStyle = '#88bbff'; ctx.font = "bold 6px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('RST DEF', rstX + 25, btnY + btnH/2);
    // UNDO button
    var undoX = rstX - 36;
    var canUndo = this._undoHistory && this._undoHistory.length > 0;
    this._editorUndoBtn = { x: undoX, y: btnY, w: 32, h: btnH };
    ctx.fillStyle = canUndo ? 'rgba(0,40,80,0.85)' : 'rgba(0,10,20,0.5)';
    ctx.beginPath(); ctx.roundRect(undoX, btnY, 32, btnH, 4); ctx.fill();
    ctx.strokeStyle = canUndo ? '#0088ff' : '#223344'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(undoX, btnY, 32, btnH, 4); ctx.stroke();
    ctx.fillStyle = canUndo ? '#44aaff' : '#334455';
    ctx.fillText('↩', undoX + 16, btnY + btnH/2);
    // REDO button
    var redoX = undoX - 36;
    var canRedo = this._redoHistory && this._redoHistory.length > 0;
    this._editorRedoBtn = { x: redoX, y: btnY, w: 32, h: btnH };
    ctx.fillStyle = canRedo ? 'rgba(0,40,80,0.85)' : 'rgba(0,10,20,0.5)';
    ctx.beginPath(); ctx.roundRect(redoX, btnY, 32, btnH, 4); ctx.fill();
    ctx.strokeStyle = canRedo ? '#0088ff' : '#223344'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(redoX, btnY, 32, btnH, 4); ctx.stroke();
    ctx.fillStyle = canRedo ? '#44aaff' : '#334455';
    ctx.fillText('↪', redoX + 16, btnY + btnH/2);

    // Left side: SELECT/BUILD + type-specific
    var modeW = 52;
    this._editorModeBtn = { x: startX, y: btnY, w: modeW, h: btnH };
    ctx.fillStyle = isSelect ? 'rgba(255,180,0,0.22)' : 'rgba(0,50,100,0.50)';
    ctx.beginPath(); ctx.roundRect(startX, btnY, modeW, btnH, 4); ctx.fill();
    ctx.strokeStyle = isSelect ? '#ffcc00' : '#00aaff'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.roundRect(startX, btnY, modeW, btnH, 4); ctx.stroke();
    ctx.fillStyle = isSelect ? '#ffcc00' : '#00ccff';
    ctx.font = "bold 8px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(isSelect ? '✦ SEL' : '+ BLD', startX + modeW/2, btnY + btnH/2);

    var curX = startX + modeW + 4;
    this._editorTypeBtns = [];

    if (!isSelect) {
      var bTypes  = ['breakable_brick','circular_brick'];
      var bLabels = ['BRICK','ROUND'];
      var bColors = ['#4488ff','#44ff88'];
      var tW = 44;
      for (var ti = 0; ti < bTypes.length; ti++) {
        if (curX + tW > clearX - 8) break;  // prevent overflow into right buttons
        var active = this._editorBrickType === bTypes[ti];
        ctx.fillStyle = active ? bColors[ti] + '44' : 'rgba(0,15,40,0.8)';
        ctx.beginPath(); ctx.roundRect(curX, btnY, tW, btnH, 4); ctx.fill();
        ctx.strokeStyle = active ? bColors[ti] : bColors[ti] + '55'; ctx.lineWidth = active ? 1.8 : 1;
        ctx.beginPath(); ctx.roundRect(curX, btnY, tW, btnH, 4); ctx.stroke();
        ctx.fillStyle = active ? bColors[ti] : bColors[ti] + 'aa';
        ctx.font = "bold 8px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(bLabels[ti], curX + tW/2, btnY + btnH/2);
        this._editorTypeBtns.push({ x: curX, y: btnY, w: tW, h: btnH, type: bTypes[ti] });
        curX += tW + 4;
      }
      // Snap moved to row 2 — still set to null here so the tap handler in row 1 can't fire
      this._editorSnapBtn = null;
      // MOV
      var movW2 = 40, isMovable = this._editorMovable || false;
      if (curX + movW2 < clearX - 8) {
        this._editorMovBtn = { x: curX, y: btnY, w: movW2, h: btnH };
        ctx.fillStyle = isMovable ? 'rgba(255,150,0,0.22)' : 'rgba(0,15,40,0.8)';
        ctx.beginPath(); ctx.roundRect(curX, btnY, movW2, btnH, 4); ctx.fill();
        ctx.strokeStyle = isMovable ? '#ffaa00' : '#666688'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(curX, btnY, movW2, btnH, 4); ctx.stroke();
        ctx.fillStyle = isMovable ? '#ffaa00' : '#668899';
        ctx.font = "bold 7px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(isMovable ? '●MOV' : '■STA', curX + movW2/2, btnY + btnH/2);
        curX += movW2 + 4;
      } else { this._editorMovBtn = null; }
    } else {
      this._editorSnapBtn = null; this._editorMovBtn = null;
    }

    // DEL — always shown after other buttons, before CLR ALL
    var delW2 = 36;
    if (curX + delW2 < clearX - 4) {
      this._editorDelBtn = { x: curX, y: btnY, w: delW2, h: btnH };
      ctx.fillStyle = this._editorSelected ? 'rgba(120,0,0,0.7)' : 'rgba(40,0,0,0.5)';
      ctx.beginPath(); ctx.roundRect(curX, btnY, delW2, btnH, 4); ctx.fill();
      ctx.strokeStyle = this._editorSelected ? '#ff4444' : '#882222'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(curX, btnY, delW2, btnH, 4); ctx.stroke();
      ctx.fillStyle = this._editorSelected ? '#ff6666' : '#884444';
      ctx.font = "bold 8px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('DEL', curX + delW2/2, btnY + btnH/2);
    }
    // Row 2+3: Sliders for HP (with ∞), REGEN, DENS, DIST
    // Rows sit below the button row. Two sliders per row, each half screen width.
    var sliderRowH = 22;
    var row2Y = btnY + btnH + 10;
    var row3Y = row2Y + sliderRowH + 6;
    var bd2   = window.BrickDefaults || {};
    var sb2   = this._editorSelected;
    var movActive2 = sb2 ? (sb2._movable || false) : (this._editorMovable || false);

    var halfW  = Math.floor((W - 16) / 2);
    var lblW   = 34;   // label area
    var infW   = 26;   // ∞ button on HP slider — bigger so it's tappable
    var padding = 8;

    // Helper to draw a labeled slider on canvas
    // Returns the rect stored for interaction
    var drawSlider = function(label, valRaw, min, max, isInf, infActive, grayed, sx, sy, sw) {
      var lx = sx, ly = sy;
      var slW = sw - lblW - (isInf ? infW + 3 : 0) - 2;
      var slX = sx + lblW;
      var slY = sy + sliderRowH / 2;
      var alpha = grayed ? 0.30 : 1.0;

      // Label
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#88aacc'; ctx.font = "bold 8px 'Share Tech Mono',monospace";
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + 2, slY);

      // Track background
      ctx.fillStyle = grayed ? 'rgba(30,40,60,0.5)' : 'rgba(0,20,50,0.8)';
      ctx.beginPath(); ctx.roundRect(slX, sy + 7, slW, 8, 4); ctx.fill();
      ctx.strokeStyle = grayed ? '#334455' : 'rgba(0,150,255,0.4)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.roundRect(slX, sy + 7, slW, 8, 4); ctx.stroke();

      // Fill (progress)
      var t = isInf && infActive ? 1.0 : Math.max(0, Math.min(1, (valRaw - min) / (max - min)));
      if (!grayed) {
        var fillColor = infActive ? '#ff8800' : '#0088ff';
        ctx.fillStyle = fillColor + (grayed ? '44' : 'cc');
        ctx.beginPath(); ctx.roundRect(slX, sy + 7, slW * t, 8, 4); ctx.fill();
      }

      // Thumb
      var thumbX = slX + slW * t;
      ctx.beginPath(); ctx.arc(thumbX, slY, 6, 0, Math.PI * 2);
      ctx.fillStyle = grayed ? '#334455' : (infActive ? '#ffaa22' : '#00aaff');
      ctx.shadowColor = grayed ? 'transparent' : (infActive ? '#ff8800' : '#0088ff');
      ctx.shadowBlur  = grayed ? 0 : 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Value text right of thumb — clean formatting, max 2dp
      var valText;
      if (isInf && infActive) {
        valText = '∞';
      } else if (label === 'REGEN') {
        valText = valRaw ? (valRaw/1000).toFixed(1)+'s' : 'OFF';
      } else if (label === 'ROT') {
        valText = Math.round(valRaw) + '°';
      } else if (label === 'HP' || label === 'DIST' || label === 'LEN' || label === 'WID') {
        valText = Math.round(valRaw) + (label === 'DIST' || label === 'LEN' || label === 'WID' ? 'px' : '');
      } else if (label === 'DENS') {
        valText = parseFloat(valRaw).toFixed(1);
      } else if (label === 'STOP' || label === 'RSTOP' || label === 'RSPIN' || label === 'DECEL') {
        valText = parseFloat(valRaw).toFixed(2);
      } else {
        var numVal = parseFloat(valRaw);
        valText = isNaN(numVal) ? String(valRaw) : (Number.isInteger(numVal) ? String(numVal) : numVal.toFixed(2));
      }
      ctx.fillStyle = grayed ? '#445566' : '#ccddff';
      ctx.font = "7px 'Share Tech Mono',monospace";
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(valText, thumbX + 8, slY);

      // ∞/✕ button — ∞ for HP (invincible), red ✕ for REGEN (no-regen)
      var infRect = null;
      if (isInf) {
        var ix = slX + slW + 6;
        var iH = sliderRowH - 2;
        var isNoRegen = (label === 'REGEN');
        if (isNoRegen) {
          ctx.fillStyle = infActive ? 'rgba(200,20,20,0.50)' : 'rgba(0,15,40,0.85)';
        } else {
          ctx.fillStyle = infActive ? 'rgba(255,140,0,0.45)' : 'rgba(0,15,40,0.85)';
        }
        ctx.beginPath(); ctx.roundRect(ix, sy + 1, infW, iH, 4); ctx.fill();
        ctx.strokeStyle = isNoRegen ? (infActive ? '#ff4444' : '#884444') : (infActive ? '#ffaa00' : '#4477aa'); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(ix, sy + 1, infW, iH, 4); ctx.stroke();
        ctx.fillStyle = isNoRegen ? (infActive ? '#ff8888' : '#aa5555') : (infActive ? '#ffdd44' : '#7799bb');
        ctx.font = "bold " + (isNoRegen ? "11" : "12") + "px 'Share Tech Mono',monospace";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(isNoRegen ? '✕' : '∞', ix + infW/2, sy + sliderRowH/2);
        infRect = { x: ix, y: sy, w: infW, h: sliderRowH };
      }

      ctx.globalAlpha = 1.0;
      return {
        x: slX, y: sy, w: slW, h: sliderRowH,
        trackX: slX, trackW: slW, min: min, max: max,
        infRect: infRect,
      };
    };

    // ── Values from selected brick or defaults ────────────────────────────────
    var HPval    = (sb2 && sb2.maxHealth   !== undefined) ? sb2.maxHealth   : (bd2.rectHP    || 100);
    var REGval   = (sb2 && sb2.regenAfter  !== undefined) ? sb2.regenAfter  : (bd2.rectRegen || 2000);
    var DENSval  = (sb2 && sb2._density    !== undefined) ? sb2._density    : (bd2.density   || 1.0);
    var DISTval  = (sb2 && sb2._maxTravel  !== undefined) ? sb2._maxTravel  : (bd2.maxTravel || 60);
    var DECELval = (sb2 && sb2._decel      !== undefined) ? sb2._decel      : (bd2.decel     || 0.88);
    var ROTSPDval= (sb2 && sb2._rotSpeed   !== undefined) ? sb2._rotSpeed   : (bd2.rotSpeed  || 0.3);
    var ROTDECval= (sb2 && sb2._rotDecel   !== undefined) ? sb2._rotDecel   : (bd2.rotDecel  || 0.88);
    var HPinf    = (sb2 && sb2._invincible) || false;
    var noRegen  = (sb2 && sb2._noRegen)    || false;
    var LENval   = sb2 ? (sb2.w || sb2.r * 2 || 70) : (bd2.rectW || 70);
    var WIDval   = sb2 ? (sb2.h || sb2.r * 2 || 22) : (bd2.rectH || 22);
    var ROTval   = sb2 ? ((sb2._rotation || 0) * 180 / Math.PI) : 0;
    // Normalise rotation to [-180, 180]
    while (ROTval >  180) ROTval -= 360;
    while (ROTval < -180) ROTval += 360;

    var transOn3 = sb2 ? (sb2._translateOnRotate !== false) : (this._editorTranslate !== false);

    // ── ROW 2: MOV | ↔ROT | PIVOT 3×3 | 🎵 | GRID | SNAP-GRID ─────────────
    var row2Y = btnY + btnH + 8;
    var rH2   = 22;

    // MOV
    var movInX = padding, movW3 = 46;
    this._editorMovInlineRect = { x: movInX, y: row2Y, w: movW3, h: rH2 };
    ctx.fillStyle = movActive2 ? 'rgba(255,140,0,0.25)' : 'rgba(0,15,40,0.8)';
    ctx.beginPath(); ctx.roundRect(movInX, row2Y, movW3, rH2, 3); ctx.fill();
    ctx.strokeStyle = movActive2 ? '#ffaa00' : '#446688'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(movInX, row2Y, movW3, rH2, 3); ctx.stroke();
    ctx.fillStyle = movActive2 ? '#ffcc44' : '#668899';
    ctx.font = "bold 7px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(movActive2 ? '● MOV' : '■ STAT', movInX + movW3/2, row2Y + rH2/2);

    // ↔ROT
    var transX3 = movInX + movW3 + 4;
    this._editorTransRect = { x: transX3, y: row2Y, w: 40, h: rH2 };
    ctx.fillStyle = transOn3 ? 'rgba(0,200,100,0.20)' : 'rgba(0,10,30,0.6)';
    ctx.beginPath(); ctx.roundRect(transX3, row2Y, 40, rH2, 3); ctx.fill();
    ctx.strokeStyle = transOn3 ? '#00ff88' : '#334455'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(transX3, row2Y, 40, rH2, 3); ctx.stroke();
    ctx.fillStyle = transOn3 ? '#00ff88' : '#445566';
    ctx.font = "bold 7px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(transOn3 ? '↔ROT' : '⊕ROT', transX3 + 20, row2Y + rH2/2);

    // PIVOT 3×3 grid (col=L/C/R, row=TOP/MID/BOT)
    var pivX3 = transX3 + 44;
    var pivCols = ['L','C','R'], pivRows = ['T','M','B'];
    var pivColors3 = ['#ffcc44','#44ccff','#ff8844'];
    var curPiv3 = sb2 ? (sb2._pivot || 'CM') : (this._editorPivot || 'CM');
    var pivEnabled = transOn3;
    this._editorPivotRects = [];
    var pW9 = 18, pG9 = 2;
    for (var pc = 0; pc < 3; pc++) {
      for (var pr = 0; pr < 3; pr++) {
        var pivKey = pivCols[pc] + pivRows[pr];
        var px9 = pivX3 + pc * (pW9 + pG9);
        var py9 = row2Y + pr * (pW9 * 0.55 + pG9);
        var pAct9 = pivEnabled && curPiv3 === pivKey;
        ctx.globalAlpha = pivEnabled ? 1.0 : 0.28;
        ctx.fillStyle = pAct9 ? pivColors3[pc] + '44' : 'rgba(0,10,30,0.6)';
        ctx.beginPath(); ctx.roundRect(px9, py9, pW9, pW9 * 0.55, 2); ctx.fill();
        ctx.strokeStyle = pAct9 ? pivColors3[pc] : '#334455'; ctx.lineWidth = pAct9 ? 1.5 : 0.6;
        ctx.beginPath(); ctx.roundRect(px9, py9, pW9, pW9 * 0.55, 2); ctx.stroke();
        // Center dot if active
        if (pAct9) {
          ctx.fillStyle = pivColors3[pc];
          ctx.beginPath(); ctx.arc(px9 + pW9/2, py9 + pW9*0.275, 2, 0, Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        this._editorPivotRects.push({ x: px9, y: py9, w: pW9, h: pW9*0.55, val: pivKey, enabled: pivEnabled });
      }
    }

    // 🎵 Note button
    var noteX = pivX3 + 3 * (pW9 + pG9) + 6;
    var noteOn = sb2 && sb2._noteConfig;
    this._editorNoteBtn = { x: noteX, y: row2Y, w: 26, h: rH2 };
    ctx.fillStyle = noteOn ? 'rgba(180,50,255,0.30)' : 'rgba(0,10,30,0.6)';
    ctx.beginPath(); ctx.roundRect(noteX, row2Y, 26, rH2, 3); ctx.fill();
    ctx.strokeStyle = noteOn ? '#cc44ff' : '#334466'; ctx.lineWidth = noteOn ? 1.5 : 0.8;
    ctx.beginPath(); ctx.roundRect(noteX, row2Y, 26, rH2, 3); ctx.stroke();
    ctx.fillStyle = noteOn ? '#dd88ff' : '#557788';
    ctx.font = "10px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🎵', noteX + 13, row2Y + rH2/2);
    if (noteOn) {
      var nc = sb2._noteConfig;
      ctx.fillStyle = '#dd88ff'; ctx.font = "5px 'Share Tech Mono',monospace";
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText((nc.note||'C')+(nc.octave||4), noteX+1, row2Y+1);
    }

    // GRID toggle
    var gridX = noteX + 30;
    var gridOn = window._showEditorGrid || false;
    this._editorGridBtn = { x: gridX, y: row2Y, w: 32, h: rH2 };
    ctx.fillStyle = gridOn ? 'rgba(0,180,100,0.20)' : 'rgba(0,10,30,0.6)';
    ctx.beginPath(); ctx.roundRect(gridX, row2Y, 32, rH2, 3); ctx.fill();
    ctx.strokeStyle = gridOn ? '#00cc66' : '#334455'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(gridX, row2Y, 32, rH2, 3); ctx.stroke();
    ctx.fillStyle = gridOn ? '#00ff88' : '#446655';
    ctx.font = "bold 7px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GRID', gridX + 16, row2Y + rH2/2);

    // SNAP-GRID toggle
    var snapGX = gridX + 36;
    var snapGOn = window._snapToGrid || false;
    this._editorSnapGridBtn = { x: snapGX, y: row2Y, w: 34, h: rH2 };
    ctx.fillStyle = snapGOn ? 'rgba(0,150,255,0.20)' : 'rgba(0,10,30,0.6)';
    ctx.beginPath(); ctx.roundRect(snapGX, row2Y, 34, rH2, 3); ctx.fill();
    ctx.strokeStyle = snapGOn ? '#00aaff' : '#334455'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(snapGX, row2Y, 34, rH2, 3); ctx.stroke();
    ctx.fillStyle = snapGOn ? '#44ccff' : '#445566';
    ctx.font = "bold 6px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SNAP', snapGX + 17, row2Y + rH2/2 - 3);
    ctx.fillText('GRID', snapGX + 17, row2Y + rH2/2 + 4);

    // ROT SNAP button (always visible, row 2, after SNAP-GRID)
    var rotSnapX = snapGX + 38;
    var snaps3 = [0, 15, 30, 45]; var sLabels3 = ['ROT:FREE','ROT:15°','ROT:30°','ROT:45°'];
    var sIdx3 = snaps3.indexOf(this._editorSnapDeg || 0);
    var rotSnapW = 52;
    this._editorSnapBtn = { x: rotSnapX, y: row2Y, w: rotSnapW, h: rH2 };
    ctx.fillStyle = (this._editorSnapDeg||0) > 0 ? 'rgba(255,170,0,0.20)' : 'rgba(0,10,30,0.6)';
    ctx.beginPath(); ctx.roundRect(rotSnapX, row2Y, rotSnapW, rH2, 3); ctx.fill();
    ctx.strokeStyle = (this._editorSnapDeg||0) > 0 ? '#ffaa00' : '#334455'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(rotSnapX, row2Y, rotSnapW, rH2, 3); ctx.stroke();
    ctx.fillStyle = (this._editorSnapDeg||0) > 0 ? '#ffcc44' : '#556677';
    ctx.font = "bold 6px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(sLabels3[sIdx3], rotSnapX + rotSnapW/2, row2Y + rH2/2);

    // Grid size value display (tap to edit) — beside SNAP-GRID
    var gSizeX = rotSnapX + rotSnapW + 4;
    var gSizeW = 36;
    var gSizeVal = window._gridSize || 20;
    this._editorGridSizeBtn = { x: gSizeX, y: row2Y, w: gSizeW, h: rH2 };
    ctx.fillStyle = 'rgba(0,10,30,0.6)';
    ctx.beginPath(); ctx.roundRect(gSizeX, row2Y, gSizeW, rH2, 3); ctx.fill();
    ctx.strokeStyle = '#334466'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(gSizeX, row2Y, gSizeW, rH2, 3); ctx.stroke();
    ctx.fillStyle = '#88aabb'; ctx.font = "bold 6px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GR:' + gSizeVal, gSizeX + gSizeW/2, row2Y + rH2/2);

    // ── ROWS 3–7: sliders ────────────────────────────────────────────────────
    var sliderRowH = 22;
    var padding    = 8;
    var halfW      = Math.floor((W - 16) / 2);
    var thirdW     = Math.floor((W - 16) / 3);
    var halfW2     = Math.floor((W - 16) / 2);

    var row3Y = row2Y + rH2 + 7;
    var row4Y = row3Y + sliderRowH + 5;
    var row5Y = row4Y + sliderRowH + 5;
    var row6Y = row5Y + sliderRowH + 5;
    var row7Y = row6Y + sliderRowH + 5;

    this._editorSliders = {};
    // Row 3: HP | REGEN
    this._editorSliders.hp    = drawSlider('HP',    HPval,   10, 400, true,  HPinf,  false, padding,         row3Y, halfW);
    this._editorSliders.regen = drawSlider('REGEN', noRegen ? 0 : Math.max(200,REGval), 200, 10000, true, noRegen, false, padding + halfW, row3Y, halfW);
    // Row 4: DENS | DIST | STOP — grayed when STAT
    this._editorSliders.dens  = drawSlider('DENS',  DENSval,      0.5, 5.0,  false, false, !movActive2, padding,              row4Y, thirdW);
    this._editorSliders.dist  = drawSlider('DIST',  DISTval,      0,   900,  false, false, !movActive2, padding + thirdW,     row4Y, thirdW);
    this._editorSliders.decel = drawSlider('STOP',  1-DECELval,   0.01,0.5,  false, false, !movActive2, padding + thirdW * 2, row4Y, thirdW);
    // Row 5: RSPIN | RSTOP — grayed when STAT
    this._editorSliders.rotspd = drawSlider('RSPIN', ROTSPDval,    0.0, 1.0, false, false, !movActive2, padding,              row5Y, halfW2);
    this._editorSliders.rotdec = drawSlider('RSTOP', 1-ROTDECval,  0.05,0.95, false, false, !movActive2, padding + halfW2,     row5Y, halfW2);
    // Row 6: LENGTH | WIDTH
    this._editorSliders.blen  = drawSlider('LEN',   LENval,       5,   900,  false, false, false,       padding,              row6Y, halfW);
    this._editorSliders.bwid  = drawSlider('WID',   WIDval,       2,   200,  false, false, false,       padding + halfW,      row6Y, halfW);
    // Row 7: ROTATION — full width, -180 to +180
    var WBOUNCEval = (sb2 && sb2._wallBounce !== undefined) ? sb2._wallBounce : (bd2.wallBounce || 0.45);
    var rotW = Math.floor((W - 16) * 0.65);
    var wbW  = W - 16 - rotW - 4;
    this._editorSliders.rot     = drawSlider('ROT',    ROTval,      -180, 180,  false, false, false, padding,         row7Y, rotW);
    this._editorSliders.wbounce = drawSlider('BNCE',   WBOUNCEval,  0.0,  1.0,  false, false, false, padding + rotW + 4, row7Y, wbW);

    // ── Note picker popup ────────────────────────────────────────────────────
    if (this._editorNotePopup && sb2) {
      this._drawNotePopup(ctx, sb2);
    }


    // Highlight selected brick
    if (this._editorSelected) {
      var sb = this._editorSelected;
      ctx.strokeStyle = 'rgba(255,255,100,0.85)';
      ctx.lineWidth   = 2;
      ctx.setLineDash([4, 4]);
      ctx.save();
      if (sb._rotation) { ctx.translate(sb.x, sb.y); ctx.rotate(sb._rotation); ctx.translate(-sb.x, -sb.y); }
      if (sb instanceof CircularBrick) {
        ctx.beginPath(); ctx.arc(sb.x, sb.y, sb.r + 6, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.roundRect(sb.x - sb.w/2 - 5, sb.y - sb.h/2 - 5, sb.w + 10, sb.h + 10, 4); ctx.stroke();
      }
      ctx.restore();
      ctx.setLineDash([]);
    }
    ctx.restore();
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
      var now2 = performance.now();
      var dtap = now2 - (this._lastTubeTap || 0);
      this._lastTubeTap = now2;
      // Double-tap in select mode = disconnect
      if (dtap < 350 && this._tubeSelectMode && this._lastTubeTapId === hitTube.id) {
        this.tubes.disconnect(hitTube);
        this._lastTubeTap = 0;
        return;
      }
      this._lastTubeTapId = hitTube.id;
      this._tubeSelected = hitTube;
      this._tubeDragging = hitTube;
      this._tubeDragOffX = pos.x - hitTube.x;
      this._tubeDragOffY = pos.y - hitTube.y;
      return;
    }
    // Select mode: don't place new tubes
    if (this._tubeSelectMode) {
      this._tubeSelected = null;
      return;
    }
    // Build mode: place new tube
    var type  = this._tubeType  || 'straight';
    var style = this._tubeStyle || 'glass';
    var tube  = new TubePiece(type, pos.x, pos.y, this._tubeRotation || 0, {
      length: this._tubeLength || 80, style: style,
      speedMod: this._tubeSpeedMod || 1.0,
      radius: 14, layer: this._tubeLayer || 'main',
    });
    this.tubes.add(tube);
    this._tubeSelected = tube;
    this._tubeDragging = tube;
    this._tubeDragOffX = 0;
    this._tubeDragOffY = 0;
    if (window.Sound && Sound.uiTap) Sound.uiTap(0.18);
  }

  _drawTubeEditor(ctx, panelY) {
    var W = this.W;
    var padding = 8, btnH = 22, rH = 20, gap = 5;
    var row1Y = panelY + 6;

    // Tube type buttons
    var types = ['straight','elbow90','elbow45','elbow30','elbow15','uturn','funnel'];
    var labels = ['STR','90°','45°','30°','15°','U','FNL'];
    var tW = Math.floor((W - 16) / types.length) - 1;
    var tH = 28;  // taller for easier mobile tapping
    ctx.font = "bold 7px 'Share Tech Mono',monospace";
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

    // Style buttons
    var row2Y = row1BotY + gap;
    var styles = ['glass','window','solid','energy'];
    var sW = Math.floor((W - 16) / 4);
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

    // Sliders: LENGTH | SPEED MOD | ROTATION
    var row3Y = row2Y + rH + gap;
    var halfW = Math.floor((W - 16) / 2);
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
      return { x: sx + lblW, y: sy + 2, w: trW, h: rH - 4, trackX: sx+lblW, trackW: trW, min, max, label };
    };

    this._tubeSliderLen = drawTS('LEN', lenVal, 30, 300, padding, row3Y, halfW);
    this._tubeSliderSpd = drawTS('SPD', spdVal, 0.2, 3.0, padding + halfW, row3Y, halfW);
    var row4Y = row3Y + rH + gap;
    this._tubeSliderRot = drawTS('ROT', rotVal, -180, 180, padding, row4Y, W - 16);
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
    var lW = Math.floor((W - 16) / 3);
    this._tubeLayerBtns = [];
    for (var li = 0; li < layers.length; li++) {
      var lx = padding + li * (lW + 2);
      var lAct = (this._tubeLayer || 'main') === layers[li];
      ctx.fillStyle = lAct ? 'rgba(180,100,0,0.35)' : 'rgba(0,15,40,0.7)';
      ctx.beginPath(); ctx.roundRect(lx, row5Y, lW, rH, 3); ctx.fill();
      ctx.strokeStyle = lAct ? '#ffaa00' : '#224466'; ctx.lineWidth = lAct ? 1.5 : 0.8;
      ctx.beginPath(); ctx.roundRect(lx, row5Y, lW, rH, 3); ctx.stroke();
      ctx.fillStyle = lAct ? '#ffcc44' : '#557799';
      ctx.font = "bold 7px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(layers[li].toUpperCase(), lx + lW/2, row5Y + rH/2);
      this._tubeLayerBtns.push({ x:lx, y:row5Y, w:lW, h:rH, val:layers[li] });
    }

    // Selected tube info + delete
    if (this._tubeSelected) {
      var row6Y = row5Y + rH + gap;
      var t2 = this._tubeSelected;
      ctx.fillStyle = '#aaddff'; ctx.font = "7px 'Share Tech Mono',monospace";
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('SEL: ' + t2.type + ' | ' + t2.style + ' | ' + t2.layer + ' | spd:' + t2.speedMod.toFixed(1) + 'x', padding, row6Y + rH/2);
      // Delete selected
      var delTX = W - 60;
      this._tubeDelBtn = { x: delTX, y: row6Y, w: 52, h: rH };
      ctx.fillStyle = 'rgba(80,10,10,0.85)';
      ctx.beginPath(); ctx.roundRect(delTX, row6Y, 52, rH, 3); ctx.fill();
      ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(delTX, row6Y, 52, rH, 3); ctx.stroke();
      ctx.fillStyle = '#ff8888'; ctx.font = "bold 7px 'Share Tech Mono',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✕ DEL TUBE', delTX + 26, row6Y + rH/2);
    }

    // DONE button — always visible at bottom of tube panel
    var tubeDoneY = (this._tubeSelected ? row5Y + rH + gap + rH + gap : row5Y + rH + gap);
    this._editorDoneBtn = { x: W - 64, y: tubeDoneY, w: 56, h: btnH };
    ctx.fillStyle = 'rgba(0,60,30,0.85)';
    ctx.beginPath(); ctx.roundRect(W - 64, tubeDoneY, 56, btnH, 4); ctx.fill();
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(W - 64, tubeDoneY, 56, btnH, 4); ctx.stroke();
    ctx.fillStyle = '#00ff88'; ctx.font = "bold 8px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DONE', W - 64 + 28, tubeDoneY + btnH/2);

    // BUILD / SELECT mode toggle for tubes
    this._tubeSelectMode = this._tubeSelectMode || false;
    this._tubeModeBtn = { x: padding, y: tubeDoneY, w: 60, h: btnH };
    ctx.fillStyle = this._tubeSelectMode ? 'rgba(255,180,0,0.22)' : 'rgba(0,50,100,0.50)';
    ctx.beginPath(); ctx.roundRect(padding, tubeDoneY, 60, btnH, 4); ctx.fill();
    ctx.strokeStyle = this._tubeSelectMode ? '#ffcc00' : '#00aaff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(padding, tubeDoneY, 60, btnH, 4); ctx.stroke();
    ctx.fillStyle = this._tubeSelectMode ? '#ffcc00' : '#88bbff';
    ctx.fillText(this._tubeSelectMode ? 'SELECT' : 'BUILD', padding + 30, tubeDoneY + btnH/2);
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
    var closeX = popX + popW - 26, closeY = popY + 6;
    this._notePopupClose = { x: closeX, y: closeY, w: 20, h: 20 };
    ctx.fillStyle = 'rgba(100,0,100,0.5)';
    ctx.beginPath(); ctx.roundRect(closeX, closeY, 20, 20, 3); ctx.fill();
    ctx.fillStyle = '#ff88ff'; ctx.font = "bold 11px 'Share Tech Mono',monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✕', closeX + 10, closeY + 10);

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
      ctx.fillStyle = nActive ? '#ffffff' : (isBlack ? '#aabbdd' : '#7799cc');
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
  }

  _drawHudClearButtons() {
    // Three compact clear buttons in top-right area of HUD (below title bar)
    var ctx = this.ctx, W = this.W;
    var btnW = 56, btnH = 20, gap = 4;
    var totalW = 3 * btnW + 2 * gap;
    var startX = W - totalW - 8;
    var btnY2 = 44;  // below the title/back button row
    var labels = ['CLR ⧬','CLR ◎','CLR 空'];
    var labels2 = ['BRICKS','BALLS','TUBES'];
    var colors = ['#ff6600','#ff4466','#00ffaa'];
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
    var leftReserve  = 3 * 32 + 16;
    var rightReserve = 2 * 32 + 16;
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
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
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

    // ── Sling zone height slider (above brick slider) ─────────────────────────
    var zsy    = bsy - 28;
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
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(0,200,150,0.50)'; ctx.font = "bold 7px 'Share Tech Mono', monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('ZONE ' + zoneH3 + 'px', sx + sliderW / 2, zsy - 1);
    ctx.restore();
  }

  _drawCornerButtons() {
    var ctx = this.ctx, W = this.W, H = this.H;
    var btnW = 28, btnH = 28, gap = 4, margin = 6;
    var btmY = H - margin - btnH;

    // Bottom-left — two rows of toggle buttons
    // Row A (top): brick note display buttons
    var brickBtns = [
      { key: '_showBrickNote',      label: '♪',   default: true },
      { key: '_showBrickOctave',    label: '8va', default: true },
      { key: '_showBrickTimbre',    label: 'TIM', default: true },
    ];
    // Row B (bottom): ball display buttons
    var leftBtns = [
      { key: '_showVelocityArrows', label: '↗',   default: false },
      { key: '_showBallLabel',      label: 'Aa',  default: false },
      { key: '_showBallAbbr',       label: 'BNC', default: true  },
    ];
    var rowAY = btmY - btnH - gap;
    this._cornerBrickBtns = [];
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
