window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {};
window.PUZZBALLS_FILE_VERSION['tubes.js'] = 1626;
// ── Tube render debug flags (toggled by in-game debug panel) ──────────────────
window.TUBE_DEBUG = window.TUBE_DEBUG || {
  bodyFill:     true,
  outerGlow:    true,
  mainWall:     true,
  highlight:    true,
  gloss:        true,
  jointFillet:  true,
  endCaps:      true,
  capDarkFill:  true,  // Dark interior ellipse at tube mouth
  bodyFillMult: 1.0,  // Debug multiplier for body fill alpha (1.0 = normal)
};
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
    // Global tube speed multiplier (non-energy tubes only — energy uses own speedMod)
    var globalMult = (this.style !== 'energy') ? (window._tubeSpeedMult !== undefined ? window._tubeSpeedMult : 1.0) : 1.0;
    var spf = this._pathLen > 0 ? 1 / this._pathLen : 0.05;
    this._ballT += this._ballV * globalMult * spf * this._ballDir;
    var done  = this._ballT >= 1 || this._ballT <= 0;
    var exitA = this._ballT <= 0;
    if (done) {
      var ball = this._ball;
      this._ball = null;
      var exitSocket = exitA ? this.socketA() : this.socketB();
      // Apply speed modifier — only for energy tubes; others preserve ball speed
      var newSpd = (this.style === 'energy') ? Math.max(3, this._ballV * this.speedMod) : this._ballV;
      var exitAngle = exitSocket.angle;
      ball.vx = Math.cos(exitAngle) * newSpd;
      ball.vy = Math.sin(exitAngle) * newSpd;
      ball.inFlight = true;
      // Position ball at path endpoint — avoids position snap vs socket + offset
      var exitPtEnd = this._pointAtT(exitA ? 0 : 1);
      ball.x = exitPtEnd.x + Math.cos(exitAngle) * (ball.r + 2);
      ball.y = exitPtEnd.y + Math.sin(exitAngle) * (ball.r + 2);
      ball._tubeExitFrom = this.id;
      ball._tubeExitCooldown = 28;
      return { ball: ball, socket: exitSocket, exitA: exitA };
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
    if (ball._tubeExitCooldown && ball._tubeExitCooldown > 0 && ball._tubeExitFrom === this.id) return false;
    for (var s = 0; s <= 1; s++) {
      var sock = s === 0 ? this.socketA() : this.socketB();
      var dist = Math.hypot(ball.x - sock.x, ball.y - sock.y);
      var threshold = (this.type === 'funnel') ? this.radius * 3 : this.radius + ball.r + 2;
      if (dist < threshold) {
        // Energy tubes: one-way only — entry from socket A only
        if (this.style === 'energy' && s === 1) {
          var repelAngle = sock.angle;
          var repelSpd = Math.hypot(ball.vx, ball.vy);
          ball.vx = Math.cos(repelAngle) * repelSpd * 1.2;
          ball.vy = Math.sin(repelAngle) * repelSpd * 1.2;
          ball.x += Math.cos(repelAngle) * (threshold - dist + 4);
          ball.y += Math.sin(repelAngle) * (threshold - dist + 4);
          return false;
        }
        // For non-energy tubes: strict cone check — tighter at connected sockets
        var inwardAngle = sock.angle + Math.PI;
        var ballAngle   = Math.atan2(ball.vy, ball.vx);
        var diff = Math.abs(((ballAngle - inwardAngle) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        // Connected sockets get tighter cone (0.40) to prevent joint eating
        var isConnected = (s === 0 && this.connectedA) || (s === 1 && this.connectedB);
        var maxCone = isConnected ? Math.PI * 0.40 : Math.PI * 0.60;
        // Also require minimum approach speed
        var approachSpd = Math.hypot(ball.vx, ball.vy);
        if ((diff < maxCone || this.type === 'funnel') && approachSpd > 1.5) {
          this._ball    = ball;
          this._ballT   = s === 0 ? 0 : 1;
          this._ballDir = s === 0 ? 1 : -1;
          this._ballV   = Math.hypot(ball.vx, ball.vy);
          ball._inTube  = this;
          ball.pinned   = true;
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

  // ── Silhouette outline for highlight rendering ────────────────────────────────
  // Uses _trimmedEdgeA/B (set during draw) so walls stop exactly at joint boundaries.
  // Free ends get ellipse caps. Connected ends just stop — fillet covers the gap.
  _silhouettePath(ctx, offset) {
    var pts = this._path;
    if (!pts || pts.length < 2) return;
    var r  = this.radius + offset;
    var sockA = this.socketA(), sockB = this.socketB();
    var rx = r * 0.35, ry = r;
    var STEPS = 14;

    // Use trimmed edges if available (set during draw), else recompute
    var baseA = this._trimmedEdgeA, baseB = this._trimmedEdgeB;
    var eA, eB;
    if (baseA && baseB && baseA.length >= 2 && baseB.length >= 2) {
      // Re-offset the trimmed centerline by the extra highlight offset amount
      // Simple approach: offset each trimmed point by the extra (offset) amount
      // using the same perpendicular logic as _offsetPath
      var extra = offset; // extra pixels beyond tubeR
      eA = baseA.map(function(p, i, arr) {
        var prev = arr[Math.max(0, i-1)], next = arr[Math.min(arr.length-1, i+1)];
        var tx = next.x - prev.x, ty = next.y - prev.y, l = Math.hypot(tx,ty)||1;
        return { x: p.x + (-ty/l)*extra, y: p.y + (tx/l)*extra };
      });
      eB = baseB.map(function(p, i, arr) {
        var prev = arr[Math.max(0, i-1)], next = arr[Math.min(arr.length-1, i+1)];
        var tx = next.x - prev.x, ty = next.y - prev.y, l = Math.hypot(tx,ty)||1;
        return { x: p.x + (-ty/l)*(-extra), y: p.y + (tx/l)*(-extra) };
      });
    } else {
      eA = this._offsetPath(pts, -r);
      eB = this._offsetPath(pts,  r);
    }

    function cap(sock) {
      var out = [], ca = Math.cos(sock.angle), sa = Math.sin(sock.angle);
      for (var s = 0; s <= STEPS; s++) {
        var t = Math.PI / 2 - Math.PI * s / STEPS;
        var lx = rx * Math.cos(t), ly = ry * Math.sin(t);
        out.push({ x: sock.x + ca*lx - sa*ly, y: sock.y + sa*lx + ca*ly });
      }
      return out;
    }

    var freeA = !this.connectedA, freeB = !this.connectedB;

    if (freeA && freeB) {
      ctx.beginPath();
      ctx.moveTo(eA[0].x, eA[0].y);
      for (var i = 1; i < eA.length; i++) ctx.lineTo(eA[i].x, eA[i].y);
      var cB = cap(sockB);
      for (var i = 0; i < cB.length; i++) ctx.lineTo(cB[i].x, cB[i].y);
      for (var i = eB.length - 2; i >= 0; i--) ctx.lineTo(eB[i].x, eB[i].y);
      var cA = cap(sockA);
      for (var i = 0; i < cA.length; i++) ctx.lineTo(cA[i].x, cA[i].y);
      ctx.closePath();
    } else {
      // Wall A
      ctx.beginPath();
      ctx.moveTo(eA[0].x, eA[0].y);
      for (var i = 1; i < eA.length; i++) ctx.lineTo(eA[i].x, eA[i].y);
      // Wall B (separate subpath)
      ctx.moveTo(eB[eB.length-1].x, eB[eB.length-1].y);
      for (var i = eB.length - 2; i >= 0; i--) ctx.lineTo(eB[i].x, eB[i].y);
      // Free end caps only
      if (freeB) {
        ctx.moveTo(eA[eA.length-1].x, eA[eA.length-1].y);
        var cB2 = cap(sockB);
        for (var i = 0; i < cB2.length; i++) ctx.lineTo(cB2[i].x, cB2[i].y);
      }
      if (freeA) {
        ctx.moveTo(eB[0].x, eB[0].y);
        var cA2 = cap(sockA);
        for (var i = 0; i < cA2.length; i++) ctx.lineTo(cA2[i].x, cA2[i].y);
      }
    }
  }


  _drawCap(ctx, cx, cy, angle, tubeR, cr, cg, cb, alpha, style) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // The cap is an ellipse — squashed on X axis to simulate perspective
    var rx = tubeR * 0.35, ry = tubeR;
    // Dark interior
    if (window.TUBE_DEBUG.capDarkFill) {
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,2,10,' + (alpha * (style === 'solid' ? 0.95 : 0.55)) + ')';
      ctx.fill();
    }
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

      // ── Per-wall trim at connected sockets ─────────────────────────────────
      // Uses the same bisector math as _drawOneJoint to determine inside/outside.
      // Inside wall (acute angle side) trimmed more at sharper angles.
      // Outside wall gets minimal trim (1 point).
      var _trimConn = function(myPts, eA, eB, conn, isStart, tR) {
        var other = conn.tube, oSide = conn.side;
        var oPts = other._path;
        if (!oPts || oPts.length < 2) return { a: eA, b: eB };

        // Centerline directions INTO each tube (same as _drawOneJoint)
        var myIdx = isStart ? 0 : myPts.length - 1;
        var myIn  = isStart ? Math.min(4, myPts.length - 1) : Math.max(myPts.length - 5, 0);
        var mDx = myPts[myIn].x - myPts[myIdx].x, mDy = myPts[myIn].y - myPts[myIdx].y;
        var mL = Math.hypot(mDx, mDy) || 1; mDx /= mL; mDy /= mL;

        var oIdx = oSide === 'A' ? 0 : oPts.length - 1;
        var oIn  = oSide === 'A' ? Math.min(4, oPts.length - 1) : Math.max(oPts.length - 5, 0);
        var oDx = oPts[oIn].x - oPts[oIdx].x, oDy = oPts[oIn].y - oPts[oIdx].y;
        var oL = Math.hypot(oDx, oDy) || 1; oDx /= oL; oDy /= oL;

        // Bisector of the two tube directions
        var bsX = mDx + oDx, bsY = mDy + oDy;
        var bsL = Math.hypot(bsX, bsY);
        var mNx = -mDy, mNy = mDx; // my perpendicular

        // Bend angle
        var dotV = mDx * oDx + mDy * oDy;
        dotV = Math.max(-1, Math.min(1, dotV));
        var bendAngle = Math.acos(dotV);

        // Nearly straight connection (< ~10°) — equal minimal trim, no inside/outside
        if (bendAngle < 0.18 || bsL < 0.001) {
          var eqTrim = 2;
          if (isStart) {
            eA = eA.slice(eqTrim);
            eB = eB.slice(eqTrim);
          } else {
            eA = eA.slice(0, eA.length - eqTrim);
            eB = eB.slice(0, eB.length - eqTrim);
          }
          return { a: eA, b: eB };
        }

        bsX /= bsL; bsY /= bsL;

        // Joint point
        var jxx = myPts[myIdx].x, jyy = myPts[myIdx].y;

        // edgeA is at -tubeR perpendicular, edgeB is at +tubeR perpendicular
        var ptA = { x: jxx - mNx * tR, y: jyy - mNy * tR }; // edgeA endpoint at joint
        var ptB = { x: jxx + mNx * tR, y: jyy + mNy * tR }; // edgeB endpoint at joint

        // Project onto bisector — lower projection = inside (opposite bisector dir)
        var projA = (ptA.x - jxx) * bsX + (ptA.y - jyy) * bsY;
        var projB = (ptB.x - jxx) * bsX + (ptB.y - jyy) * bsY;
        var edgeAisInside = projA < projB;

        // Inside trim: proportional to angle. At 90° trim ~tubeR distance
        var insideDist = tR * (bendAngle / (Math.PI / 2));
        insideDist = Math.max(2, Math.min(insideDist, tR * 2.5));
        // Outside also trims but less — enough to prevent body fill overlap
        var outsideDist = insideDist * 0.5;
        outsideDist = Math.max(2, outsideDist);

        // Convert distance to point count
        var _d2c = function(edge, fromStart, dist) {
          var cum = 0, cnt = 0;
          if (fromStart) {
            for (var k = 1; k < edge.length - 2 && cum < dist; k++) {
              cum += Math.hypot(edge[k].x - edge[k-1].x, edge[k].y - edge[k-1].y);
              cnt++;
            }
          } else {
            for (var k = edge.length - 2; k > 1 && cum < dist; k--) {
              cum += Math.hypot(edge[k+1].x - edge[k].x, edge[k+1].y - edge[k].y);
              cnt++;
            }
          }
          return Math.max(1, cnt);
        };

        var inCount  = _d2c(eA, isStart, insideDist);
        var outCount = _d2c(eA, isStart, outsideDist);
        var trimA = edgeAisInside ? inCount : outCount;
        var trimB = edgeAisInside ? outCount : inCount;

        if (isStart) {
          eA = eA.slice(trimA);
          eB = eB.slice(trimB);
        } else {
          eA = eA.slice(0, eA.length - trimA);
          eB = eB.slice(0, eB.length - trimB);
        }
        return { a: eA, b: eB };
      };

      if (this.connectedA && edgeA.length > 8) {
        var tr1 = _trimConn(pts, edgeA, edgeB, this.connectedA, true, tubeR);
        edgeA = tr1.a; edgeB = tr1.b;
      }
      if (this.connectedB && edgeA.length > 8) {
        var tr2 = _trimConn(pts, edgeA, edgeB, this.connectedB, false, tubeR);
        edgeA = tr2.a; edgeB = tr2.b;
      }
      // Cache trimmed edges so _drawOneJoint can use exact endpoints for fillet curves
      this._trimmedEdgeA = edgeA;
      this._trimmedEdgeB = edgeB;

      // ── Tube body fill ─────────────────────────────────────────────────────────────────────────────────────
      // Draw fill as a thick stroke along the centerline path — this naturally
      // stays within the tube walls and requires no polygon math.
      // lineWidth = tubeR*2 fills the full tube interior.
      // At connected ends, trim the path to stop at the joint center.
      if (window.TUBE_DEBUG.bodyFill) {
        var bodyAlpha = style === 'glass' ? 0.06 : style === 'window' ? 0.22 : 0.75;
        bodyAlpha *= (window.TUBE_DEBUG.bodyFillMult || 1.0);
        ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha * bodyAlpha) + ')';
        ctx.lineWidth = tubeR * 2;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';

        // Build a sub-path of pts trimmed at connected ends to the joint center
        var fillPts = pts.slice();
        var _ptsLen2 = fillPts.length;

        // Trim start (socket A) to joint center if connected.
        // Extend slightly PAST joint center so round caps overlap and cover the gap.
        if (this.connectedA) {
          var oPtsA = this.connectedA.tube._path;
          var oIdxA = this.connectedA.side === 'A' ? 0 : oPtsA.length - 1;
          var jxA = (fillPts[0].x + oPtsA[oIdxA].x) * 0.5;
          var jyA = (fillPts[0].y + oPtsA[oIdxA].y) * 0.5;
          // Remove points past joint center
          while (fillPts.length > 2) {
            var d2 = Math.hypot(fillPts[1].x - jxA, fillPts[1].y - jyA);
            var d0 = Math.hypot(fillPts[0].x - jxA, fillPts[0].y - jyA);
            if (d0 <= d2) break;
            fillPts.shift();
          }
          fillPts[0] = { x: jxA, y: jyA };
        }

        // Trim end (socket B) to joint center if connected
        if (this.connectedB) {
          var oPtsB = this.connectedB.tube._path;
          var oIdxB = this.connectedB.side === 'A' ? 0 : oPtsB.length - 1;
          var jxB = (fillPts[fillPts.length-1].x + oPtsB[oIdxB].x) * 0.5;
          var jyB = (fillPts[fillPts.length-1].y + oPtsB[oIdxB].y) * 0.5;
          while (fillPts.length > 2) {
            var last = fillPts.length - 1;
            var dLast = Math.hypot(fillPts[last].x - jxB, fillPts[last].y - jyB);
            var dPrev = Math.hypot(fillPts[last-1].x - jxB, fillPts[last-1].y - jyB);
            if (dLast <= dPrev) break;
            fillPts.pop();
          }
          fillPts[fillPts.length-1] = { x: jxB, y: jyB };
        }

        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(fillPts[0].x, fillPts[0].y);
        for (var i = 1; i < fillPts.length; i++) ctx.lineTo(fillPts[i].x, fillPts[i].y);
        ctx.stroke();
      }

      // ── Ball inside tube — drawn UNDER walls/highlights for 3D depth ─────────
      if (this._ball && style !== 'solid') {
        var ballPos0 = this._pointAtT(this._ballT);
        var bs0 = window.BallSettings && BallSettings[this._ball.type] || {};
        var bColor0 = bs0.color || '#4488ff';
        var bGlow0  = bs0.glow  || '#ffffff';
        var bR0 = this._ball.r * 0.85;
        ctx.save();
        // No clip — ball is masked by walls drawn on top; clipping caused visible cutoff at tube ends
        // Soft glow behind ball
        ctx.beginPath(); ctx.arc(ballPos0.x, ballPos0.y, bR0 + 4, 0, Math.PI * 2);
        ctx.fillStyle = bGlow0 + '33';
        ctx.shadowColor = bGlow0; ctx.shadowBlur = 10;
        ctx.fill(); ctx.shadowBlur = 0;
        // Main ball body
        ctx.beginPath(); ctx.arc(ballPos0.x, ballPos0.y, bR0, 0, Math.PI * 2);
        ctx.fillStyle = bColor0; ctx.fill();
        // Inner glow
        ctx.beginPath(); ctx.arc(ballPos0.x, ballPos0.y, bR0 * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = bGlow0 + '55'; ctx.fill();
        // Label
        var lbl0 = bs0.label ? bs0.label.slice(0,3).toUpperCase() : '';
        if (lbl0) {
          ctx.font = 'bold ' + Math.max(6, Math.round(bR0 * 0.85)) + 'px monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(lbl0, ballPos0.x, ballPos0.y);
        }
        ctx.restore();
      }

      // ── Thick opaque tube walls — drawn OVER ball so they clearly contain it ──
      // lineCap 'butt' ensures wall strokes stop exactly at the trim point and don't
      // bleed past it into the joint zone, which would stack alpha and create dark artifacts.
      ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      // Outer glow — reduced alpha for glass/window to limit stacking at joints
      var glowAlpha = style === 'glass' ? 0.10 : style === 'window' ? 0.14 : 0.22;
      if (window.TUBE_DEBUG.outerGlow) {
        [edgeA, edgeB].forEach(function(edge) {
          ctx.beginPath(); ctx.moveTo(edge[0].x, edge[0].y);
          for (var i = 1; i < edge.length; i++) ctx.lineTo(edge[i].x, edge[i].y);
          ctx.lineWidth   = style === 'solid' ? 8 : 7;
          ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha * glowAlpha) + ')';
          ctx.stroke();
        });
      }
      // Main wall — thick, opaque, covers ball outer edge
      if (window.TUBE_DEBUG.mainWall) {
        [edgeA, edgeB].forEach(function(edge) {
          ctx.beginPath(); ctx.moveTo(edge[0].x, edge[0].y);
          for (var i = 1; i < edge.length; i++) ctx.lineTo(edge[i].x, edge[i].y);
          ctx.lineWidth   = style === 'solid' ? 5 : 4;
          ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha * (style === 'solid' ? 0.95 : 0.75)) + ')';
          ctx.stroke();
        });
      }
      // Bright inner highlight on top edge only (gives depth/gloss)
      // Use whichever edge is higher on screen (lower Y = world-space top)
      var edgeAavgY = 0, edgeBavgY = 0;
      for (var hi = 0; hi < edgeA.length; hi++) edgeAavgY += edgeA[hi].y;
      for (var hi = 0; hi < edgeB.length; hi++) edgeBavgY += edgeB[hi].y;
      edgeAavgY /= edgeA.length; edgeBavgY /= edgeB.length;
      var highlightEdge = edgeAavgY < edgeBavgY ? edgeA : edgeB;
      if (window.TUBE_DEBUG.highlight) {
        ctx.beginPath(); ctx.moveTo(highlightEdge[0].x, highlightEdge[0].y);
        for (var i = 1; i < highlightEdge.length; i++) ctx.lineTo(highlightEdge[i].x, highlightEdge[i].y);
        ctx.lineWidth   = 1.5;
        ctx.strokeStyle = 'rgba(220,240,255,' + (alpha * (style === 'solid' ? 0.6 : 0.85)) + ')';
        ctx.stroke();
      }

      // ── Specular gloss stripe (gravity-aligned — always on world-space top) ──
      // Trimmed at connected ends to match wall trim depth, so the joint gloss
      // fillet can connect the two tubes' gloss endpoints cleanly.
      if (window.TUBE_DEBUG.gloss && (style === 'glass' || style === 'window')) {
        var glossUp = tubeR * 0.48;
        // Build trimmed gloss point arrays matching wall trim depth.
        // Use trimmed edge length vs full edge length to determine trim count.
        var _fullLen = this._offsetPath(pts, -tubeR).length;
        var _trimLen = this._trimmedEdgeA ? this._trimmedEdgeA.length : _fullLen;
        var _trimStartCount = this.connectedA ? (_fullLen - _trimLen) : 0;
        var _trimEndCount   = this.connectedB ? (_fullLen - _trimLen) : 0;
        // Recompute per-end trim if both ends connected (each trim is independent)
        if (this.connectedA && this.connectedB && this._trimmedEdgeA) {
          // Approximate: half the total trim on each end
          _trimStartCount = Math.floor((_fullLen - _trimLen) / 2);
          _trimEndCount   = _fullLen - _trimLen - _trimStartCount;
        }
        var _trimStart = Math.max(0, _trimStartCount);
        var _trimEnd   = Math.max(0, _trimEndCount);
        var _glossBasePts = pts.slice(_trimStart, _trimEnd > 0 ? pts.length - _trimEnd : pts.length);
        if (_glossBasePts.length < 2) _glossBasePts = pts;

        var glossPts = _glossBasePts.map(function(p) { return { x: p.x, y: p.y - glossUp }; });
        ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(glossPts[0].x, glossPts[0].y);
        for (var i = 1; i < glossPts.length; i++) ctx.lineTo(glossPts[i].x, glossPts[i].y);
        ctx.lineWidth   = style === 'glass' ? tubeR * 0.22 : tubeR * 0.10;
        ctx.strokeStyle = 'rgba(220,235,255,' + (alpha * (style === 'glass' ? 0.38 : 0.18)) + ')';
        ctx.stroke();
        // Extra thin bright line at very top
        var glossThinPts = _glossBasePts.map(function(p) { return { x: p.x, y: p.y - tubeR * 0.62 }; });
        ctx.beginPath(); ctx.moveTo(glossThinPts[0].x, glossThinPts[0].y);
        for (var i = 1; i < glossThinPts.length; i++) ctx.lineTo(glossThinPts[i].x, glossThinPts[i].y);
        ctx.lineWidth   = 1.0;
        ctx.strokeStyle = 'rgba(255,255,255,' + (alpha * 0.55) + ')';
        ctx.stroke();
        // Cache trimmed gloss endpoint for joint fillet to use
        this._glossEndA = glossPts[0];
        this._glossEndB = glossPts[glossPts.length - 1];
        this._glossThinEndA = glossThinPts[0];
        this._glossThinEndB = glossThinPts[glossThinPts.length - 1];
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

      // ── End caps (suppressed on connected sockets for seamless joints) ────────
      if (window.TUBE_DEBUG.endCaps) {
        var sockA = this.socketA(), sockB = this.socketB();
        if (!this.connectedA) {
          this._drawCap(ctx, sockA.x, sockA.y, sockA.angle, tubeR, cr, cg, cb, alpha, style);
        }
        if (!this.connectedB) {
          this._drawCap(ctx, sockB.x, sockB.y, sockB.angle, tubeR, cr, cg, cb, alpha, style);
        }
      }
    }

    // ── Draw ball inside tube (solid style only — glass/window drawn under edges above) ──
    if (this._ball && style === 'solid') {
      var exitPt = this._pointAtT(this._ballT > 0.5 ? 0.95 : 0.05);
      var bs = window.BallSettings && BallSettings[this._ball.type] || {};
      var bGlow = bs.glow || '#ffffff';
      ctx.beginPath(); ctx.arc(exitPt.x, exitPt.y, tubeR * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = bGlow + '44';
      ctx.shadowColor = bGlow; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
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
    // When a snap target is detected, the matching cap glows cyan instead of
    // drawing a separate indicator circle
    if (this._snapHighlight) {
      var sA = this.socketA(), sB = this.socketB();
      var glowSock = (Math.hypot(sA.x - this._snapHighlight.x, sA.y - this._snapHighlight.y) <
                      Math.hypot(sB.x - this._snapHighlight.x, sB.y - this._snapHighlight.y)) ? sA : sB;
      ctx.save();
      ctx.translate(glowSock.x, glowSock.y);
      ctx.rotate(glowSock.angle);
      var rx = tubeR * 0.35, ry = tubeR;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#00eeff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00eeff'; ctx.shadowBlur = 18;
      ctx.stroke();
      // Outer halo pass for extra glow
      ctx.beginPath(); ctx.ellipse(0, 0, rx + 3, ry + 3, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,238,255,0.25)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    } else {
      this._snapSoundPlayed = false;
    }

    // ── Group drag highlight ──────────────────────────────────────────────────
    if (this._groupHighlight && this.type !== 'funnel') {
      // Soft outer glow pass
      this._silhouettePath(ctx, 3);
      ctx.strokeStyle = 'rgba(0,220,255,0.15)'; ctx.lineWidth = 9;
      ctx.shadowColor = '#00eeff'; ctx.shadowBlur = 20;
      ctx.stroke(); ctx.shadowBlur = 0;
      // Crisp cyan outline
      this._silhouettePath(ctx, 2);
      ctx.strokeStyle = 'rgba(0,238,255,0.7)'; ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00eeff'; ctx.shadowBlur = 10;
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
    // ── End caps for energy tubes ────────────────────────────────────────────
    var sockA = this.socketA(), sockB = this.socketB();
    if (!this.connectedA) {
      this._drawCap(ctx, sockA.x, sockA.y, sockA.angle, tubeR, cr, cg, cb, alpha, 'energy');
    }
    if (!this.connectedB) {
      this._drawCap(ctx, sockB.x, sockB.y, sockB.angle, tubeR, cr, cg, cb, alpha, 'energy');
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
    if (this.style === 'energy') {
      // Orange = speeding up (>1.0), blue = slowing down (<1.0)
      return this.speedMod >= 1.0 ? '#ff8800' : '#4466ff';
    }
    return '#00ccff';  // neutral glass/window/solid
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
    // Advance balls in tubes + chain into connected tubes
    for (var ti = 0; ti < this.tubes.length; ti++) {
      var result = this.tubes[ti].update();
      if (result) {
        var exitedBall = result.ball;
        var exitedTube = this.tubes[ti];
        exitedBall._inTube  = null;
        exitedBall.pinned   = false;
        exitedBall.inFlight = true;

        // Socket-aware chaining: find the connected tube on the exit socket
        var exitSide = result.exitA ? 'A' : 'B';
        var connSlot = exitSide === 'A' ? exitedTube.connectedA : exitedTube.connectedB;

        if (connSlot && !connSlot.tube._ball) {
          var nextTube = connSlot.tube;
          var enterSide = connSlot.side;  // which socket of nextTube to enter

          // Directly inject ball into next tube from the correct socket
          nextTube._ball   = exitedBall;
          nextTube._ballT  = enterSide === 'A' ? 0 : 1;
          nextTube._ballDir = enterSide === 'A' ? 1 : -1;
          nextTube._ballV  = exitedBall._inTubeSpeed || Math.hypot(exitedBall.vx, exitedBall.vy);
          exitedBall._inTube = nextTube;
          exitedBall.pinned  = true;
          exitedBall.inFlight = false;
          exitedBall._tubeExitFrom = null;
          exitedBall._tubeExitCooldown = 0;
          // Place ball at entry socket position
          var entrySock = enterSide === 'A' ? nextTube.socketA() : nextTube.socketB();
          exitedBall.x = entrySock.x;
          exitedBall.y = entrySock.y;
        }
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
        if (ball.dead || ball._inTube) continue;  // skip any ball inside any tube
        if (ball._tubeExitCooldown && ball._tubeExitCooldown > 0) continue;  // skip recently exited
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
            var dot = ball.vx * nx2 + ball.vy * ny2;
            if (dot < 0) {
              // Sticky ball: stick to tube exterior
              var BT = window.BALL_TYPES;
              var BS = window.BallSettings;
              if (BT && ball.type === BT.STICKY && !ball.stuckTo && !ball._fromChute) {
                var spd2 = Math.hypot(ball.vx, ball.vy);
                var stickyThresh = (BS && BS.sticky && BS.sticky.stickThreshold) || 6;
                if (spd2 < stickyThresh) {
                  ball.vx = 0; ball.vy = 0; ball.inFlight = false;
                  ball.stuckTo = '_wall_';
                  ball._stickNx = nx2; ball._stickNy = ny2;
                  if (window.Sound && window.Sound.thud) window.Sound.thud(4);
                  break;
                }
              }
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

  // Get all tubes connected in a chain starting from the given tube
  getConnectedGroup(startTube) {
    var group = [];
    var visited = {};
    var queue = [startTube];
    while (queue.length > 0) {
      var t = queue.shift();
      if (visited[t.id]) continue;
      visited[t.id] = true;
      group.push(t);
      if (t.connectedA && !visited[t.connectedA.tube.id]) queue.push(t.connectedA.tube);
      if (t.connectedB && !visited[t.connectedB.tube.id]) queue.push(t.connectedB.tube);
    }
    return group;
  }

  // Find a joint point near the given position. Returns { x, y, tubes: [tubeA, tubeB] } or null
  findJointAt(px, py, threshold) {
    threshold = threshold || 20;
    for (var ti = 0; ti < this.tubes.length; ti++) {
      var tube = this.tubes[ti];
      var sides = ['connectedA', 'connectedB'];
      for (var si = 0; si < sides.length; si++) {
        var conn = tube[sides[si]];
        if (!conn) continue;
        var sock = sides[si] === 'connectedA' ? tube.socketA() : tube.socketB();
        if (Math.hypot(px - sock.x, py - sock.y) < threshold) {
          return { x: sock.x, y: sock.y, tube: tube };
        }
      }
    }
    return null;
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

  // When dragging a connected tube: pivot around the joint
  // pivotState must be pre-computed at drag start and passed each frame
  dragConnected(tube, pos, pivotState) {
    var conn = tube.connectedA || tube.connectedB;
    if (!conn || !pivotState) return false;
    var pivotX = pivotState.pivotX, pivotY = pivotState.pivotY;
    var armLen  = pivotState.armLen;

    // Angle from pivot to current finger position (adjusted by finger-to-center offset at start)
    var fingerAngle = Math.atan2(pos.y - pivotY, pos.x - pivotX);
    var newAngle = fingerAngle - pivotState.fingerToCenterAngle;

    // Absolute rotation: initial rotation + how much the arm has turned
    var rawRotation = pivotState.initRotation + (newAngle - pivotState.initArmAngle);
    var _clampedAngle = newAngle;

    // Apply candidate rotation and rebuild so socket angles are accurate
    tube.rotation = rawRotation;
    tube.x = pivotX + Math.cos(_clampedAngle) * armLen;
    tube.y = pivotY + Math.sin(_clampedAngle) * armLen;
    tube.rebuild();

    // Now clamp using actual socket angles (accurate for all tube types incl elbows)
    var conn = tube.connectedA || tube.connectedB;
    if (conn) {
      var mySide = tube.connectedA ? 'A' : 'B';
      var mySock = mySide === 'A' ? tube.socketA() : tube.socketB();
      // My socket faces outward; inward = outward + PI
      var myInAngle = mySock.angle + Math.PI;

      var partnerSock = conn.side === 'A' ? conn.tube.socketA() : conn.tube.socketB();
      var partnerOutAngle = partnerSock.angle;

      // Bend = angle between partner outward and my inward (how much we deviate from straight)
      var bendDiff = myInAngle - partnerOutAngle;
      bendDiff = ((bendDiff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

      var maxBend = Math.PI * 0.5; // 90 degrees
      var beyondLimit = Math.abs(bendDiff) > maxBend;
      // Only clamp if we started within the valid zone OR have since rotated into it.
      // This lets tubes connected at obtuse angles rotate freely until they hit ≤90°,
      // then the clamp kicks in to prevent going back past 90°.
      if (pivotState.startedBeyondLimit && beyondLimit) {
        // Started beyond limit and still beyond — update the "started" flag if we
        // crossed into valid at any point (track via pivotState)
        pivotState.startedBeyondLimit = true; // still beyond, keep flag
      } else if (pivotState.startedBeyondLimit && !beyondLimit) {
        // Crossed into valid zone — clear flag so clamp engages from here
        pivotState.startedBeyondLimit = false;
      } else if (!pivotState.startedBeyondLimit && beyondLimit) {
        // Was valid, now trying to go beyond — clamp it
        var excess = Math.abs(bendDiff) - maxBend;
        var sign = bendDiff > 0 ? -1 : 1;
        rawRotation += sign * excess;
        _clampedAngle += sign * excess;
        tube.rotation = rawRotation;
        tube.x = pivotX + Math.cos(_clampedAngle) * armLen;
        tube.y = pivotY + Math.sin(_clampedAngle) * armLen;
        tube.rebuild();
      }
    }
    return true;
  }

  // Compute pivot state at drag start — call once when drag begins
  makePivotState(tube, fingerX, fingerY) {
    var conn = tube.connectedA || tube.connectedB;
    if (!conn) return null;
    var pivotSock = tube.connectedA ? tube.socketA() : tube.socketB();
    var pivotX = pivotSock.x, pivotY = pivotSock.y;
    var armAngle = Math.atan2(tube.y - pivotY, tube.x - pivotX);
    var armLen   = Math.hypot(tube.x - pivotX, tube.y - pivotY);
    // fingerToCenterAngle: offset from finger to arm center at start
    var fingerAngle0 = Math.atan2(fingerY - pivotY, fingerX - pivotX);
    // Record whether we started beyond the 90° limit.
    // If so, allow free rotation until we rotate INTO the valid zone,
    // then enforce the limit (clamp only prevents valid→invalid, not invalid→valid).
    var _initBendAbs = Math.PI; // default: assume beyond limit
    var _conn = tube.connectedA || tube.connectedB;
    if (_conn) {
      var _mySide = tube.connectedA ? 'A' : 'B';
      var _mySock = _mySide === 'A' ? tube.socketA() : tube.socketB();
      var _partnerSock = _conn.side === 'A' ? _conn.tube.socketA() : _conn.tube.socketB();
      var _bd = (_mySock.angle + Math.PI) - _partnerSock.angle;
      _bd = ((_bd + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      _initBendAbs = Math.abs(_bd);
    }
    return {
      pivotX: pivotX, pivotY: pivotY,
      armLen: armLen,
      initArmAngle: armAngle,
      initRotation: tube.rotation,
      fingerToCenterAngle: fingerAngle0 - armAngle,
      startedBeyondLimit: _initBendAbs > Math.PI * 0.5,
    };
  }

  // ── Snap check ───────────────────────────────────────────────────────────
  checkSnap(dragTube) {
    // Clear previous stationary highlight if any
    if (dragTube._snapLastOther && dragTube._snapLastOther !== dragTube) {
      dragTube._snapLastOther._snapHighlight = null;
    }
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
      dragTube._snapHighlight = best.other;        // drag tube glows toward stationary socket
      best.otherTube._snapHighlight = best.drag;   // stationary tube glows toward drag socket
      dragTube._snapLastOther = best.otherTube;
      return best;
    }
    dragTube._snapLastOther = null;
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
    snapResult.otherTube._snapHighlight = null;
    dragTube._snapLastOther = null;
  }

  // ── Group snap: check free ends of dragged group vs stationary free ends ──
  // Returns best { dragTube, dragSide, dragSock, otherTube, otherSide, otherSock, dist } or null.
  // Also sets _snapHighlight on both matching tubes so their end caps glow.
  checkSnapGroup(group) {
    // Build a quick lookup of group tube ids
    var inGroup = {};
    for (var gi = 0; gi < group.length; gi++) inGroup[group[gi].id] = true;

    // Clear all existing group snap highlights
    for (var gi2 = 0; gi2 < group.length; gi2++) group[gi2]._snapHighlight = null;
    // Also clear highlights on all stationary tubes that might have been set last frame
    for (var ti0 = 0; ti0 < this.tubes.length; ti0++) {
      if (!inGroup[this.tubes[ti0].id]) this.tubes[ti0]._snapHighlight = null;
    }

    var snapDist = this.SNAP_DIST;
    var best = null, bestD = snapDist;

    for (var gi3 = 0; gi3 < group.length; gi3++) {
      var dt = group[gi3];
      // Collect free sockets on this dragged tube
      var freeDrag = [];
      if (!dt.connectedA) freeDrag.push({ sock: dt.socketA(), side: 'A' });
      if (!dt.connectedB) freeDrag.push({ sock: dt.socketB(), side: 'B' });
      if (freeDrag.length === 0) continue;

      for (var ti = 0; ti < this.tubes.length; ti++) {
        var ot = this.tubes[ti];
        if (inGroup[ot.id]) continue;  // skip same group
        // Collect free sockets on stationary tube
        var freeOther = [];
        if (!ot.connectedA) freeOther.push({ sock: ot.socketA(), side: 'A' });
        if (!ot.connectedB) freeOther.push({ sock: ot.socketB(), side: 'B' });

        for (var di = 0; di < freeDrag.length; di++) {
          for (var oi = 0; oi < freeOther.length; oi++) {
            var d = Math.hypot(freeDrag[di].sock.x - freeOther[oi].sock.x,
                               freeDrag[di].sock.y - freeOther[oi].sock.y);
            if (d < bestD) {
              bestD = d;
              best = {
                dragTube: dt,   dragSide: freeDrag[di].side,  dragSock: freeDrag[di].sock,
                otherTube: ot,  otherSide: freeOther[oi].side, otherSock: freeOther[oi].sock,
                dist: d,
              };
            }
          }
        }
      }
    }

    if (best) {
      // Glow both matching end caps
      best.dragTube._snapHighlight  = best.otherSock;
      best.otherTube._snapHighlight = best.dragSock;
    }
    return best;
  }

  // ── Apply group snap: translate entire group so sockets meet, then connect ─
  applySnapGroup(group, snapResult) {
    var dx = snapResult.otherSock.x - snapResult.dragSock.x;
    var dy = snapResult.otherSock.y - snapResult.dragSock.y;
    for (var gi = 0; gi < group.length; gi++) {
      group[gi].x += dx;
      group[gi].y += dy;
      group[gi]._snapHighlight = null;
      group[gi].rebuild();
    }
    snapResult.otherTube._snapHighlight = null;
    this.connect(snapResult.dragTube, snapResult.dragSide, snapResult.otherTube, snapResult.otherSide);
  }

  // ── Draw (split by layer) ─────────────────────────────────────────────────
  draw(ctx, layer, frame, selectedTube) {
    for (var ti = 0; ti < this.tubes.length; ti++) {
      var tube = this.tubes[ti];
      if (tube.layer !== layer) continue;
      tube.draw(ctx, frame, tube === selectedTube);
    }
    if (window.TUBE_DEBUG.jointFillet) this._drawJointsTo(ctx, layer);
  }
  _drawJointsTo(ctx, layer) {
    var drawn = {};
    for (var ti = 0; ti < this.tubes.length; ti++) {
      var tubeA = this.tubes[ti];
      if (tubeA.layer !== layer) continue;
      if (tubeA.type === 'funnel') continue;
      var sides = ['connectedA', 'connectedB'];
      for (var si = 0; si < sides.length; si++) {
        var conn = tubeA[sides[si]];
        if (!conn) continue;
        var tubeB = conn.tube;
        if (tubeB.layer !== layer) continue;
        if (tubeB.type === 'funnel') continue;
        var pairKey = tubeA.id < tubeB.id ? tubeA.id+'|'+tubeB.id : tubeB.id+'|'+tubeA.id;
        if (drawn[pairKey]) continue;
        drawn[pairKey] = true;
        this._drawOneJoint(ctx, tubeA, sides[si] === 'connectedA' ? 'A' : 'B', tubeB, conn.side);
      }
    }
  }

  _drawOneJoint(ctx, tubeA, sideA, tubeB, sideB) {
    var ptsA = tubeA._path, ptsB = tubeB._path;
    if (!ptsA || ptsA.length < 2 || !ptsB || ptsB.length < 2) return;
    var rA = tubeA.radius, rB = tubeB.radius;
    var r = Math.min(rA, rB);

    // Joint pivot point (where the two sockets meet)
    var idxA = sideA === 'A' ? 0 : ptsA.length - 1;
    var idxB = sideB === 'A' ? 0 : ptsB.length - 1;
    var jx = (ptsA[idxA].x + ptsB[idxB].x) / 2;
    var jy = (ptsA[idxA].y + ptsB[idxB].y) / 2;

    // ── Centerline directions pointing INTO each tube ────────────────────
    var inA = sideA === 'A' ? Math.min(4, ptsA.length - 1) : Math.max(ptsA.length - 5, 0);
    var inB = sideB === 'A' ? Math.min(4, ptsB.length - 1) : Math.max(ptsB.length - 5, 0);
    var dAx = ptsA[inA].x - ptsA[idxA].x, dAy = ptsA[inA].y - ptsA[idxA].y;
    var dBx = ptsB[inB].x - ptsB[idxB].x, dBy = ptsB[inB].y - ptsB[idxB].y;
    var lenA = Math.hypot(dAx, dAy) || 1, lenB = Math.hypot(dBx, dBy) || 1;
    dAx /= lenA; dAy /= lenA; dBx /= lenB; dBy /= lenB;

    // Same-side connections (A-A or B-B): both dirs point same way — negate dB
    // so bisector math treats them as opposing, giving correct fillet geometry.
    var sameSide = (sideA === sideB);
    if (sameSide) { dBx = -dBx; dBy = -dBy; }

    // ── Angle between tubes ─────────────────────────────────────────────
    var dot = dAx * dBx + dAy * dBy;
    dot = Math.max(-1, Math.min(1, dot));
    var angle = Math.acos(dot);

    // Nearly straight — no fillet needed
    if (angle < 0.18) return;

    // Perpendiculars to each tube centerline (90° CCW)
    var nAx = -dAy, nAy = dAx;
    var nBx = -dBy, nBy = dBx;

    // ── Get actual trimmed wall endpoints from each tube ─────────────────
    // Each tube has edgeA (-r offset) and edgeB (+r offset).
    // The trimmed end is at the start (if connectedA) or end (if connectedB).
    var eA_tubeA = tubeA._offsetPath(ptsA, -rA);
    var eB_tubeA = tubeA._offsetPath(ptsA,  rA);
    var eA_tubeB = tubeB._offsetPath(ptsB, -rB);
    var eB_tubeB = tubeB._offsetPath(ptsB,  rB);

    // Use cached trimmed edge endpoints for exact fillet start/end points.
    // Falls back to tIdx=3 estimate if cache not yet populated.
    var wA_eA, wA_eB;
    if (tubeA._trimmedEdgeA && tubeA._trimmedEdgeB) {
      var tEA = tubeA._trimmedEdgeA, tEB = tubeA._trimmedEdgeB;
      if (sideA === 'A') {
        wA_eA = tEA[0]; wA_eB = tEB[0];
      } else {
        wA_eA = tEA[tEA.length-1]; wA_eB = tEB[tEB.length-1];
      }
    } else {
      if (sideA === 'A') {
        var tIdx = Math.min(3, eA_tubeA.length - 1);
        wA_eA = eA_tubeA[tIdx]; wA_eB = eB_tubeA[tIdx];
      } else {
        var tIdx = Math.max(0, eA_tubeA.length - 4);
        wA_eA = eA_tubeA[tIdx]; wA_eB = eB_tubeA[tIdx];
      }
    }

    var wB_eA, wB_eB;
    if (tubeB._trimmedEdgeA && tubeB._trimmedEdgeB) {
      var tEA2 = tubeB._trimmedEdgeA, tEB2 = tubeB._trimmedEdgeB;
      if (sideB === 'A') {
        wB_eA = tEA2[0]; wB_eB = tEB2[0];
      } else {
        wB_eA = tEA2[tEA2.length-1]; wB_eB = tEB2[tEB2.length-1];
      }
    } else {
      if (sideB === 'A') {
        var tIdx2 = Math.min(3, eA_tubeB.length - 1);
        wB_eA = eA_tubeB[tIdx2]; wB_eB = eB_tubeB[tIdx2];
      } else {
        var tIdx2 = Math.max(0, eA_tubeB.length - 4);
        wB_eA = eA_tubeB[tIdx2]; wB_eB = eB_tubeB[tIdx2];
      }
    }

    // ── Pair wall endpoints using bisector ───────────────────────────────
    var bisX = dAx + dBx, bisY = dAy + dBy;
    var bisLen = Math.hypot(bisX, bisY);
    if (bisLen < 0.001) { bisX = nAx; bisY = nAy; }
    else { bisX /= bisLen; bisY /= bisLen; }

    var bisPerpX = -bisY, bisPerpY = bisX;

    // Use exact socket geometry for stable pairing — trimmed endpoints can flip
    // sign near 90° causing fillet walls to swap. Exact perpendicular offsets
    // from joint center are always consistent regardless of angle.
    var nAx_exact = -dAy, nAy_exact = dAx;  // perp to tube A inward dir
    var nBx_exact = -dBy, nBy_exact = dBx;  // perp to tube B inward dir
    var sockA_eA = { x: jx - nAx_exact * rA, y: jy - nAy_exact * rA }; // tube A edgeA side
    var sockA_eB = { x: jx + nAx_exact * rA, y: jy + nAy_exact * rA }; // tube A edgeB side
    var sockB_eA = { x: jx - nBx_exact * rB, y: jy - nBy_exact * rB }; // tube B edgeA side
    var sockB_eB = { x: jx + nBx_exact * rB, y: jy + nBy_exact * rB }; // tube B edgeB side

    // Project onto bisector-perpendicular to determine same-side pairing
    var sA_eA_side = (sockA_eA.x - jx) * bisPerpX + (sockA_eA.y - jy) * bisPerpY;
    var sB_eA_side = (sockB_eA.x - jx) * bisPerpX + (sockB_eA.y - jy) * bisPerpY;

    // Pair: match endpoints on the same side of bisector-perp
    var pair1_A, pair1_B, pair2_A, pair2_B;
    if (sA_eA_side * sB_eA_side >= 0) {
      pair1_A = wA_eA; pair1_B = wB_eA;
      pair2_A = wA_eB; pair2_B = wB_eB;
    } else {
      pair1_A = wA_eA; pair1_B = wB_eB;
      pair2_A = wA_eB; pair2_B = wB_eA;
    }

    // Inside = wall on the acute/inner side of the bend (lower bisector projection)
    // Use exact socket points for stable inside/outside determination
    var s1proj = (sockA_eA.x - jx) * bisX + (sockA_eA.y - jy) * bisY;
    var s2proj = (sockA_eB.x - jx) * bisX + (sockA_eB.y - jy) * bisY;
    var insideA, insideB, outsideA, outsideB;
    if (s1proj < s2proj) {
      insideA = pair1_A; insideB = pair1_B;
      outsideA = pair2_A; outsideB = pair2_B;
    } else {
      insideA = pair2_A; insideB = pair2_B;
      outsideA = pair1_A; outsideB = pair1_B;
    }

    // ── Visual setup ────────────────────────────────────────────────────
    var color = tubeA._tubeColor();
    var cr = parseInt(color.slice(1,3),16)||0;
    var cg = parseInt(color.slice(3,5),16)||0;
    var cb = parseInt(color.slice(5,7),16)||0;
    var alpha = tubeA.layer === 'behind' ? 0.50 : 1.0;
    var style = tubeA.style;
    if (style === 'energy') style = tubeB.style !== 'energy' ? tubeB.style : 'glass';
    var bodyAlpha = style === 'glass' ? 0.06 : style === 'window' ? 0.22 : 0.75;

    // ── Bezier control point: tangent line intersection ──────────────────
    // The wall at each endpoint continues in the tube's centerline direction.
    // Extending AWAY from each tube (-dA from tube A's endpoint, -dB from tube B's)
    // and intersecting gives a control point that makes the Bezier tangent to both walls.
    var _bezierCP = function(pA, pB, maxDist) {
      var det = (-dAx) * (-dBy) - (-dAy) * (-dBx);
      if (Math.abs(det) < 1e-6) {
        return { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };
      }
      var t = ((pB.x - pA.x) * (-dBy) - (pB.y - pA.y) * (-dBx)) / det;
      var cpx = pA.x + t * (-dAx);
      var cpy = pA.y + t * (-dAy);
      var d = Math.hypot(cpx - jx, cpy - jy);
      if (d > maxDist) { cpx = jx + (cpx - jx) * maxDist / d; cpy = jy + (cpy - jy) * maxDist / d; }
      return { x: cpx, y: cpy };
    };

    // Outside curve can extend further; inside curve capped tighter to prevent pinching.
    // For the inside CP, use the exact socket-geometry inside points (not trimmed endpoints)
    // since the trimmed endpoints can be pulled too far back, making the curve too short.
    var outsideCP = _bezierCP(outsideA, outsideB, r * 5);
    // Exact inside socket corners: joint center ± perpendicular * r, on inside side
    var insideCP  = _bezierCP(insideA, insideB, r * 1.5);

    // Joint body fill removed — was covering balls passing through joints

    // ── Draw wall curves — NO shadow/glow to avoid hiding balls ─────────
    var _strokeCurve = function(p0, cp, p1, isTop) {
      var gap = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (gap < 0.5) return;

      // Main wall line only — no glow/shadow
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(cp.x, cp.y, p1.x, p1.y);
      ctx.lineWidth = style === 'solid' ? 5 : 4;
      ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha * (style === 'solid' ? 0.95 : 0.75)) + ')';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Highlight on top wall
      if (isTop) {
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(cp.x, cp.y, p1.x, p1.y);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(220,240,255,' + (alpha * (style === 'solid' ? 0.6 : 0.85)) + ')';
        ctx.stroke();
      }
    };

    // Top wall = whichever has lower Y midpoint (higher on screen)
    var outMidY = (outsideA.y + outsideB.y) / 2;
    var inMidY  = (insideA.y + insideB.y) / 2;

    _strokeCurve(outsideA, outsideCP, outsideB, outMidY < inMidY);
    _strokeCurve(insideA, insideCP, insideB, inMidY < outMidY);

    // ── Gloss fillet through joint ─────────────────────────────────────────
    // Uses cached trimmed endpoints from each tube's gloss stripe draw.
    // Falls back to fixed-offset points if cache not yet available.
    if (style === 'glass' || style === 'window') {
      var glossUp = r * 0.48;
      var gExtendFallback = r * 0.5;

      // Get trimmed endpoints from each tube — A side or B side depending on which socket is at joint
      var gp0, gp1, gp0t, gp1t;
      if (tubeA._glossEndA && tubeA._glossEndB) {
        gp0  = (sideA === 'A') ? tubeA._glossEndA  : tubeA._glossEndB;
        gp0t = (sideA === 'A') ? tubeA._glossThinEndA : tubeA._glossThinEndB;
      } else {
        gp0  = { x: jx - dAx*gExtendFallback, y: jy - dAy*gExtendFallback - glossUp };
        gp0t = { x: jx - dAx*gExtendFallback, y: jy - dAy*gExtendFallback - r*0.62 };
      }
      if (tubeB._glossEndA && tubeB._glossEndB) {
        gp1  = (sideB === 'A') ? tubeB._glossEndA  : tubeB._glossEndB;
        gp1t = (sideB === 'A') ? tubeB._glossThinEndA : tubeB._glossThinEndB;
      } else {
        gp1  = { x: jx - dBx*gExtendFallback, y: jy - dBy*gExtendFallback - glossUp };
        gp1t = { x: jx - dBx*gExtendFallback, y: jy - dBy*gExtendFallback - r*0.62 };
      }

      // Bezier CP: tangent intersection (same method as wall fillets)
      var _glossCP = function(p0, p1, maxD) {
        var det = (-dAx)*(-dBy) - (-dAy)*(-dBx);
        if (Math.abs(det) < 1e-6) return { x: (p0.x+p1.x)/2, y: (p0.y+p1.y)/2 };
        var t = ((p1.x-p0.x)*(-dBy) - (p1.y-p0.y)*(-dBx)) / det;
        var cx = p0.x + t*(-dAx), cy = p0.y + t*(-dAy);
        var d = Math.hypot(cx-jx, cy-jy);
        if (d > maxD) { cx = jx+(cx-jx)*maxD/d; cy = jy+(cy-jy)*maxD/d; }
        return { x: cx, y: cy };
      };

      var gCp  = _glossCP(gp0, gp1, r * 4);
      var gCp2 = _glossCP(gp0t, gp1t, r * 4);

      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(gp0.x, gp0.y);
      ctx.quadraticCurveTo(gCp.x, gCp.y, gp1.x, gp1.y);
      ctx.lineWidth = style === 'glass' ? r * 0.18 : r * 0.08;
      ctx.strokeStyle = 'rgba(220,235,255,' + (alpha * (style === 'glass' ? 0.32 : 0.14)) + ')';
      ctx.stroke();

      ctx.beginPath(); ctx.moveTo(gp0t.x, gp0t.y);
      ctx.quadraticCurveTo(gCp2.x, gCp2.y, gp1t.x, gp1t.y);
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = 'rgba(255,255,255,' + (alpha * 0.45) + ')';
      ctx.stroke();
    }
  }

  toJSON() {
    return this.tubes.map(function(t) {
      return {
        type:t.type, x:t.x, y:t.y, rotation:t.rotation, length:t.length,
        radius:t.radius, speedMod:t.speedMod, style:t.style, layer:t.layer,
        color:t.color, id:t.id,
        // Save connection info as {id, side} pairs
        connectedA: t.connectedA ? { id: t.connectedA.tube.id, side: t.connectedA.side } : null,
        connectedB: t.connectedB ? { id: t.connectedB.tube.id, side: t.connectedB.side } : null,
      };
    });
  }

  fromJSON(arr) {
    // First pass: create all tube objects
    this.tubes = arr.map(function(d) { return new TubePiece(d.type, d.x, d.y, d.rotation, d); });
    // Second pass: restore connections by matching IDs
    var tubeMap = {};
    this.tubes.forEach(function(t) { tubeMap[t.id] = t; });
    var self = this;
    arr.forEach(function(d, i) {
      var tube = self.tubes[i];
      if (d.connectedA && tubeMap[d.connectedA.id]) {
        tube.connectedA = { tube: tubeMap[d.connectedA.id], side: d.connectedA.side };
      }
      if (d.connectedB && tubeMap[d.connectedB.id]) {
        tube.connectedB = { tube: tubeMap[d.connectedB.id], side: d.connectedB.side };
      }
    });
  }
}

window.TubePiece   = TubePiece;
window.TubeManager = TubeManager;
})();
