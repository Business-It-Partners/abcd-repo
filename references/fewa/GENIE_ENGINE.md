# FEWA Genie Engine

**Status:** implementation candidate on `dev/geni-effect-fixture`; CI passes, owner visual acceptance required  
**Scope:** window minimize and restore between a FEWA window and its persistent Dock thumbnail

## 1. What this implementation is

Apple has not published the private Dock/WindowServer source or the exact constants
behind macOS's Genie effect. This engine therefore does not claim access to Apple's
implementation. It is a clean Flutter/Dart implementation of the publicly observable
model and the strongest public reconstruction available:

- Harshil Shah, *Recreating the macOS Genie Effect*  
  <https://harshil.net/blog/recreating-the-mac-genie-effect/>
- Harshil Shah's SpriteKit source  
  <https://github.com/HarshilShah/Genie>
- Apple `SKWarpGeometryGrid`  
  <https://developer.apple.com/documentation/spritekit/skwarpgeometrygrid>
- Flutter `Vertices.raw` and `Canvas.drawVertices`  
  <https://api.flutter.dev/flutter/dart-ui/Vertices/Vertices.raw.html>  
  <https://api.flutter.dev/flutter/dart-ui/Canvas/drawVertices.html>

The engineering target is not a scale/skew imitation. It is a real non-affine texture
warp with deterministic geometry and exact minimize/restore reversibility. “macOS-grade”
remains a visual acceptance claim, not something unit tests alone can certify.

## 2. Why the previous engine missed the characteristic motion

The previous implementation was technically ambitious, but its visual model had drifted
away from the reference:

- a permanent Hermite funnel shaped the whole journey;
- each horizontal column had a different clock;
- seven interior columns introduced curl and fabric-like twisting;
- restore added a separate width overshoot;
- the result read as an ornamental liquid warp rather than macOS's recognizable
  **pinch, overlap, pour, rectangular arrival** sequence.

More math was not buying more fidelity. The decisive correction was to simplify the
model to the geometry the reference actually uses.

## 3. Architecture

```text
RepaintBoundary window snapshot
             |
             v
      GenieFlow (time only)
             |
             v
   GenieFunnel (space only)
             |
             v
     GenieMesh (2 x N grid)
             |
             v
 ImageShader + drawVertices
             |
             v
       Flutter compositor
```

### `genie_flow.dart`

Owns only the animation clock. Constants are explicit and centralized:

```text
pinch completes:       t = 0.50
travel starts:         t = 0.40
reference duration:    700 ms
FEWA tuned duration:   636 ms (~10% faster)
```

FEWA changes only wall-clock duration; the normalized 50/40 phase structure remains
identical. Travel starts while pinch is still incomplete. Restore folds the same
canonical clock backward, so it cannot silently diverge from minimize.

### `genie_funnel.dart`

Owns the two curved side boundaries and vertical interval. Source texture coordinates
never move. For a bottom Dock, let the source window be

```text
W = [xL0, xR0] x [yT0, yB0]
```

and the target thumbnail be

```text
D = [xL1, xR1] x [yT1, yB1].
```

The temporal signals are

```text
p(t) = clamp(t / 0.50, 0, 1)
r(t) = clamp((t - 0.40) / 0.60, 0, 1).
```

The moving vertical interval is

```text
yTop(t)    = yT0 + r(t) (yT1 - yT0)
yBottom(t) = min(yB0 + r(t) (yT1 - yT0), yB1).
```

The destination endpoints of the side curves are

```text
xL*(t) = lerp(xL0, xL1, p(t))
xR*(t) = lerp(xR0, xR1, p(t)).
```

For a row at vertical position `y`, spatial progress through the funnel is

```text
s(y) = quadraticEaseInOut(clamp((y - yT0) / (yT1 - yT0), 0, 1)).
```

The two boundaries are

```text
xL(y,t) = lerp(xL0, xL*(t), s(y))
xR(y,t) = lerp(xR0, xR*(t), s(y)).
```

At `t = 0`, every row is exactly the source rectangle. At `t = 1`, every row is
exactly the Dock rectangle. There is no approximate handoff.

The code expresses the same equations on a signed vertical axis, so a top Dock also works
without vertically flipping the captured content.

### `genie_mesh.dart`

Uses two vertices per row and 64–160 adaptive rows. Two columns are deliberate: the left
and right boundary curves define the deformation, while the GPU interpolates the texture
across each indexed strip. Independent interior-column clocks were removed because they
created folds and a false spiral.

UVs and indices are allocated once. Only destination positions are mutated per frame.
The `ImageShader` and `Paint` are also created once per animation. Each frame creates
one transient `Vertices` object for Flutter's display list and releases its Dart-side native
handle immediately after the draw command has been recorded. The shader is explicitly
disposed with the overlay.

`Canvas.drawVertices` has not guaranteed anti-aliased outer edges on every backend, so the
renderer also clips through a path sampled from the exact same left/right mesh boundary.

### `genie_overlay.dart`

Owns the animation controller and renderer resources, but not the snapshot. Snapshot
ownership remains in `DesktopCubit`/`WindowModel`, which lets one GPU image serve all of:

1. the minimize overlay;
2. the persistent Dock thumbnail;
3. the reverse restore overlay.

Malformed or overlapping geometry fails over to a simple affine image handoff rather
than drawing a folded mesh or destabilizing the shell.

## 4. Invariants pinned by tests

- pinch/travel timing remains 50% / 40%;
- restore at `t` equals minimize at `1 - t`;
- rest corners equal the source window exactly;
- final corners equal the Dock target exactly;
- lower rows pinch before vertical travel starts;
- every row remains ordered and every width stays positive;
- far-left, centered, and far-right Dock targets stay fold-free;
- top-Dock orientation is correct;
- mesh topology and adaptive density remain bounded.

Run:

```bash
flutter analyze
flutter test test/genie_funnel_test.dart
flutter test
flutter build linux --debug
```

## 5. Visual acceptance gate

Automated tests prove geometry and lifecycle properties; they cannot prove taste. Before
merge, run the Linux build on a real display and inspect at normal speed and in a 120/240
fps screen recording:

1. the top edge must initially remain visually anchored;
2. the lower edge must shear toward the exact recent-thumbnail slot;
3. travel must begin before pinch fully completes;
4. text must remain recognizable without tearing or black folds;
5. the final overlay frame and Dock thumbnail must not pop;
6. restore must retrace the same spatial path;
7. repeated minimize/restore must not grow GPU-image handles.

If visual tuning is needed, change only `GenieFlow.pinchEnd`,
`GenieFlow.travelStart`, or `GenieFlow.duration` first. Do not reintroduce per-column
controllers, arbitrary curl, or a second restore-only geometry.
