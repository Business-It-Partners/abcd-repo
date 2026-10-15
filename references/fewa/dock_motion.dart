/// The MOTION engine — Dock Parity Plan §2.2, §8.
///
/// Owns every spring in the dock and ticks them from one clock. This is
/// where "alive" lives: the raw pointer never reaches the field directly —
/// it feeds a follower, and the follower's *settling* is what reads as
/// physical (§2.2 "the micro-lag is ~80% of the alive feeling").
///
/// One spring vocabulary, reused — never one controller per concern:
///   • cursor    — critically-damped chase of the raw pointer x
///   • intensity — entry-swell / exit-settle envelope (0 → 1 → 0)
///
/// Both integrate by *real elapsed time* every tick (§8 frame-rate
/// independence). A small input deadband rejects mouse sensor noise and the
/// ticker parks at equilibrium even while the pointer remains inside, so a
/// stationary pointer produces literally stationary pixels.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';

// ── Spring constants — the dock's instance of one shared grammar (§2.2) ──────
// Critically damped (ζ = 1): no overshoot, fastest non-oscillatory return.

/// Cursor chase. The previous 800 stiffness left too much inertial tail behind
/// a moving pointer, so rapid direction changes read as a shaky wave. 1200
/// keeps a small premium lag but follows the hand more decisively.
const double kCursorChaseStiffness = 1200.0;

/// Entry swell / exit settle. The old 300 value kept changing magnification
/// amplitude for too long while the cursor was already moving laterally. A
/// faster envelope separates "enter the Dock" from "move across the Dock".
const double kEnvelopeStiffness = 700.0;

// ── A single critically-damped spring follower ───────────────────────────────

class SpringFollower {
  SpringFollower({
    required double stiffness,
    required double damping,
    this.value = 0.0,
  }) : _stiffness = stiffness,
       _damping = damping,
       target = value;

  factory SpringFollower.criticallyDamped({
    required double stiffness,
    double value = 0.0,
  }) => SpringFollower(
    stiffness: stiffness,
    damping: 2.0 * _sqrt(stiffness),
    value: value,
  );

  final double _stiffness;
  final double _damping;

  double value;
  double velocity = 0.0;
  double target;

  static const double _restEpsilon = 0.0008;

  /// Semi-implicit Euler. [DockMotionController] sub-steps every follower with
  /// the same small dt, keeping the integration stable and deterministic across
  /// normal desktop refresh rates and occasional dropped frames.
  void tick(double dtSeconds) {
    final acceleration = _stiffness * (target - value) - _damping * velocity;
    velocity += acceleration * dtSeconds;
    value += velocity * dtSeconds;
  }

  bool get isSettled =>
      (target - value).abs() < _restEpsilon && velocity.abs() < _restEpsilon;

  void snapTo(double v) {
    value = v;
    target = v;
    velocity = 0.0;
  }
}

double _sqrt(double x) {
  if (x <= 0) return 0.0;
  var guess = x;
  for (var i = 0; i < 8; i++) {
    guess = 0.5 * (guess + x / guess);
  }
  return guess;
}

// ── The motion controller — one clock, every spring (§2.2) ───────────────────

class DockMotionController extends ChangeNotifier {
  DockMotionController({required TickerProvider vsync}) {
    _ticker = vsync.createTicker(_onTick);
  }

  late final Ticker _ticker;
  Duration _lastElapsed = Duration.zero;
  bool _pointerInside = false;

  final SpringFollower cursor = SpringFollower.criticallyDamped(
    stiffness: kCursorChaseStiffness,
  );

  final SpringFollower intensity = SpringFollower.criticallyDamped(
    stiffness: kEnvelopeStiffness,
  );

  static const double _kDtCeiling = 1.0 / 20.0;

  /// Six milliseconds keeps both the 1200 cursor spring and 700 envelope well
  /// inside the semi-implicit stability region, including after a dropped frame.
  static const double _kSafeStep = 0.006;

  /// Ignore sub-pixel hardware noise. The target still catches up as soon as
  /// cumulative movement exceeds this threshold, so slow deliberate motion is
  /// preserved while a stationary mouse cannot make the wave twitch.
  static const double _kPointerDeadband = 0.40;

  double? get cursorX => intensity.value > 0.0035 ? cursor.value : null;

  double get fieldIntensity => intensity.value.clamp(0.0, 1.0);

  // ── Pointer events ─────────────────────────────────────────────────────────

  void pointerMoved(double x) {
    if (!_pointerInside) {
      _pointerInside = true;
      cursor.snapTo(x);
      intensity.target = 1.0;
    }

    if ((x - cursor.target).abs() >= _kPointerDeadband) {
      cursor.target = x;
    }
    _ensureRunning();
  }

  void pointerExited() {
    _pointerInside = false;
    intensity.target = 0.0;
    _ensureRunning();
  }

  // ── Clock ──────────────────────────────────────────────────────────────────

  void _ensureRunning() {
    if (!_ticker.isTicking) {
      _lastElapsed = Duration.zero;
      _ticker.start();
    }
  }

  void _onTick(Duration elapsed) {
    var dt =
        (elapsed - _lastElapsed).inMicroseconds /
        Duration.microsecondsPerSecond;
    if (dt < 0) dt = 0;
    if (dt > _kDtCeiling) dt = _kDtCeiling;
    _lastElapsed = elapsed;

    final steps = (dt / _kSafeStep).ceil().clamp(1, 16);
    final subDt = dt / steps;
    for (var i = 0; i < steps; i++) {
      cursor.tick(subDt);
      intensity.tick(subDt);
    }
    notifyListeners();

    // Park the ticker whenever the current state has actually converged — even
    // while the pointer remains inside. The old implementation kept ticking
    // forever on hover, allowing tiny integration residue to repaint a
    // supposedly stationary Dock. New pointer input restarts the ticker.
    if (cursor.isSettled && intensity.isSettled) {
      cursor.snapTo(cursor.target);
      intensity.snapTo(_pointerInside ? 1.0 : 0.0);
      notifyListeners();
      _ticker.stop();
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }
}
