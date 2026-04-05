window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {};
window.PUZZBALLS_FILE_VERSION['tubes.js'] = 1437;
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
      // Apply speed modifier — minimum exit speed so ball doesn't dribble
      var spd  = Math.max(3, Math.hypot(ball.vx, ball.vy));
      var newSpd = Math.max(3, spd * this.speedMod);
      var exitAngle = exitSocket.angle + (exitA ? Math.PI : 0);
      ball.vx = Math.cos(exitAngle) * newSpd;
      ball.vy = Math.sin(exitAngle) * newSpd;
      ball.inFlight = true;
      // Nudge ball well outside tube to prevent immediate re-capture
      ball.x = exitSocket.x + Math.cos(exitAngle) * (this.radius + ball.r + 6);
      ball.y = exitSocket.y + Math.sin(exitAngle) * (this.radius + ball.r + 6);
      // Short cooldown before this ball can re-enter any tube
      ball._tubeExitCooldown = 20;  // frames
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
    if (ball._tubeExitCooldown && ball._tubeExitCooldown > 0) return false;  // recently exited
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

  // ── Offset path: shift all points perpendicular to path direction ────────────
  _offsetPath(pts, offset) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      // Tangent from neighbours
      var prev = pts[Math.max(0, i-1)], next = pts[Math.min(pts.length-1, i+1)];
      var tx = next.x - prev.x, ty = next.y - prev.y;
      var len = Math.hypot(tx, ty) || 1;
      // Perpendicular (90° CCW from tangent)
      var nx = -ty / len, ny = tx / len;
      out.push({ x: pts[i].x + nx * offset, y: pts[i].y + ny * offset });
    }
    return out;
  }

  // ── Draw ellipse cap at tube opening ─────────────────────────────────────────
  _drawCap(ctx, cx, cy, angle, tubeR, cr, cg, cb, alpha, style) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // The cap is an ellipse — squashed on X axis to simulate perspective
    var rx = tubeR * 0.35, ry = tubeR;
    // Dark interior
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,2,10,' + (alpha * (style === 'solid' ? 0.95 : 0.55)) + ')';
    ctx.fill();
    // Outer rim glow
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha * 0.9) + ')';
    ctx.lineWidth = style === 'solid' ? 2.5 : 1.8;
    ctx.shadowColor = 'rgba(' + cr + ',' + cg + ',' + cb + ',0.8)';
    ctx.shadowBlur = style === 'solid' ? 10 : 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Inner wall ring (tube wall thickness illusion)
    if (style !== 'solid') {
      ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.55, ry * 0.85, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha * 0.35) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Specular highlight dot
    ctx.beginPath(); ctx.arc(rx * 0.3, -ry * 0.45, ry * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,' + (alpha * (style === 'glass' ? 0.7 : 0.4)) + ')';
    ctx.fill();
    ctx.restore();
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────
  draw(ctx, frame, isEditorSelected) {
    if (!this._path || this._path.length < 2) return;
    ctx.save();

    var color = this._tubeColor();
    var cr = parseInt(color.slice(1,3),16)||0;
    var cg = parseInt(color.slice(3,5),16)||0;
    var cb = parseInt(color.slice(5,7),16)||0;
    var tubeR  = this.radius;
    var alpha  = this.layer === 'behind' ? 0.50 : 1.0;
    var pts    = this._path;
    var style  = this.style;

    if (this.type === 'funnel') {
      this._drawFunnel(ctx, color, alpha);
    } else if (style === 'energy') {
      this._drawEnergy(ctx, frame, cr, cg, cb, alpha, pts, tubeR);
    } else {
      // ── Compute offset edge paths ─────────────────────────────────────────────
      var edgeA = this._offsetPath(pts, -tubeR);   // "top" edge
      var edgeB = this._offsetPath(pts,  tubeR);   // "bottom" edge

      // ── Tube body fill ────────────────────────────────────────────────────────
      // Build closed polygon from edgeA forward + edgeB backward
      ctx.beginPath();
      ctx.moveTo(edgeA[0].x, edgeA[0].y);
      for (var i = 1; i < edgeA.length; i++) ctx.lineTo(edgeA[i].x, edgeA[i].y);
      for (var i = edgeB.length - 1; i >= 0; i--) ctx.lineTo(edgeB[i].x, edgeB[i].y);
      ctx.closePath();
      var bodyAlpha = style === 'glass' ? 0.06 : style === 'window' ? 0.22 : 0.75;
      ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha * bodyAlpha) + ')';
      ctx.fill();

      // ── Outer glow (wide soft halo along both edges) ──────────────────────────
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      [edgeA, edgeB].forEach(function(edge) {
        ctx.beginPath(); ctx.moveTo(edge[0].x, edge[0].y);
        for (var i = 1; i < edge.length; i++) ctx.lineTo(edge[i].x, edge[i].y);
        ctx.lineWidth   = style === 'solid' ? 6 : 5;
        ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha * 0.18) + ')';
        ctx.shadowColor = 'rgba(' + cr + ',' + cg + ',' + cb + ',0.4)';
        ctx.shadowBlur  = style === 'solid' ? 12 : 8;
        ctx.stroke();
        ctx.shadowBlur  = 0;
      });

      // ── Bright rim line on both edges ─────────────────────────────────────────
      [edgeA, edgeB].forEach(function(edge) {
        ctx.beginPath(); ctx.moveTo(edge[0].x, edge[0].y);
        for (var i = 1; i < edge.length; i++) ctx.lineTo(edge[i].x, edge[i].y);
        ctx.lineWidth   = style === 'solid' ? 2.2 : 1.4;
        ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha * (style === 'solid' ? 0.95 : 0.80)) + ')';
        ctx.shadowColor = 'rgba(' + cr + ',' + cg + ',' + cb + ',0.9)';
        ctx.shadowBlur  = style === 'solid' ? 8 : 5;
        ctx.stroke();
        ctx.shadowBlur  = 0;
      });

      // ── Inner wall line (slightly inset — tube wall thickness illusion) ───────
      if (style !== 'solid') {
        var edgeAi = this._offsetPath(pts, -(tubeR * 0.72));
        var edgeBi = this._offsetPath(pts,  (tubeR * 0.72));
        [edgeAi, edgeBi].forEach(function(edge) {
          ctx.beginPath(); ctx.moveTo(edge[0].x, edge[0].y);
          for (var i = 1; i < edge.length; i++) ctx.lineTo(edge[i].x, edge[i].y);
          ctx.lineWidth   = 0.8;
          ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha * 0.30) + ')';
          ctx.stroke();
        });
      }

      // ── Specular gloss stripe (upper edge — sells the cylindrical glass look) ─
      if (style === 'glass' || style === 'window') {
        var glossEdge = this._offsetPath(pts, -(tubeR * 0.48));
        ctx.beginPath(); ctx.moveTo(glossEdge[0].x, glossEdge[0].y);
        for (var i = 1; i < glossEdge.length; i++) ctx.lineTo(glossEdge[i].x, glossEdge[i].y);
        ctx.lineWidth   = style === 'glass' ? tubeR * 0.22 : tubeR * 0.10;
        ctx.strokeStyle = 'rgba(220,235,255,' + (alpha * (style === 'glass' ? 0.38 : 0.18)) + ')';
        ctx.stroke();
        // Extra thin bright highlight at the very top
        var glossThin = this._offsetPath(pts, -(tubeR * 0.60));
        ctx.beginPath(); ctx.moveTo(glossThin[0].x, glossThin[0].y);
        for (var i = 1; i < glossThin.length; i++) ctx.lineTo(glossThin[i].x, glossThin[i].y);
        ctx.lineWidth   = 1.0;
        ctx.strokeStyle = 'rgba(255,255,255,' + (alpha * 0.55) + ')';
        ctx.stroke();
      }

      // ── Window strip (semi-opaque frosted band down center) ───────────────────
      if (style === 'window') {
        var winEdgeA = this._offsetPath(pts, -(tubeR * 0.22));
        var winEdgeB = this._offsetPath(pts,  (tubeR * 0.22));
        ctx.beginPath(); ctx.moveTo(winEdgeA[0].x, winEdgeA[0].y);
        for (var i = 1; i < winEdgeA.length; i++) ctx.lineTo(winEdgeA[i].x, winEdgeA[i].y);
        for (var i = winEdgeB.length - 1; i >= 0; i--) ctx.lineTo(winEdgeB[i].x, winEdgeB[i].y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(180,210,255,' + (alpha * 0.14) + ')';
        ctx.fill();
      }

      // ── End caps ──────────────────────────────────────────────────────────────
      var sockA = this.socketA(), sockB = this.socketB();
      // Cap ellipse major axis must be perpendicular to tube direction.
      // sockA.angle points outward from the tube end. The cap rotation
      // should align the ellipse's tall axis (ry) with the tube cross-section,
      // meaning we rotate by sockA.angle itself (the ellipse is drawn vertically
      // in local space, then rotated into world space along the tube direction).
      this._drawCap(ctx, sockA.x, sockA.y, sockA.angle, tubeR, cr, cg, cb, alpha, style);
      this._drawCap(ctx, sockB.x, sockB.y, sockB.angle, tubeR, cr, cg, cb, alpha, style);
    }

    // ── Draw ball inside tube ─────────────────────────────────────────────────
    if (this._ball) {
      var ballPos = this._pointAtT(this._ballT);
      var bs = window.BallSettings && BallSettings[this._ball.type] || {};
      var bGlow = bs.glow || '#ffffff';
      if (style === 'solid') {
        // Solid: just a glow pulse at the exit end so you know it's coming
        var exitPt = this._pointAtT(this._ballT > 0.5 ? 0.95 : 0.05);
        ctx.beginPath(); ctx.arc(exitPt.x, exitPt.y, tubeR * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = bGlow + '44';
        ctx.shadowColor = bGlow; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
      } else {
        var bAlpha = style === 'glass' ? 0.92 : 0.65;
        ctx.beginPath(); ctx.arc(ballPos.x, ballPos.y, this._ball.r * 0.80, 0, Math.PI * 2);
        ctx.fillStyle = bGlow + Math.round(bAlpha * 255).toString(16).padStart(2,'0');
        ctx.shadowColor = bGlow; ctx.shadowBlur = 10;
        ctx.fill(); ctx.shadowBlur = 0;
        // Small specular dot on ball
        ctx.beginPath(); ctx.arc(ballPos.x - this._ball.r*0.25, ballPos.y - this._ball.r*0.28, this._ball.r*0.18, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
      }
    }

    // ── Behind-layer darkening overlay ────────────────────────────────────────
    if (this.layer === 'behind' && this.type !== 'funnel') {
      var eA2 = this._offsetPath(pts, -tubeR), eB2 = this._offsetPath(pts, tubeR);
      ctx.beginPath(); ctx.moveTo(eA2[0].x, eA2[0].y);
      for (var i = 1; i < eA2.length; i++) ctx.lineTo(eA2[i].x, eA2[i].y);
      for (var i = eB2.length-1; i >= 0; i--) ctx.lineTo(eB2[i].x, eB2[i].y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,20,0.32)'; ctx.fill();
    }

    // ── Snap proximity glow on end caps ───────────────────────────────────────
    // When a snap target is detected, the matching cap glows bright instead of
    // showing separate indicator circles
    if (this._snapHighlight) {
      // Determine which socket is snapping
      var sA = this.socketA(), sB = this.socketB();
      var glowSock = (Math.hypot(sA.x - this._snapHighlight.x, sA.y - this._snapHighlight.y) <
                      Math.hypot(sB.x - this._snapHighlight.x, sB.y - this._snapHighlight.y)) ? sA : sB;
      ctx.beginPath(); ctx.arc(glowSock.x, glowSock.y, tubeR + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 14;
      ctx.stroke(); ctx.shadowBlur = 0;
    }

    // ── Editor selection highlight ────────────────────────────────────────────
    if (isEditorSelected && this.type !== 'funnel') {
      var eAS = this._offsetPath(pts, -tubeR-3), eBS = this._offsetPath(pts, tubeR+3);
      ctx.beginPath(); ctx.moveTo(eAS[0].x, eAS[0].y);
      for (var i=1;i<eAS.length;i++) ctx.lineTo(eAS[i].x, eAS[i].y);
      for (var i=eBS.length-1;i>=0;i--) ctx.lineTo(eBS[i].x, eBS[i].y);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,100,0.5)'; ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ffff44'; ctx.shadowBlur = 6;
      ctx.stroke(); ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // ── Energy style (accelerator) — animated rings + sparks ─────────────────────
  _drawEnergy(ctx, frame, cr, cg, cb, alpha, pts, tubeR) {
    var eA = this._offsetPath(pts, -tubeR), eB = this._offsetPath(pts, tubeR);
    // Body fill
    ctx.beginPath(); ctx.moveTo(eA[0].x, eA[0].y);
    for (var i=1;i<eA.length;i++) ctx.lineTo(eA[i].x, eA[i].y);
    for (var i=eB.length-1;i>=0;i--) ctx.lineTo(eB[i].x, eB[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha * 0.08) + ')'; ctx.fill();
    // Edge glow
    [eA, eB].forEach(function(edge) {
      ctx.beginPath(); ctx.moveTo(edge[0].x, edge[0].y);
      for (var i=1;i<edge.length;i++) ctx.lineTo(edge[i].x, edge[i].y);
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba('+cr+','+cg+','+cb+','+alpha+')';
      ctx.shadowColor = 'rgba('+cr+','+cg+','+cb+',1)'; ctx.shadowBlur = 10;
      ctx.stroke(); ctx.shadowBlur = 0;
    });
    // Animated cross rings spaced along path
    var ringCount = Math.max(3, Math.floor(this._pathLen / 28));
    for (var ri = 0; ri < ringCount; ri++) {
      var tRing = ((ri / ringCount) + (frame * 0.008)) % 1.0;
      var rpt = this._pointAtT(tRing);
      var prevPt = this._pointAtT(Math.max(0, tRing - 0.02));
      var tang = Math.atan2(rpt.y - prevPt.y, rpt.x - prevPt.x);
      var pulse = 0.6 + 0.4 * Math.sin(frame * 0.15 + ri * 1.4);
      ctx.save(); ctx.translate(rpt.x, rpt.y); ctx.rotate(tang);  // align cross-section to path
      ctx.beginPath(); ctx.ellipse(0, 0, tubeR * 0.32, tubeR, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba('+cr+','+cg+','+cb+','+(alpha * pulse * 0.85)+')';
      ctx.lineWidth = 1.2; ctx.shadowColor = 'rgba('+cr+','+cg+','+cb+',0.8)';
      ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.restore();
    }
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
    if (this.color) return this.color;
    if (this.style === 'energy' || this.speedMod > 1.5) return '#ff8800';  // hot orange
    if (this.speedMod > 1.15) return '#ff6600';   // accelerator
    if (this.speedMod < 0.85) return '#4466ff';   // decelerator
    return '#00ccff';                              // neutral
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

  // ── Update all tubes + handle captures + exterior collisions ─────────────
  update(balls) {
    var self = this;
    // Tick exit cooldowns
    for (var bi2 = 0; bi2 < balls.length; bi2++) {
      if (balls[bi2]._tubeExitCooldown > 0) balls[bi2]._tubeExitCooldown--;
    }
    // Try to capture free balls into tube ends
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
        result.ball._inTube  = null;
        result.ball.pinned   = false;
        result.ball.inFlight = true;
      }
    }
    // Exterior collision — balls bounce off tube outer surface
    for (var ti = 0; ti < this.tubes.length; ti++) {
      var tube = this.tubes[ti];
      var pts  = tube._path;
      if (!pts || pts.length < 2) continue;
      var tubeR = tube.radius;
      for (var bi = 0; bi < balls.length; bi++) {
        var ball = balls[bi];
        if (ball.dead || (ball._inTube === tube)) continue;
        // Check distance from ball to each path segment
        for (var pi = 0; pi < pts.length - 1; pi++) {
          var ax = pts[pi].x, ay = pts[pi].y;
          var bx2 = pts[pi+1].x, by2 = pts[pi+1].y;
          var dx = bx2 - ax, dy2 = by2 - ay;
          var segLen = Math.hypot(dx, dy2);
          if (segLen < 0.001) continue;
          var t = Math.max(0, Math.min(1, ((ball.x-ax)*dx + (ball.y-ay)*dy2) / (segLen*segLen)));
          var cpx = ax + t*dx, cpy = ay + t*dy2;
          var dist = Math.hypot(ball.x - cpx, ball.y - cpy);
          var minDist = tubeR + ball.r;
          if (dist < minDist && dist > 0.1) {
            // Push ball out
            var nx2 = (ball.x - cpx) / dist, ny2 = (ball.y - cpy) / dist;
            var overlap = minDist - dist;
            ball.x += nx2 * overlap;
            ball.y += ny2 * overlap;
            // Reflect velocity component along normal
            var dot = ball.vx * nx2 + ball.vy * ny2;
            if (dot < 0) {
              var bounce = 0.55;
              ball.vx -= (1 + bounce) * dot * nx2;
              ball.vy -= (1 + bounce) * dot * ny2;
            }
            break;
          }
        }
      }
    }
  }

  // ── Connection system ─────────────────────────────────────────────────────
  // Connect two tube sockets permanently
  connect(tubeA, sideA, tubeB, sideB) {
    // Store mutual references
    if (sideA === 'A') tubeA.connectedA = { tube: tubeB, side: sideB };
    else               tubeA.connectedB = { tube: tubeB, side: sideB };
    if (sideB === 'A') tubeB.connectedA = { tube: tubeA, side: sideA };
    else               tubeB.connectedB = { tube: tubeA, side: sideA };
  }

  // Disconnect a tube from all its connections
  disconnect(tube) {
    var self = this;
    ['connectedA','connectedB'].forEach(function(slot) {
      var conn = tube[slot];
      if (!conn) return;
      var other = conn.tube;
      if (other.connectedA && other.connectedA.tube === tube) other.connectedA = null;
      if (other.connectedB && other.connectedB.tube === tube) other.connectedB = null;
      tube[slot] = null;
    });
  }

  // When dragging a connected tube: pivot around the joint if dragging the free end
  dragConnected(tube, pos, dragOffX, dragOffY) {
    var conn = tube.connectedA || tube.connectedB;
    if (!conn) return false;  // not connected — normal drag
    // Pivot point = the connected socket position
    var pivotSock = (tube.connectedA && tube.connectedA.tube) ? tube.socketA() : tube.socketB();
    var pivotX = pivotSock.x, pivotY = pivotSock.y;
    // Angle from pivot to new drag position
    var newAngle = Math.atan2((pos.y - dragOffY) - pivotY, (pos.x - dragOffX) - pivotX);
    var origAngle = Math.atan2(tube.y - pivotY, tube.x - pivotX);
    var deltaAngle = newAngle - origAngle;
    tube.rotation += deltaAngle;
    // Move center to maintain pivot
    var armLen = Math.hypot(tube.x - pivotX, tube.y - pivotY);
    tube.x = pivotX + Math.cos(newAngle) * armLen;
    tube.y = pivotY + Math.sin(newAngle) * armLen;
    tube.rebuild();
    return true;
  }

  // ── Snap check ───────────────────────────────────────────────────────────
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
          if (d < bestD) { bestD = d; best = { drag: dragSocks[di], other: otherSocks[oi], dist: d,
            dragSide: di === 0 ? 'A' : 'B', otherSide: oi === 0 ? 'A' : 'B', otherTube: other }; }
        }
      }
    }
    if (best) {
      dragTube._snapHighlight = best.other;
      return best;
    }
    return null;
  }

  // ── Apply snap and connect ────────────────────────────────────────────────
  applySnap(dragTube, snapResult, snapRotation) {
    var ds = snapResult.drag, os = snapResult.other;
    var dx = os.x - ds.x, dy = os.y - ds.y;
    dragTube.x += dx; dragTube.y += dy;
    if (snapRotation) {
      var targetAngle = os.angle + Math.PI;
      dragTube.rotation += targetAngle - ds.angle;
    }
    dragTube.rebuild();
    // Lock the connection
    this.connect(dragTube, snapResult.dragSide, snapResult.otherTube, snapResult.otherSide);
    dragTube._snapHighlight = null;
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
