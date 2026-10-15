/// Time-domain model for the FEWA Genie effect.
///
/// The clock deliberately follows the reverse-engineered macOS sequence used
/// by Harshil Shah's SpriteKit reconstruction:
///
/// * the destination-side pinch finishes at 50% of the animation;
/// * vertical travel starts at 40%, while that pinch is still in progress;
/// * restore samples the exact same clock backwards.
///
/// Keeping time separate from geometry makes the renderer deterministic and
/// makes minimize/restore spatially reversible instead of two independently
/// tuned animations.
class GenieFlow {
  GenieFlow._();

  /// The funnel is fully established halfway through the animation.
  static const double pinchEnd = 0.50;

  /// Translation begins before the pinch has completed.
  static const double travelStart = 0.40;

  /// The public reconstruction uses 700 ms. FEWA runs the same normalized
  /// geometry about 10% faster so departure and arrival feel more immediate
  /// without changing the characteristic 50/40 phase overlap.
  ///
  /// 700 ms / 1.10 ~= 636 ms.
  static const Duration duration = Duration(milliseconds: 636);

  static double clamp01(double value) => value.clamp(0.0, 1.0).toDouble();

  /// Spatial easing used along each side of the funnel.
  ///
  /// This is the same piecewise quadratic used by the public SpriteKit
  /// reconstruction. It is C1 at the midpoint and has zero slope at both ends.
  static double quadraticEaseInOut(double value) {
    final t = clamp01(value);
    if (t < 0.5) return 2.0 * t * t;
    return -2.0 * t * t + 4.0 * t - 1.0;
  }

  static double _phase(
    double progress, {
    required double start,
    required double end,
  }) {
    if (end <= start) return progress >= end ? 1.0 : 0.0;
    return clamp01((progress - start) / (end - start));
  }

  /// Samples the shared minimize/restore clock.
  ///
  /// [controllerProgress] always runs 0 -> 1. For restore we fold it back to
  /// 1 -> 0, which guarantees that every restore frame has an identical
  /// minimize frame at `1 - t`.
  static GenieFlowSample sample(
    double controllerProgress, {
    required bool isMinimizing,
  }) {
    final controllerT = clamp01(controllerProgress);
    final canonicalT = isMinimizing ? controllerT : 1.0 - controllerT;

    return GenieFlowSample(
      canonicalProgress: canonicalT,
      pinchProgress: _phase(canonicalT, start: 0.0, end: pinchEnd),
      travelProgress: _phase(canonicalT, start: travelStart, end: 1.0),
    );
  }
}

/// One immutable sample of the Genie clock.
class GenieFlowSample {
  const GenieFlowSample({
    required this.canonicalProgress,
    required this.pinchProgress,
    required this.travelProgress,
  });

  /// 0 = full window, 1 = dock thumbnail.
  final double canonicalProgress;

  /// 0 = source-width sides, 1 = sides terminate at the dock width.
  final double pinchProgress;

  /// 0 = source vertical interval, 1 = target vertical interval.
  final double travelProgress;
}
