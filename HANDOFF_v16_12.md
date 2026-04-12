# HANDOFF NOTES — PuzzBalls v16.12

## Baseline: Start from v16.12 zip

## What's Working Well (Major wins this session)

### Tube Joint Rendering (v15.80 → v16.12, many hours)
- **Dark artifact FIXED**: Two root causes resolved:
  1. `ctx.clip()` used body fill polygon whose `closePath()` cut across open end → removed clip entirely (walls draw on top anyway)
  2. Body fill `closePath()` dark edge at open ends → extend fillA/fillB arrays past unconnected ends
- **Body fill**: Now draws as thick centerline stroke (`lineWidth = tubeR*2`, `lineCap='butt'`) — stays within walls by definition, no polygon math
- **Wall fillets**: Use exact trimmed endpoints cached as `_trimmedEdgeA/_trimmedEdgeB` on each tube after draw — eliminates gap between fillet and wall
- **Fillet thickness**: Matches main wall (4px for glass/window, 5px for solid)
- **Gloss stripe**: Trims at connected ends matching wall trim depth; joint fillet uses cached endpoints `_glossEndA/B`
- **Inside fillet**: Capped at `r*1.5` to prevent pinching at steep angles
- **Wall pairing**: Uses exact socket geometry (not trimmed endpoints) for stable inside/outside determination near 90°

### Tube Interaction (v16.09 → v16.12)
- **Zone logic**: Tap within `radius*2.5` of free socket on end tube → pivot; everywhere else on connected tube → group drag
- **Middle tube**: Always group-drags (never pivots/breaks connections)
- **Two-finger group rotate**: Put finger 1 anywhere on chain, finger 2 anywhere → rotates whole chain around centroid (no scale)
- **Joint-anchor stretch**: Finger 1 on group, finger 2 near free end → stretches/rotates that tube while joint stays fixed
- **90° clamp**: One-directional — allows rotating from beyond-limit into valid zone, then enforces limit
- **Same-side connections (A-A/B-B)**: Fixed by negating partner direction in fillet and fill math

### Debug Tools
- **TUBE_DEBUG panel** (🔬 button in tube editor): Toggle each layer, brightness slider for body fill, X close button
- **BOX toggle**: In style row of tube editor — shows/hides dashed yellow bounding box during group drag

## Known Remaining Issues
- Body fill "black corners" at joints — thick stroke with `lineCap='butt'` leaves small gap at joint angle; subtle at normal alpha (0.06)
- Gloss stripe fillet slightly thinner at joints than tube body (acceptable for now)
- Ball exit still slightly visible pop at very slow speeds (cooldown-related)
- Fill opacity doubling at joints (two tube fills overlap slightly)

## Key Architecture Notes

### Body Fill (IMPORTANT — don't revert to polygon approach)
```javascript
// In TubePiece.draw() — glass/window style
ctx.strokeStyle = 'rgba(cr,cg,cb, alpha*0.06)';
ctx.lineWidth = tubeR * 2;
ctx.lineCap = 'butt';
// stroke along trimmed centerline pts
```
The polygon approach (edgeA + edgeB + closePath) was tried many times and always produced twisted/oversized fills. The centerline stroke approach is the correct solution.

### Fillet Endpoint Caching
Each tube caches `_trimmedEdgeA`, `_trimmedEdgeB`, `_glossEndA/B`, `_glossThinEndA/B` during draw — `_drawOneJoint` reads these for exact fillet endpoints.

### Same-Side Connection Fix
When `sideA === sideB` (both A-A or both B-B), negate partner direction before bisector math in both `_drawOneJoint` and `_bisectorFillEnd`.

### Interaction State Machine
- `_tubeGroupDrag` → whole chain moves (one finger)
- `_tubeGroupPinchStart` → whole chain rotates (two fingers, set on first onMove)  
- `_tubeJointStretch` → one tube stretches (two fingers, free end detected)
- `_tubePivotState` → single end tube pivots around joint
- Second finger down during group drag: checked for free-end stretch first, falls through to rotate

## Build/Deploy Notes
- Version: `PUZZBALLS_FILE_VERSION['filename.js'] = NNNN`
- Timestamp: `PUZZBALLS_BUILD_TIMESTAMP` in menu.js
- Cache busters: `<script src="js/xxx.js?v=NNNN">` in index.html — all should match
- NEVER use wrapper folder in zips
- Service worker caches aggressively — bump all version numbers together
