window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {};
window.PUZZBALLS_FILE_VERSION['tubes.js'] = 1430;
// tubes.js — PuzzBalls tube system
// Tube pieces: straight, elbow90/45/30/15, uturn, funnel
// Three visual styles: glass, window, solid
// Ball routing: parametric path travel with speed modifier

(function() {

// ── Tube geometry helpers ──────────────────────────────────────────────────────
function rotPt(x, y, cx, cy, a) {
  var cos = Math.cos(a), sin = Math.sin(a);
  var rx = x - cx, ry = y - cy;
  return { x: cx + rx*cos - ry*sin, y: cy + rx*sin + ry*cos };
}

// ── TubePiece ──────────────────────────────────────────────────────────────────
class TubePiece {
  constructor(type, x, y, rotation, opts) {
    opts = opts || {};
    this.type     = type;      // 'straight','elbow90','elbow45','elbow30','elbow15','uturn','funnel'
    this.x        = x;
    this.y        = y;
    this.rotation = rotation || 0;  // radians, defines entry direction
    this.length   = opts.length || 80;
    this.radius   = opts.radius || 14;  // tube inner radius
    this.speedMod = opts.speedMod !== undefined ? opts.speedMod : 1.0;
    this.style    = opts.style || 'glass'; // 'glass' | 'window' | 'solid'
    this.layer    = opts.layer || 'main';  // 'main' | 'behind' | 'above'
    this.color    = opts.color || null;    // null = auto from speedMod
    this.id       = opts.id || ('tube_' + Date.now() + '_' + Math.random().toString(36).slice(2,6));
    this.connectedA = null;  // TubePiece connected at socket A
    this.connectedB = null;  // TubePiece connected at socket B
    // Ball currently inside this tube
    this._ball      = null;
    this._ballT     = 0;     // 0→1 parametric position along path
    this._ballDir   = 1;     // +1 entering from A, -1 entering from B
    this._ballV     = 0;     // speed in px/frame while inside
    this._path      = null;  // cached path points [{x,y}] from A to B
    this._pathLen   = 0;
    this._buildPath();
  }

  // ── Sockets ──────────────────────────────────────────────────────────────────
  // Returns {x, y, angle} for each socket in world space
  socketA() { return this._socket(0); }
  socketB() { return this._socket(1); }

  _socket(idx) {
    var pts = this._pathEndpoints();
    var pt  = idx === 0 ? pts[0] : pts[pts.length - 1];
    // Entry angle for A = rotation, exit angle for B = path tangent at end
    var angle = idx === 0
      ? this.rotation + Math.PI   // faces outward (ball enters going +rotation direction)
      : this._exitAngle();
    return { x: pt.x, y: pt.y, angle: angle, piece: this, side: idx === 0 ? 'A' : 'B' };
  }

  // ── Path building ─────────────────────────────────────────────────────────────
  _buildPath() {
    var pts = [];
    var type = this.type;
    var len  = this.length;
    var R    = this.x, cy = this.y;

    // All paths computed in local space (entry at origin, direction = right = 0°)
    // then rotated by this.rotation into world space
    var local = [];

    if (type === 'straight') {
      // Simple line from (0,0) to (len, 0)
      for (var i = 0; i <= 20; i++) {
        local.push({ x: i/20 * len, y: 0 });
      }
    } else if (type === 'funnel') {
      // Funnel: wide mouth at entry (V-shape), narrows to tube at exit
      // Path follows center: just a short straight for now
      for (var i = 0; i <= 10; i++) {
        local.push({ x: i/10 * 40, y: 0 });
      }
    } else {
      // Elbow angles
      var bendAngles = { elbow90: Math.PI/2, elbow45: Math.PI/4, elbow30: Math.PI/6, elbow15: Math.PI/12, uturn: Math.PI };
      var bendAngle = bendAngles[type] || Math.PI/2;
      // Arc: entry horizontal, exit at bendAngle
      // Arc center is below entry point
      var arcR = len / bendAngle;  // radius of centerline arc
      var steps = Math.max(12, Math.round(bendAngle / (Math.PI/20)));
      for (var i = 0; i <= steps; i++) {
        var a = i/steps * bendAngle - Math.PI/2;
        local.push({ x: arcR + arcR * Math.cos(a - bendAngle/2 + Math.PI/2 - Math.PI/2),
                     y: arcR - arcR * Math.cos(i/steps * bendAngle) });
      }
      // Recalculate more simply: arc from (0,0) curving down-right
      local = [];
      for (var i = 0; i <= steps; i++) {
        var a2 = -Math.PI/2 + i/steps * bendAngle;
        local.push({ x: arcR * (Math.cos(-Math.PI/2) - Math.cos(a2)) * (-1),
                     y: arcR * (Math.sin(a2) - Math.sin(-Math.PI/2)) });
      }
    }

    // Rotate and translate into world space
    var cos = Math.cos(this.rotation), sin = Math.sin(this.rotation);
    for (var i = 0; i < local.length; i++) {
      var lx = local[i].x, ly = local[i].y;
      pts.push({ x: this.x + lx*cos - ly*sin, y: this.y + lx*sin + ly*cos });
    }

    this._path = pts;
    this._pathLen = this._calcPathLen(pts);
  }

  _calcPathLen(pts) {
    var len = 0;
    for (var i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
    }
    return len;
  }

  _pathEndpoints() {
    return this._path || [];
  }

  _exitAngle() {
    var pts = this._path;
    if (!pts || pts.length < 2) return this.rotation;
    var last = pts[pts.length-1], prev = pts[pts.length-2];
    return Math.atan2(last.y - prev.y, last.x - prev.x);
  }

  // ── Point at parametric t (0=entry, 1=exit) ───────────────────────────────
  _pointAtT(t) {
    var pts = this._path;
    if (!pts || pts.length === 0) return { x: this.x, y: this.y };
    if (t <= 0) return pts[0];
    if (t >= 1) return pts[pts.length-1];
    var target = t * this._pathLen;
    var dist = 0;
    for (var i = 1; i < pts.length; i++) {
      var seg = Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
      if (dist + seg >= target) {
        var frac = (target - dist) / seg;
        return { x: pts[i-1].x + frac*(pts[i].x-pts[i-1].x),
                 y: pts[i-1].y + frac*(pts[i].y-pts[i-1].y) };
      }
      dist += seg;
    }
    return pts[pts.length-1];
  }

  // ── Update: advance ball through tube ────────────────────────────────────────
  update() {
    if (!this._ball) return null;
    var spf = this._pathLen > 0 ? 1 / this._pathLen : 0.05;
    this._ballT += this._ballV * spf * this._ballDir;
    var done  = this._ballT >= 1 || this._ballT <= 0;
    var exitA = this._ballT <= 0;
    if (done) {
      var ball = this._ball;
      this._ball = null;
      var exitSocket = exitA ? this.socketA() : this.socketB();
      // Apply speed modifier
      var spd  = Math.hypot(ball.vx, ball.vy);
      var newSpd = Math.max(2, spd * this.speedMod);
      var exitAngle = exitSocket.angle + (exitA ? Math.PI : 0);
      ball.vx = Math.cos(exitAngle) * newSpd;
      ball.vy = Math.sin(exitAngle) * newSpd;
      ball.inFlight = true;
      // Position at exit
      ball.x = exitSocket.x;
      ball.y = exitSocket.y;
      return { ball: ball, socket: exitSocket };
    }
    // Update ball position to follow path
    var pos = this._pointAtT(this._ballT);
    this._ball.x = pos.x;
    this._ball.y = pos.y;
    return null;
  }

  // ── Capture: check if a free ball is entering this tube ─────────────────────
  tryCapture(ball) {
    if (this._ball) return false;
    if (ball._inTube) return false;
    for (var s = 0; s <= 1; s++) {
      var sock = s === 0 ? this.socketA() : this.socketB();
      var dist = Math.hypot(ball.x - sock.x, ball.y - sock.y);
      var threshold = (this.type === 'funnel') ? this.radius * 3 : this.radius + ball.r + 2;
      if (dist < threshold) {
        // Check ball is roughly heading into the socket
        var relAngle = Math.atan2(ball.y - sock.y, ball.x - sock.x);
        var diff     = Math.abs(((relAngle - sock.angle) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        if (diff < Math.PI * 0.65 || this.type === 'funnel') {
          this._ball    = ball;
          this._ballT   = s === 0 ? 0 : 1;
          this._ballDir = s === 0 ? 1 : -1;
          this._ballV   = Math.hypot(ball.vx, ball.vy);
          ball._inTube  = this;
          ball.pinned   = true;  // remove from normal physics
          return true;
        }
      }
    }
    return false;
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────
  draw(ctx, frame, isEditorSelected) {
    if (!this._path || this._path.length < 2) return;
    ctx.save();

    var color = this._tubeColor();
    var r = parseInt(color.slice(1,3),16)||0, g2 = parseInt(color.slice(3,5),16)||0, b2 = parseInt(color.slice(5,7),16)||0;
    var tubeR = this.radius;
    var alpha = this.layer === 'behind' ? 0.55 : 1.0;
    var pts   = this._path;

    // ── Draw tube wall ─────────────────────────────────────────────────────────
    if (this.type === 'funnel') {
      this._drawFunnel(ctx, color, alpha);
    } else {
      // Outer wall (filled, colored)
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.lineWidth   = tubeR * 2 + 4;
      ctx.strokeStyle = 'rgba(' + r + ',' + g2 + ',' + b2 + ',' + (alpha * (this.style === 'glass' ? 0.12 : this.style === 'window' ? 0.30 : 0.70)) + ')';
      ctx.lineCap     = 'round'; ctx.lineJoin = 'round';
      ctx.stroke();

      // Outer rim glow
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.lineWidth   = tubeR * 2 + 4;
      ctx.strokeStyle = 'rgba(' + r + ',' + g2 + ',' + b2 + ',' + (alpha * 0.35) + ')';
      ctx.shadowColor = 'rgba(' + r + ',' + g2 + ',' + b2 + ',0.4)';
      ctx.shadowBlur  = 8;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // Left edge line
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.lineWidth   = 2;
      ctx.strokeStyle = 'rgba(' + r + ',' + g2 + ',' + b2 + ',' + (alpha * 0.85) + ')';
      ctx.shadowColor = color; ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // Window stripe (style='window') — a thin highlight strip down the center
      if (this.style === 'window') {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.lineWidth   = tubeR * 0.35;
        ctx.strokeStyle = 'rgba(220,240,255,' + (alpha * 0.55) + ')';
        ctx.stroke();
      }
      // Glass style: inner gloss
      if (this.style === 'glass') {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.lineWidth   = tubeR * 0.5;
        ctx.strokeStyle = 'rgba(200,235,255,' + (alpha * 0.30) + ')';
        ctx.stroke();
      }
    }

    // ── Draw ball inside (glass/window only) ──────────────────────────────────
    if (this._ball && this.style !== 'solid') {
      var ballPos = this._pointAtT(this._ballT);
      var bs  = window.BallSettings && BallSettings[this._ball.type] || {};
      var bAlpha = this.style === 'glass' ? 0.9 : 0.6;
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, this._ball.r * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = (bs.glow || '#ffffff') + Math.round(bAlpha * 255).toString(16).padStart(2,'0');
      ctx.shadowColor = bs.glow || '#ffffff'; ctx.shadowBlur = 8;
      ctx.fill(); ctx.shadowBlur = 0;
    }

    // ── Socket indicators in editor ───────────────────────────────────────────
    if (window._tubeEditorMode || isEditorSelected) {
      [this.socketA(), this.socketB()].forEach(function(sock) {
        ctx.beginPath(); ctx.arc(sock.x, sock.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = isEditorSelected ? '#ffff44' : 'rgba(0,200,255,0.7)';
        ctx.lineWidth = 1.5; ctx.stroke();
        // Direction arrow
        ctx.beginPath();
        ctx.moveTo(sock.x, sock.y);
        ctx.lineTo(sock.x + Math.cos(sock.angle + Math.PI) * 10, sock.y + Math.sin(sock.angle + Math.PI) * 10);
        ctx.strokeStyle = 'rgba(0,200,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      });
    }

    // ── Snap highlight ────────────────────────────────────────────────────────
    if (this._snapHighlight) {
      ctx.beginPath(); ctx.arc(this._snapHighlight.x, this._snapHighlight.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2;
      ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 8;
      ctx.stroke(); ctx.shadowBlur = 0;
    }

    // ── Behind-layer darkening overlay ────────────────────────────────────────
    if (this.layer === 'behind') {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.lineWidth   = this.radius * 2 + 4;
      ctx.strokeStyle = 'rgba(0,0,20,0.35)';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawFunnel(ctx, color, alpha) {
    // V-shaped funnel: wide mouth at entry socket, narrows to tube radius
    var sockA  = this.socketA();
    var sockB  = this.socketB();
    var mouthR = this.radius * 2.5;
    var exitR  = this.radius;
    var r = parseInt(color.slice(1,3),16)||0, g2 = parseInt(color.slice(3,5),16)||0, b2 = parseInt(color.slice(5,7),16)||0;
    // Left and right mouth edges
    var perpA  = this.rotation + Math.PI / 2;
    var mLX = sockA.x + Math.cos(perpA) * mouthR, mLY = sockA.y + Math.sin(perpA) * mouthR;
    var mRX = sockA.x - Math.cos(perpA) * mouthR, mRY = sockA.y - Math.sin(perpA) * mouthR;
    var eLX = sockB.x + Math.cos(perpA) * exitR,  eLY = sockB.y + Math.sin(perpA) * exitR;
    var eRX = sockB.x - Math.cos(perpA) * exitR,  eRY = sockB.y - Math.sin(perpA) * exitR;
    ctx.beginPath();
    ctx.moveTo(mLX, mLY); ctx.lineTo(eLX, eLY); ctx.lineTo(eRX, eRY); ctx.lineTo(mRX, mRY); ctx.closePath();
    ctx.fillStyle   = 'rgba(' + r + ',' + g2 + ',' + b2 + ',' + (alpha * 0.18) + ')'; ctx.fill();
    ctx.strokeStyle = 'rgba(' + r + ',' + g2 + ',' + b2 + ',' + (alpha * 0.80) + ')';
    ctx.lineWidth   = 1.8; ctx.lineJoin = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
    // Inner highlight line
    ctx.beginPath(); ctx.moveTo(mLX, mLY); ctx.lineTo(eLX, eLY);
    ctx.strokeStyle = 'rgba(200,235,255,' + (alpha * 0.35) + ')'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mRX, mRY); ctx.lineTo(eRX, eRY);
    ctx.stroke();
  }

  _tubeColor() {
    // Color by speed modifier and user override
    if (this.color) return this.color;
    if (this.speedMod > 1.3) return '#ff6600';   // accelerator = orange
    if (this.speedMod < 0.7) return '#4466ff';   // decelerator = blue
    return '#00ccff';                             // neutral = cyan
  }

  // ── Rebuild path after position/rotation change ───────────────────────────
  rebuild() { this._buildPath(); }
}

// ── TubeManager ───────────────────────────────────────────────────────────────
class TubeManager {
  constructor() {
    this.tubes     = [];
    this.SNAP_DIST = 28;
  }

  add(tube) { this.tubes.push(tube); }

  remove(tube) {
    // Disconnect any connections
    this.tubes.forEach(function(t) {
      if (t.connectedA === tube) t.connectedA = null;
      if (t.connectedB === tube) t.connectedB = null;
    });
    this.tubes = this.tubes.filter(function(t) { return t !== tube; });
    if (tube._ball) { tube._ball._inTube = null; tube._ball.pinned = false; }
  }

  // ── Update all tubes + handle captures ───────────────────────────────────
  update(balls) {
    var self = this;
    // Try to capture free balls
    for (var ti = 0; ti < this.tubes.length; ti++) {
      var tube = this.tubes[ti];
      if (tube._ball) continue;
      for (var bi = 0; bi < balls.length; bi++) {
        var ball = balls[bi];
        if (ball.dead || ball._inTube || !ball.inFlight) continue;
        if (tube.tryCapture(ball)) break;
      }
    }
    // Advance balls in tubes
    for (var ti = 0; ti < this.tubes.length; ti++) {
      var result = this.tubes[ti].update();
      if (result) {
        // Ball exited — release it
        result.ball._inTube  = null;
        result.ball.pinned   = false;
        result.ball.inFlight = true;
      }
    }
  }

  // ── Snap check: returns nearest socket pair within snap distance ──────────
  checkSnap(dragTube) {
    dragTube._snapHighlight = null;
    var snapDist = this.SNAP_DIST;
    var best = null, bestD = snapDist;
    var dragSocks = [dragTube.socketA(), dragTube.socketB()];
    for (var ti = 0; ti < this.tubes.length; ti++) {
      var other = this.tubes[ti];
      if (other === dragTube) continue;
      var otherSocks = [other.socketA(), other.socketB()];
      for (var di = 0; di < dragSocks.length; di++) {
        for (var oi = 0; oi < otherSocks.length; oi++) {
          var d = Math.hypot(dragSocks[di].x - otherSocks[oi].x, dragSocks[di].y - otherSocks[oi].y);
          if (d < bestD) { bestD = d; best = { drag: dragSocks[di], other: otherSocks[oi], dist: d }; }
        }
      }
    }
    if (best) {
      dragTube._snapHighlight = best.other;
      return best;
    }
    return null;
  }

  // ── Apply snap: move dragTube so its socket aligns with target socket ─────
  applySnap(dragTube, snapResult, snapRotation) {
    var ds = snapResult.drag, os = snapResult.other;
    var dx = os.x - ds.x, dy = os.y - ds.y;
    dragTube.x += dx; dragTube.y += dy;
    if (snapRotation) {
      // Align entry/exit angles so they face each other
      var targetAngle = os.angle + Math.PI;
      var currentAngle = ds.angle;
      dragTube.rotation += targetAngle - currentAngle;
    }
    dragTube.rebuild();
  }

  // ── Draw (split by layer) ─────────────────────────────────────────────────
  draw(ctx, layer, frame, selectedTube) {
    for (var ti = 0; ti < this.tubes.length; ti++) {
      var tube = this.tubes[ti];
      if (tube.layer !== layer) continue;
      tube.draw(ctx, frame, tube === selectedTube);
    }
  }

  // ── Serialise for level save ──────────────────────────────────────────────
  toJSON() {
    return this.tubes.map(function(t) {
      return { type:t.type, x:t.x, y:t.y, rotation:t.rotation, length:t.length,
               radius:t.radius, speedMod:t.speedMod, style:t.style, layer:t.layer, color:t.color, id:t.id };
    });
  }

  fromJSON(arr) {
    this.tubes = arr.map(function(d) { return new TubePiece(d.type, d.x, d.y, d.rotation, d); });
  }
}

window.TubePiece   = TubePiece;
window.TubeManager = TubeManager;
})();
