window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_FILE_VERSION['objects.js'] = 1552;
/**
 * objects.js
 * Game entity classes.  Each class knows how to draw itself and nothing else.
 * All physics / mutation is handled in physics.js.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function lightenHex(hex, amt) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(r + amt, 255)},${Math.min(g + amt, 255)},${Math.min(b + amt, 255)})`;
}

// ── PhysObj ───────────────────────────────────────────────────────────────────

class PhysObj {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} r        radius
   * @param {number} mass
   * @param {string} color    hex, e.g. '#1040a0'
   * @param {string} glowColor hex, e.g. '#4488ff'
   * @param {string} label    short text drawn on the ball
   */
  constructor(x, y, r, mass, color, glowColor, label) {
    this.x         = x;
    this.y         = y;
    this.r         = r;
    this.mass      = mass;
    this.color     = color;
    this.glowColor = glowColor;
    this.label     = label;

    this.vx       = 0;
    this.vy       = 0;
    this.dragging = false;
    this.grabbed  = false;   // true while pointer is actively holding
    this.pulse    = Math.random() * Math.PI * 2;
    this.trail    = [];      // { x, y, a }[]

    // drag internals — set by ui.js
    this.ox = 0;
    this.oy = 0;
  }

  draw(ctx) {
    // ── trail ──────────────────────────────────────────────────────
    for (let i = 0; i < this.trail.length; i++) {
      const t     = this.trail[i];
      const frac  = i / this.trail.length;
      const alpha = t.a * frac;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.r * 0.45 * frac, 0, Math.PI * 2);
      ctx.fillStyle = this.glowColor + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();
    }

    // ── outer glow ────────────────────────────────────────────────
    const glowR = this.r + (this.grabbed ? 10 : 4) + Math.sin(this.pulse) * 2;
    const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowR * 2.2);
    grd.addColorStop(0, this.glowColor + '55');
    grd.addColorStop(1, this.glowColor + '00');
    ctx.beginPath();
    ctx.arc(this.x, this.y, glowR * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // ── body ──────────────────────────────────────────────────────
    const bodyGrd = ctx.createRadialGradient(
      this.x - this.r * 0.3, this.y - this.r * 0.3, 0,
      this.x, this.y, this.r
    );
    bodyGrd.addColorStop(0, lightenHex(this.color, this.grabbed ? 120 : 75));
    bodyGrd.addColorStop(1, this.color);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrd;
    ctx.fill();

    // ── stroke ────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.strokeStyle   = this.glowColor;
    ctx.lineWidth     = this.grabbed ? 2.5 : 1.8;
    ctx.shadowColor   = this.glowColor;
    ctx.shadowBlur    = this.grabbed ? 22 : 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── drag ring (dashed) ────────────────────────────────────────
    if (this.grabbed) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,210,80,0.7)';
      ctx.lineWidth   = 2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── velocity arrow ────────────────────────────────────────────
    const speed = Math.hypot(this.vx, this.vy);
    if (!this.dragging && speed > 0.9 && !this.isSplitChild && window._showVelocityArrows !== false) {
      const scale = Math.min(speed * 3.5, 32);
      const nx  = this.vx / speed, ny = this.vy / speed;
      const tip = {
        x: this.x + nx * (this.r + scale),
        y: this.y + ny * (this.r + scale),
      };
      ctx.beginPath();
      ctx.moveTo(this.x + nx * this.r, this.y + ny * this.r);
      ctx.lineTo(tip.x, tip.y);
      ctx.strokeStyle = this.glowColor + 'bb';
      ctx.lineWidth   = 1.5;
      ctx.shadowBlur  = 0;
      ctx.stroke();
      // arrowhead
      const a = Math.atan2(ny, nx);
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x - Math.cos(a - 0.42) * 7, tip.y - Math.sin(a - 0.42) * 7);
      ctx.lineTo(tip.x - Math.cos(a + 0.42) * 7, tip.y - Math.sin(a + 0.42) * 7);
      ctx.closePath();
      ctx.fillStyle = this.glowColor + 'bb';
      ctx.fill();
    }

    // ── label ─────────────────────────────────────────────────────
    if (ctx._showAbbr !== false) {
      ctx.fillStyle     = '#ffffffbb';
      ctx.font          = "bold 8px 'Share Tech Mono', monospace";
      ctx.textAlign     = 'center';
      ctx.textBaseline  = 'middle';
      ctx.fillText(this.label, this.x, this.y);
    }
  }

  /** Returns true if point (px, py) is inside the pick radius. */
  hitTest(px, py) {
    return Math.hypot(px - this.x, py - this.y) < this.r + 7;
  }
}

// ── StaticObstacle ────────────────────────────────────────────────────────────

class StaticObstacle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'triangle'|'square'|'hexagon'} shape
   * @param {number} size   bounding half-size
   */
  constructor(x, y, shape, size) {
    this.x          = x;
    this.y          = y;
    this.shape      = shape;
    this.size       = size;
    this.hitRadius  = size * 1.15;   // circular approximation for physics
    this.phase      = Math.random() * Math.PI * 2;
  }

  draw(ctx, frame) {
    const glow = 0.28 + 0.14 * Math.sin(frame * 0.022 + this.phase);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = 'rgba(100,190,255,0.65)';
    ctx.shadowBlur  = 14;

    ctx.beginPath();
    switch (this.shape) {
      case 'triangle':
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size * 0.87,  this.size * 0.5);
        ctx.lineTo(-this.size * 0.87, this.size * 0.5);
        ctx.closePath();
        break;
      case 'square':
        ctx.rect(-this.size, -this.size, this.size * 2, this.size * 2);
        break;
      case 'hexagon':
      default:
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3 - Math.PI / 6;
          const px = Math.cos(a) * this.size;
          const py = Math.sin(a) * this.size;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    ctx.fillStyle   = `rgba(55,100,190,${glow * 0.5})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(100,200,255,${0.5 + glow * 0.45})`;
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ── TargetZone ────────────────────────────────────────────────────────────────

class TargetZone {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} r  radius
   */
  constructor(x, y, r) {
    this.x     = x;
    this.y     = y;
    this.r     = r;
    this.hit   = false;
    this.pulse = 0;
    this.flash = 0;  // flash amount on hit, 0-1
  }

  update() {
    this.pulse = (this.pulse + 0.025) % (Math.PI * 2);
    if (this.flash > 0) this.flash -= 0.022;
  }

  draw(ctx) {
    const p     = 0.5 + 0.5 * Math.sin(this.pulse);
    const color = this.hit ? '90,255,160' : '255,55,90';
    const r     = this.r * (1 + p * 0.18);

    // Outer glow gradient
    const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 2.4);
    grd.addColorStop(0, `rgba(${color},${0.32 + p * 0.18})`);
    grd.addColorStop(1, `rgba(${color},0)`);
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Fill
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color},0.10)`;
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${color},${0.65 + p * 0.3})`;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = `rgba(${color},0.8)`;
    ctx.shadowBlur  = 12 + p * 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Crosshair
    ctx.strokeStyle = `rgba(${color},0.4)`;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(this.x - r, this.y); ctx.lineTo(this.x + r, this.y);
    ctx.moveTo(this.x, this.y - r); ctx.lineTo(this.x, this.y + r);
    ctx.stroke();

    // Hit flash ring
    if (this.flash > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, r + 40 * (1 - this.flash), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${color},${this.flash * 0.7})`;
      ctx.lineWidth   = 3;
      ctx.stroke();
    }


  }

  /**
   * Returns true if obj overlaps the target zone.
   * @param {PhysObj} obj
   */
  overlaps(obj) {
    return Math.hypot(obj.x - this.x, obj.y - this.y) < this.r + obj.r * 0.55;
  }
}

// ── TargetBarrier ─────────────────────────────────────────────────────────────

class TargetBarrier {
  constructor(x, y, radius, thickness, gapHalfAngle, gapCenterAngle) {
    this.x              = x;
    this.y              = y;
    this.radius         = radius;
    this.thickness      = thickness      !== undefined ? thickness      : 14;
    this.gapHalfAngle   = gapHalfAngle   !== undefined ? gapHalfAngle   : Math.PI * 0.2;
    this.gapCenterAngle = gapCenterAngle !== undefined ? gapCenterAngle : 0;
  }

  draw(ctx) {
    var r   = this.radius + this.thickness / 2;
    var gc  = this.gapCenterAngle;
    var g   = this.gapHalfAngle;
    // Arc goes from (gap end) to (gap start) the long way around
    var arcStart = gc + g;
    var arcEnd   = gc - g + Math.PI * 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(210,80,80,0.55)';
    ctx.lineWidth   = this.thickness;
    ctx.lineCap     = 'round';
    ctx.shadowColor = 'rgba(255,60,60,0.45)';
    ctx.shadowBlur  = 12;

    ctx.beginPath();
    ctx.arc(this.x, this.y, r, arcStart, arcEnd, false);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// Pin classes to window so game.js and ui.js can reference them as globals
window.PhysObj        = PhysObj;
window.StaticObstacle = StaticObstacle;
window.TargetZone     = TargetZone;
window.TargetBarrier  = TargetBarrier;

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 2 INTERACTIVE OBJECTS
// ═════════════════════════════════════════════════════════════════════════════

// ── Button ────────────────────────────────────────────────────────────────────

class Button {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} r  radius
   * @param {string} id unique identifier
   */
  constructor(x, y, r, id) {
    this.x       = x;
    this.y       = y;
    this.r       = r;
    this.id      = id;
    this.pressed = false;
    this.pulse   = Math.random() * Math.PI * 2;
    this.hitFlash = 0;  // 0–1, flashes on press
  }

  overlaps(ball) {
    return Math.hypot(ball.x - this.x, ball.y - this.y) < this.r + ball.r * 0.7;
  }

  onPressed() {
    this.pressed  = true;
    this.hitFlash = 1;
  }

  reset() {
    this.pressed  = false;
    this.hitFlash = 0;
  }

  update() {
    this.pulse += 0.05;
    if (this.hitFlash > 0) this.hitFlash -= 0.04;
  }

  draw(ctx) {
    var p     = 0.5 + 0.5 * Math.sin(this.pulse);
    var color = this.pressed ? '100,255,120' : '255,200,60';
    var glow  = this.pressed ? '#64ff78'     : '#ffc83c';

    // Outer glow
    var grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 2.5);
    grd.addColorStop(0, 'rgba(' + color + ',' + (0.3 + p * 0.2) + ')');
    grd.addColorStop(1, 'rgba(' + color + ',0)');
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + color + ',' + (this.pressed ? 0.55 : 0.22) + ')';
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.strokeStyle = glow;
    ctx.lineWidth   = this.pressed ? 3 : 2;
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 14 + p * 8;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Hit flash ring
    if (this.hitFlash > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 20 * (1 - this.hitFlash), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + color + ',' + this.hitFlash * 0.8 + ')';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    }

    // Icon: filled circle when pressed, hollow when not
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 0.38, 0, Math.PI * 2);
    if (this.pressed) {
      ctx.fillStyle = glow + 'cc';
      ctx.fill();
    } else {
      ctx.strokeStyle = glow + 'aa';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }

    // Label
    ctx.fillStyle    = 'rgba(' + color + ',0.8)';
    ctx.font         = "bold 8px 'Share Tech Mono', monospace";
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('BTN', this.x, this.y - this.r - 4);
  }
}

// ── BreakableBrick ────────────────────────────────────────────────────────────

class BreakableBrick {
  // Neon-themed destructible brick with color variety and regen support.
  // Color palette cycles by id hash so each brick has its own consistent hue.

  static _palette() {
    return [
      { r:[0,180,255],   glow:'#00b4ff' },  // cyan
      { r:[255,80,180],  glow:'#ff50b4' },  // pink
      { r:[80,255,120],  glow:'#50ff78' },  // green
      { r:[255,160,30],  glow:'#ffa01e' },  // amber
      { r:[160,80,255],  glow:'#a050ff' },  // purple
      { r:[255,60,60],   glow:'#ff3c3c' },  // red
    ];
  }

  constructor(x, y, w, h, health, id, regenAfter) {
    this.x          = x;
    this.y          = y;
    this.w          = w;
    this.h          = h;
    this.health     = health;
    this.maxHealth  = health;
    this.id         = id;
    this.regenAfter = regenAfter || null;
    this.regenTimer = 0;
    this.hitFlash   = 0;
    this.phase      = Math.random() * Math.PI * 2;
    var hash = 0;
    for (var i = 0; i < (id || '').length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
    var pal = BreakableBrick._palette();
    this._pal = pal[hash % pal.length];

    // Pre-generate unique crack lines for each of 4 damage states
    // Each crack: { x1, y1, jag, len, branch? }
    this._cracks = [];
    for (var state = 0; state < 4; state++) {
      var stateCracks = [];
      var count = [0, 2, 4, 7][state];
      for (var c = 0; c < count; c++) {
        stateCracks.push({
          x1:  (Math.random() - 0.5) * 0.75,          // fractional position on w
          y1:  (Math.random() - 0.45) * 0.6,           // fractional position on h
          jag: (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 8),
          len: 0.25 + Math.random() * 0.45,
          rot: (Math.random() - 0.5) * 0.6,            // slight rotation variance
          thick: 0.7 + Math.random() * 0.8,
          branch: state >= 2 && Math.random() > 0.5,   // branches on heavier cracks
          bJag:  (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 6),
        });
      }
      this._cracks.push(stateCracks);
    }
  }

  overlaps(ball) {
    var rot = this._rotation || 0;
    if (rot === 0) {
      // Fast path: no rotation
      var nearX = Math.max(this.x - this.w/2, Math.min(ball.x, this.x + this.w/2));
      var nearY = Math.max(this.y - this.h/2, Math.min(ball.y, this.y + this.h/2));
      return Math.hypot(ball.x - nearX, ball.y - nearY) < ball.r;
    }
    // Transform ball into brick-local space
    var cosR  = Math.cos(-rot), sinR = Math.sin(-rot);
    var relX  = ball.x - this.x, relY = ball.y - this.y;
    var localX = cosR * relX - sinR * relY;
    var localY = sinR * relX + cosR * relY;
    var nearX2 = Math.max(-this.w/2, Math.min(localX, this.w/2));
    var nearY2 = Math.max(-this.h/2, Math.min(localY, this.h/2));
    return Math.hypot(localX - nearX2, localY - nearY2) < ball.r;
  }

  takeDamage(amount) {
    if (this.health <= 0) return false;
    if (this._invincible) return false;  // indestructible
    this.health -= amount;
    this.hitFlash = 1;
    if (this.health <= 0) {
      this.health = 0;
      if (this.regenAfter) this.regenTimer = this.regenAfter;
      return true; // destroyed
    }
    return false;
  }

  isAlive() { return this.health > 0; }

  // Call each frame from game loop (dt in ms)
  updateRegen(dt) {
    if (this.health > 0 || !this.regenAfter) return;
    this.regenTimer -= dt;
    if (this.regenTimer <= 0) {
      this.health = this.maxHealth;
      this.hitFlash = 0.8;
      this.regenTimer = 0;
      // Movable bricks: snap back to spawn point, reset physics
      if (this._spawnX !== undefined) {
        this.x = this._spawnX;
        this.y = this._spawnY;
        this._startX    = this._spawnX;
        this._startY    = this._spawnY;
        this._vx        = 0;
        this._vy        = 0;
        this._angularV  = 0;
        this._rotation  = this._spawnRot || 0;
      }
    }
  }

  draw(ctx) {
    var t = performance.now();
    var frac  = this.health / this.maxHealth;
    var pulse = 0.5 + 0.5 * Math.sin(this.phase + t * 0.0018);
    var pal   = this._pal;
    var col   = pal.r;
    var glow  = pal.glow;

    // When dead, draw ghost regen countdown
    if (this.health <= 0) {
      if (!this.regenAfter) return;
      var t2 = performance.now();

      // Snap-to-spawn animation: over first 500ms ease-out to spawn pos+rot
      var drawX = this.x, drawY = this.y, drawRot = this._rotation || 0;
      if (this._spawnX !== undefined) {
        var elapsed  = this.regenAfter - this.regenTimer;
        var bsm      = (window._gameBrickSpeedMult !== undefined) ? window._gameBrickSpeedMult : 0.5;
        var snapMs   = 500 / Math.max(0.1, bsm * 2);  // faster brickSpeed = faster snap
        var ease     = 1 - Math.pow(1 - Math.min(1, elapsed / snapMs), 3);
        drawX = this.x + (this._spawnX - this.x) * ease;
        drawY = this.y + (this._spawnY - this.y) * ease;
        // Interpolate rotation via shortest arc (<= 180°)
        var targetRot = this._spawnRot || 0;
        var curRot    = this._rotation || 0;
        var diff      = targetRot - curRot;
        // Wrap diff into [-π, π]
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        drawRot = curRot + diff * ease;
      }

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(drawRot);
      ctx.globalAlpha = 0.28 + 0.10 * Math.sin(t2 * 0.005);
      ctx.strokeStyle = glow;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.roundRect(-this.w/2, -this.h/2, this.w, this.h, 4);
      ctx.stroke();
      ctx.setLineDash([]);
      // Progress bar
      var prog = 1 - (this.regenTimer / this.regenAfter);
      ctx.fillStyle = glow + '55';
      ctx.fillRect(-this.w/2, -this.h/2, this.w * prog, this.h);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // Alive: draw with own rotation
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this._rotation) ctx.rotate(this._rotation);

    var bx = -this.w / 2, by = -this.h / 2;

    // Outer glow halo
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 8 + pulse * 6;

    // Body fill — semi-transparent with color tint
    ctx.beginPath();
    ctx.roundRect(bx, by, this.w, this.h, 4);
    ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (0.12 + frac * 0.15) + ')';
    ctx.fill();

    // Neon border — full brightness, fades as damaged
    ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (0.5 + frac * 0.5) + ')';
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Inner panel lines (texture — horizontal ribs)
    var ribCount = Math.max(2, Math.floor(this.h / 7));
    ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.18)';
    ctx.lineWidth   = 0.8;
    for (var ri = 1; ri < ribCount; ri++) {
      var ry = by + (this.h / ribCount) * ri;
      ctx.beginPath(); ctx.moveTo(bx + 3, ry); ctx.lineTo(bx + this.w - 3, ry); ctx.stroke();
    }

    // Edge dots — adaptive based on brick height (h)
    // h >= 20: 4 corner dots; 10 <= h < 20: 1 dot per edge (mid); h < 10: no dots
    if (this.h >= 10) {
      var dotR2 = Math.min(2.5, this.h * 0.15);
      ctx.fillStyle = glow;
      ctx.shadowColor = glow; ctx.shadowBlur = 4;
      if (this.h >= 20) {
        // 4 corner dots
        var corners = [
          [bx + 5, by + 5], [bx + this.w - 5, by + 5],
          [bx + 5, by + this.h - 5], [bx + this.w - 5, by + this.h - 5],
        ];
        for (var ci = 0; ci < corners.length; ci++) {
          ctx.beginPath(); ctx.arc(corners[ci][0], corners[ci][1], dotR2, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        // 1 dot per edge (midpoint of each edge)
        var midEdges = [
          [bx + this.w / 2, by + dotR2 + 1],                  // top edge mid
          [bx + this.w / 2, by + this.h - dotR2 - 1],          // bottom edge mid
          [bx + dotR2 + 1,  by + this.h / 2],                  // left edge mid
          [bx + this.w - dotR2 - 1, by + this.h / 2],          // right edge mid
        ];
        for (var mi = 0; mi < midEdges.length; mi++) {
          ctx.beginPath(); ctx.arc(midEdges[mi][0], midEdges[mi][1], dotR2, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    }

    // Cracks — clipped to brick bounds so they never overflow edges
    if (frac < 1 && this._cracks) {
      var crackState = frac > 0.75 ? 0 : frac > 0.50 ? 1 : frac > 0.25 ? 2 : 3;
      var crackAlpha = [0, 0.40, 0.65, 0.88][crackState];
      var stateCracks = this._cracks[crackState] || [];

      if (stateCracks.length > 0) {
        ctx.save();
        // Clip to brick rect so cracks stay inside
        ctx.beginPath();
        ctx.rect(bx, by, this.w, this.h);
        ctx.clip();

        for (var c = 0; c < stateCracks.length; c++) {
          var ck  = stateCracks[c];
          var cx1 = ck.x1 * this.w;
          var cy1 = ck.y1 * this.h;
          var jag = ck.jag;
          var endY = cy1 + this.h * ck.len;

          ctx.strokeStyle = 'rgba(255,255,255,' + crackAlpha + ')';
          ctx.lineWidth   = ck.thick;
          ctx.save();
          ctx.rotate(ck.rot);
          ctx.beginPath();
          ctx.moveTo(cx1, cy1);
          ctx.lineTo(cx1 + jag * 0.5, cy1 + this.h * ck.len * 0.45);
          ctx.lineTo(cx1 + jag,       endY);
          ctx.stroke();

          if (ck.branch) {
            ctx.strokeStyle = 'rgba(255,200,120,' + crackAlpha * 0.7 + ')';
            ctx.lineWidth   = ck.thick * 0.6;
            ctx.beginPath();
            ctx.moveTo(cx1 + jag * 0.5, cy1 + this.h * ck.len * 0.4);
            ctx.lineTo(cx1 + jag * 0.5 + ck.bJag, cy1 + this.h * ck.len * 0.75);
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.restore(); // remove clip
      }
    }

    // Health bar — always on the edge with the lowest world-space Y (most visible)
    // Compute world Y of midpoints of all 4 edges, pick the maximum (lowest on screen)
    var barH    = 4;
    var barFrac = this.health / this.maxHealth;
    // Half-extents in local space
    var hw2 = this.w / 2, hh2 = this.h / 2;
    var cosR = Math.cos(this._rotation || 0), sinR = Math.sin(this._rotation || 0);
    // World Y of each edge midpoint (using rotation applied at this.x/y)
    var edgeYs = [
      this.y + (-hh2) * cosR,  // top edge midpoint
      this.y + ( hh2) * cosR,  // bottom edge midpoint
      this.y + (-hw2) * sinR,  // left edge midpoint (rotated)
      this.y + ( hw2) * sinR,  // right edge midpoint (rotated)
    ];
    var lowestEdge = edgeYs.indexOf(Math.max(...edgeYs));
    // Draw bar on the correct local-space edge
    var barEdges = [
      { x: bx,           y: by,              w: this.w, axis: 'top' },    // top
      { x: bx,           y: by + this.h - barH, w: this.w, axis: 'bottom' }, // bottom
      { x: bx,           y: by,              w: barH,   axis: 'left', h: this.h },  // left
      { x: bx + this.w - barH, y: by,        w: barH,   axis: 'right', h: this.h }, // right
    ];
    var barEdge = barEdges[lowestEdge] || barEdges[1];
    var isVertical = (lowestEdge === 2 || lowestEdge === 3);
    var barW2 = isVertical ? this.h : this.w;
    var barBX = isVertical ? barEdge.x : bx;
    var barBY = barEdge.y;
    var barBW = isVertical ? barH : this.w;
    var barBH = isVertical ? this.h : barH;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(barBX, barBY, barBW, barBH, isVertical ? [0,2,2,0] : [0,0,2,2]); ctx.clip();
    ctx.fillStyle = 'rgba(40,0,0,0.7)'; ctx.fillRect(barBX, barBY, barBW, barBH);
    // Crosshatch in damaged area
    var hatchStart = isVertical ? barBY + barBH * barFrac : barBX + barBW * barFrac;
    if (barFrac < 1) {
      ctx.strokeStyle = 'rgba(120,0,0,0.55)'; ctx.lineWidth = 1.5;
      for (var hx = hatchStart - barH; hx < (isVertical ? barBY+barBH+barH : barBX+barBW+barH); hx += 5) {
        if (isVertical) {
          ctx.beginPath(); ctx.moveTo(barBX, hx); ctx.lineTo(barBX+barBW, hx+barBW); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(barBX+barBW, hx); ctx.lineTo(barBX, hx+barBW); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.moveTo(hx, barBY); ctx.lineTo(hx+barH, barBY+barH); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(hx, barBY+barH); ctx.lineTo(hx+barH, barBY); ctx.stroke();
        }
      }
    }
    if (barFrac > 0) {
      var bfW = isVertical ? barBW : barBW * barFrac;
      var bfH = isVertical ? barBH * barFrac : barBH;
      ctx.fillStyle = barFrac > 0.5 ? glow + 'cc' : (barFrac > 0.25 ? '#ffaa00cc' : '#ff2200cc');
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 4;
      ctx.fillRect(barBX, barBY, bfW, bfH);
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + this.hitFlash * 0.45 + ')';
      ctx.beginPath(); ctx.roundRect(bx, by, this.w, this.h, 4); ctx.fill();
      this.hitFlash -= 0.07;
    }

    ctx.restore();

    // Note overlay labels (drawn outside the rotation save so they stay readable)
    if (this._noteConfig) {
      var nc = this._noteConfig;
      if (window._showBrickNote !== false || window._showBrickOctave !== false || window._showBrickTimbre !== false) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this._rotation) ctx.rotate(this._rotation);
        ctx.textAlign = 'center';
        if ((window._showBrickNote !== false || window._showBrickOctave !== false)) {
          var noteStr = (window._showBrickNote !== false ? (nc.note || 'C') : '') +
                        (window._showBrickOctave !== false ? String(nc.octave !== undefined ? nc.octave : 4) : '');
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          ctx.font = "bold 9px 'Share Tech Mono',monospace";
          ctx.textBaseline = 'middle';
          ctx.fillText(noteStr, 0, 0);
        }
        if (window._showBrickTimbre !== false && nc.timbre) {
          ctx.fillStyle = 'rgba(200,100,255,0.60)';
          ctx.font = "7px 'Share Tech Mono',monospace";
          ctx.textBaseline = 'top';
          ctx.fillText(nc.timbre, 0, this.h / 2 + 2);
        }
        ctx.restore();
      }
    }
  }
}

// ── VerticalBrick ─────────────────────────────────────────────────────────────
// Same as BreakableBrick but w and h are swapped (tall instead of wide).
// Collision system works identically — just oriented vertically.

class VerticalBrick extends BreakableBrick {
  constructor(x, y, w, h, health, id, regenAfter) {
    // Swap w/h so it stands tall
    super(x, y, h, w, health, id, regenAfter);
    this._isVertical = true;
  }
  // Draw override: same as parent but cracks rotate 90°
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-this.x, -this.y);
    super.draw(ctx);
    ctx.restore();
  }
}

// ── CircularBrick ─────────────────────────────────────────────────────────────
// Spherical obstacle. Uses circle-circle collision instead of rect.

class CircularBrick {
  static _palette() { return BreakableBrick._palette(); }

  constructor(x, y, r, health, id, regenAfter) {
    this.x          = x;
    this.y          = y;
    this.r          = r;
    this.w          = r * 2;  // for compatibility
    this.h          = r * 2;
    this.health     = health;
    this.maxHealth  = health;
    this.id         = id;
    this.regenAfter = regenAfter || null;
    this.regenTimer = 0;
    this.hitFlash   = 0;
    this.phase      = Math.random() * Math.PI * 2;
    var hash = 0;
    for (var i = 0; i < (id || '').length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
    var pal = BreakableBrick._palette();
    this._pal = pal[hash % pal.length];
    // Pre-generate cracks same as BreakableBrick
    this._cracks = [];
    for (var state = 0; state < 4; state++) {
      var sc = []; var count = [0, 2, 3, 5][state];
      for (var c = 0; c < count; c++) {
        sc.push({
          angle: Math.random() * Math.PI * 2,
          len:   0.3 + Math.random() * 0.5,
          thick: 0.6 + Math.random() * 0.7,
          branch: state >= 2 && Math.random() > 0.5,
          bAngle: Math.random() * Math.PI,
        });
      }
      this._cracks.push(sc);
    }
  }

  // Circle-ball overlap
  overlaps(ball) {
    return Math.hypot(ball.x - this.x, ball.y - this.y) < this.r + ball.r * 0.85;
  }

  takeDamage(amount) {
    if (this.health <= 0) return false;
    this.health -= amount;
    this.hitFlash = 1;
    if (this.health <= 0) {
      this.health = 0;
      if (this.regenAfter) this.regenTimer = this.regenAfter;
      return true;
    }
    return false;
  }

  isAlive() { return this.health > 0; }

  updateRegen(dt) {
    if (this.health > 0 || !this.regenAfter) return;
    this.regenTimer -= dt;
    if (this.regenTimer <= 0) {
      this.health = this.maxHealth; this.hitFlash = 0.8; this.regenTimer = 0;
      if (this._spawnX !== undefined) {
        this.x = this._spawnX; this.y = this._spawnY;
        this._startX = this._spawnX; this._startY = this._spawnY;
        this._vx = 0; this._vy = 0; this._angularV = 0;
        this._rotation = this._spawnRot || 0;
      }
    }
  }

  draw(ctx) {
    var t    = performance.now();
    var frac = this.health / this.maxHealth;
    var pulse= 0.5 + 0.5 * Math.sin(this.phase + t * 0.0018);
    var pal  = this._pal, col = pal.r, glow = pal.glow;

    if (this.health <= 0) {
      if (!this.regenAfter) return;
      var t3 = performance.now();
      // Snap-to-spawn animation
      var drawCX = this.x, drawCY = this.y;
      if (this._spawnX !== undefined) {
        var elapsed2  = this.regenAfter - this.regenTimer;
        var ease2 = 1 - Math.pow(1 - Math.min(1, elapsed2 / 500), 3);
        drawCX = this.x + (this._spawnX - this.x) * ease2;
        drawCY = this.y + (this._spawnY - this.y) * ease2;
      }
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.1 * Math.sin(t3 * 0.005);
      ctx.strokeStyle = glow; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(drawCX, drawCY, this.r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      var prog2 = 1 - (this.regenTimer / this.regenAfter);
      ctx.fillStyle = glow + '44';
      ctx.beginPath();
      ctx.moveTo(drawCX, drawCY);
      ctx.arc(drawCX, drawCY, this.r, -Math.PI / 2, -Math.PI / 2 + prog2 * Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1; ctx.restore();
      return;
    }

    ctx.save();
    // Outer glow
    ctx.shadowColor = glow; ctx.shadowBlur = 8 + pulse * 6;
    ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (0.10 + frac * 0.12) + ')';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();

    // Neon ring
    ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (0.5 + frac * 0.5) + ')';
    ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;

    // Inner ring
    ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.18)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.65, 0, Math.PI * 2); ctx.stroke();

    // Cracks (radiating lines from center)
    if (frac < 1 && this._cracks) {
      var crackState = frac > 0.75 ? 0 : frac > 0.5 ? 1 : frac > 0.25 ? 2 : 3;
      var crackAlpha = [0, 0.40, 0.65, 0.88][crackState];
      var sc = this._cracks[crackState] || [];
      for (var c = 0; c < sc.length; c++) {
        var ck = sc[c];
        var cr = this.r * ck.len;
        ctx.strokeStyle = 'rgba(255,255,255,' + crackAlpha + ')';
        ctx.lineWidth = ck.thick;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(ck.angle) * cr, this.y + Math.sin(ck.angle) * cr);
        ctx.stroke();
        if (ck.branch) {
          ctx.lineWidth = ck.thick * 0.6;
          ctx.strokeStyle = 'rgba(255,200,120,' + crackAlpha * 0.7 + ')';
          ctx.beginPath();
          var mid = cr * 0.5;
          ctx.moveTo(this.x + Math.cos(ck.angle) * mid, this.y + Math.sin(ck.angle) * mid);
          ctx.lineTo(this.x + Math.cos(ck.bAngle) * cr * 0.6, this.y + Math.sin(ck.bAngle) * cr * 0.6);
          ctx.stroke();
        }
      }
    }

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + this.hitFlash * 0.45 + ')';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
      this.hitFlash -= 0.07;
    }
    ctx.restore();
  }
}

class RotatingTurnstile {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} r         arm reach radius
   * @param {number} rotSpeed  deg/s (converted to rad/frame internally)
   * @param {string} id
   */
  constructor(x, y, r, rotSpeed, id) {
    this.x        = x;
    this.y        = y;
    this.r        = r;
    this.id       = id;
    this.angle    = 0;
    this.rotSpeed = (rotSpeed || 180) * (Math.PI / 180) / 60;  // rad per frame @ 60fps
    this.spinning = true;
    this.armCount = 4;
    this.armWidth = 6;
  }

  update(dt) {
    if (!this.spinning) return;
    this.angle += this.rotSpeed;
  }

  toggleRotation() {
    this.spinning = !this.spinning;
  }

  /** Returns true if ball was deflected */
  bounceOffArm(ball) {
    // Check each arm
    for (var i = 0; i < this.armCount; i++) {
      var armAngle = this.angle + (i / this.armCount) * Math.PI * 2;
      var ax1 = this.x - Math.cos(armAngle) * this.r;
      var ay1 = this.y - Math.sin(armAngle) * this.r;
      var ax2 = this.x + Math.cos(armAngle) * this.r;
      var ay2 = this.y + Math.sin(armAngle) * this.r;

      // Distance from ball center to line segment
      var dist = _distToSegment(ball.x, ball.y, ax1, ay1, ax2, ay2);
      if (dist < ball.r + this.armWidth * 0.5) {
        // Compute arm normal (perpendicular)
        var len = Math.hypot(ax2 - ax1, ay2 - ay1);
        if (len < 0.001) continue;
        var nx = -(ay2 - ay1) / len;
        var ny =  (ax2 - ax1) / len;
        // Ensure normal points away from arm center toward ball
        var toBallX = ball.x - this.x, toBallY = ball.y - this.y;
        if (nx * toBallX + ny * toBallY < 0) { nx = -nx; ny = -ny; }
        // Reflect velocity + add rotational kick
        var dot = ball.vx * nx + ball.vy * ny;
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
        // Rotational kick proportional to arm speed
        var kick = this.rotSpeed * this.r * 0.6;
        ball.vx += -ny * kick;
        ball.vy +=  nx * kick;
        ball.inFlight = true;
        return true;
      }
    }
    return false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Hub
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = this.spinning ? '#00d4ff' : '#446688';
    ctx.shadowColor = this.spinning ? '#00d4ff' : '#224';
    ctx.shadowBlur  = this.spinning ? 12 : 4;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Arms
    for (var i = 0; i < this.armCount; i++) {
      var a = this.angle + (i / this.armCount) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);

      ctx.strokeStyle = this.spinning ? 'rgba(0,212,255,0.85)' : 'rgba(100,150,200,0.5)';
      ctx.lineWidth   = this.armWidth;
      ctx.lineCap     = 'round';
      ctx.shadowColor = this.spinning ? '#00d4ff' : 'transparent';
      ctx.shadowBlur  = this.spinning ? 8 : 0;
      ctx.beginPath();
      ctx.moveTo(-this.r, 0);
      ctx.lineTo( this.r, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Tip caps
      ctx.beginPath();
      ctx.arc(this.r, 0, this.armWidth * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = this.spinning ? 'rgba(0,255,255,0.6)' : 'rgba(100,150,200,0.4)';
      ctx.fill();
      ctx.restore();
    }

    // Label
    ctx.fillStyle    = 'rgba(0,212,255,0.7)';
    ctx.font         = "bold 8px 'Share Tech Mono', monospace";
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('TURN', 0, -this.r - 5);

    ctx.restore();
  }
}

function _distToSegment(px, py, ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay;
  var lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  var t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ── ElectricalPort ────────────────────────────────────────────────────────────

class ElectricalPort {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} r
   * @param {string|null} requiredType  null = accepts any ball type
   * @param {string} id
   */
  constructor(x, y, r, requiredType, id) {
    this.x            = x;
    this.y            = y;
    this.r            = r;
    this.id           = id;
    this.requiredType = requiredType;
    this.active       = true;
    this.occupied     = null;   // PhysObj | null
    this.pulse        = Math.random() * Math.PI * 2;
    this.sparks       = [];
  }

  overlaps(ball) {
    return Math.hypot(ball.x - this.x, ball.y - this.y) < this.r + ball.r * 0.6;
  }

  canAccept(ball) {
    if (!this.active)    return false;
    if (this.occupied)   return false;
    if (this.requiredType && ball.type !== this.requiredType) return false;
    return true;
  }

  setActive(state) {
    this.active = state;
    if (!state) this.occupied = null;
  }

  update() {
    this.pulse += 0.06;
    // Spawn arc sparks when occupied
    if (this.occupied && Math.random() < 0.25) {
      this.sparks.push({
        x: this.x + (Math.random() - 0.5) * this.r * 2,
        y: this.y + (Math.random() - 0.5) * this.r * 2,
        life: 0.7 + Math.random() * 0.3,
      });
    }
    for (var i = this.sparks.length - 1; i >= 0; i--) {
      this.sparks[i].life -= 0.08;
      if (this.sparks[i].life <= 0) this.sparks.splice(i, 1);
    }
  }

  draw(ctx) {
    var p     = 0.5 + 0.5 * Math.sin(this.pulse);
    var color = this.occupied ? '100,220,255' :
                this.active   ? '255,200,60'  :
                                '80,80,120';
    var glow  = this.occupied ? '#64dcff' :
                this.active   ? '#ffc83c'  : '#505078';

    // Outer glow
    var grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 2.2);
    grd.addColorStop(0, 'rgba(' + color + ',' + (0.28 + p * 0.18) + ')');
    grd.addColorStop(1, 'rgba(' + color + ',0)');
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Ring
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.strokeStyle = glow;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 14 + p * 10;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Inner fill
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + color + ',' + (this.occupied ? 0.5 : 0.12) + ')';
    ctx.fill();

    // ⚡ symbol
    ctx.fillStyle    = 'rgba(' + color + ',0.9)';
    ctx.font         = 'bold 14px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', this.x, this.y);

    // Arc sparks when occupied
    for (var i = 0; i < this.sparks.length; i++) {
      var sp = this.sparks[i];
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 1.5 * sp.life, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,220,255,' + sp.life + ')';
      ctx.fill();
    }

    // Required type label
    if (this.requiredType) {
      ctx.fillStyle    = 'rgba(' + color + ',0.7)';
      ctx.font         = "bold 7px 'Share Tech Mono', monospace";
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.requiredType.toUpperCase().slice(0, 4), this.x, this.y - this.r - 4);
    }
  }
}

// ── BallSpawner ───────────────────────────────────────────────────────────────

class BallSpawner {
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} spawnType  ball type to spawn
   * @param {number} spawnInterval  ms between spawns
   * @param {number|null} spawnCount  total balls to spawn (null = infinite)
   * @param {string} id
   */
  constructor(x, y, spawnType, spawnInterval, spawnCount, id) {
    this.x             = x;
    this.y             = y;
    this.id            = id;
    this.spawnType     = spawnType     || 'bouncer';
    this.spawnInterval = spawnInterval || 1000;
    this.spawnCount    = spawnCount    || null;  // null = infinite
    this.active        = false;
    this.elapsed       = 0;
    this.spawned       = 0;
    this.w             = 36;
    this.h             = 48;
    this.pulse         = Math.random() * Math.PI * 2;
  }

  activate()   { this.active = true;  this.elapsed = 0; }
  deactivate() { this.active = false; }

  update(dt) {
    if (!this.active) return;
    if (this.spawnCount !== null && this.spawned >= this.spawnCount) {
      this.active = false;
      return;
    }
    this.elapsed += dt;
    if (this.elapsed >= this.spawnInterval) {
      this.elapsed = 0;
      this.spawn();
    }
    this.pulse += 0.08;
  }

  spawn() {
    var game = window._gameInstance;
    if (!game) return;
    var bs = window.BallSettings && window.BallSettings[this.spawnType];
    if (!bs) return;
    var r   = bs.size;
    var obj = new PhysObj(this.x, this.y - r, r, r / 10, bs.color, bs.glow, bs.label.slice(0, 3));
    obj.type     = this.spawnType;
    obj.inFlight = true;
    obj.pinned   = false;
    obj.exploded = false;
    obj.dead     = false;
    obj.hasStuck = false;
    obj.hasSplit = false;
    obj.stuckTo  = null;
    obj.vx = (Math.random() - 0.5) * 2;
    obj.vy = -2 - Math.random() * 3;
    game.objects.push(obj);
    this.spawned++;
  }

  draw(ctx) {
    var p     = 0.5 + 0.5 * Math.sin(this.pulse);
    var color = this.active ? '255,160,30' : '100,120,160';
    var glow  = this.active ? '#ffa01e'    : '#647898';

    ctx.save();
    ctx.translate(this.x, this.y);

    // Chute body
    var bx = -this.w / 2, by = -this.h;
    ctx.beginPath();
    ctx.roundRect(bx, by, this.w, this.h, 4);
    ctx.fillStyle = 'rgba(' + color + ',0.18)';
    ctx.fill();
    ctx.strokeStyle = glow;
    ctx.lineWidth   = 2;
    ctx.shadowColor = glow;
    ctx.shadowBlur  = this.active ? 10 + p * 6 : 4;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Arrow indicating drop direction
    ctx.strokeStyle = 'rgba(' + color + ',0.7)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, -this.h * 0.6);
    ctx.lineTo(0, -this.h * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -this.h * 0.2);
    ctx.lineTo(0, -this.h * 0.05);
    ctx.lineTo(6, -this.h * 0.2);
    ctx.stroke();

    // Label
    ctx.fillStyle    = 'rgba(' + color + ',0.85)';
    ctx.font         = "bold 7px 'Share Tech Mono', monospace";
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('SPWN', 0, -this.h - 4);

    // Count display
    if (this.spawnCount !== null) {
      var remaining = Math.max(0, this.spawnCount - this.spawned);
      ctx.fillText(remaining + '/' + this.spawnCount, 0, -this.h - 13);
    }

    ctx.restore();
  }
}

// Export Phase 2 classes
window.Button           = Button;
window.BreakableBrick   = BreakableBrick;
window.RotatingTurnstile = RotatingTurnstile;
window.ElectricalPort   = ElectricalPort;
window.BallSpawner      = BallSpawner;

// ── Brick shard particles ─────────────────────────────────────────────────────
// Called by game.js when a brick takes a hit. Spawns directional shards.

function spawnBrickShards(sparks, brick, ball) {
  if (!sparks) return;
  var pal    = brick._pal || { r:[200,100,50], glow:'#ff6622' };
  var col    = pal.glow;
  // Direction of impact: from ball toward brick center (shards fly away from ball)
  var impactDx = brick.x - ball.x;
  var impactDy = brick.y - ball.y;
  var impactLen = Math.hypot(impactDx, impactDy) || 1;
  var nx = impactDx / impactLen;
  var ny = impactDy / impactLen;

  var count = 8 + Math.floor(Math.random() * 6);
  for (var i = 0; i < count; i++) {
    // Spread: mostly in impact direction, some scatter
    var spread = (Math.random() - 0.5) * Math.PI * 0.9;
    var angle  = Math.atan2(ny, nx) + spread;
    var speed  = 2 + Math.random() * 5;
    sparks.push({
      x:     brick.x + (Math.random() - 0.5) * brick.w * 0.5,
      y:     brick.y + (Math.random() - 0.5) * brick.h * 0.5,
      vx:    Math.cos(angle) * speed,
      vy:    Math.sin(angle) * speed - 1,  // slight upward bias
      life:  0.8 + Math.random() * 0.2,
      decay: 0.025 + Math.random() * 0.02,
      color: col,
      size:  1.5 + Math.random() * 2.5,
    });
  }
}

window.spawnBrickShards = spawnBrickShards;
