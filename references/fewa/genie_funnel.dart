import 'dart:math' as math;
import 'dart:ui';

import 'genie_flow.dart';

/// Pure spatial model for a macOS-style Genie deformation.
///
/// The model is a direct, coordinate-system-independent port of the public
/// SpriteKit reconstruction by Harshil Shah. The window is treated as a
/// texture sheet with two curved side boundaries. Lower rows pinch first;
/// translation then carries the sheet through those boundaries until every
/// row occupies the exact dock rectangle.
///
/// The class supports a dock above or below the window. FEWA currently uses a
/// bottom dock, but expressing the path on a signed vertical axis keeps the
/// equations honest and testable.
class GenieFunnel {
  factory GenieFunnel({
    required Rect windowRect,
    required Rect dockRect,
    required double overlayTop,
  }) {
    final localWindow = windowRect.shift(Offset(0.0, -overlayTop));
    final localDock = dockRect.shift(Offset(0.0, -overlayTop));
    final direction = localDock.center.dy >= localWindow.center.dy ? 1.0 : -1.0;

    final sourceTopQ = direction * localWindow.top;
    final sourceBottomQ = direction * localWindow.bottom;
    final targetTopQ = direction * localDock.top;
    final targetBottomQ = direction * localDock.bottom;

    final sourceTrailingQ = math.min(sourceTopQ, sourceBottomQ);
    final sourceLeadingQ = math.max(sourceTopQ, sourceBottomQ);
    final targetTrailingQ = math.min(targetTopQ, targetBottomQ);
    final targetLeadingQ = math.max(targetTopQ, targetBottomQ);

    return GenieFunnel._(
      windowRect: localWindow,
      dockRect: localDock,
      direction: direction,
      sourceTrailingQ: sourceTrailingQ,
      sourceLeadingQ: sourceLeadingQ,
      targetTrailingQ: targetTrailingQ,
      targetLeadingQ: targetLeadingQ,
    );
  }

  GenieFunnel._({
    required this.windowRect,
    required this.dockRect,
    required this.direction,
    required this.sourceTrailingQ,
    required this.sourceLeadingQ,
    required this.targetTrailingQ,
    required this.targetLeadingQ,
  }) : pathExtent = math.max(targetTrailingQ - sourceTrailingQ, 0.000001),
       sourceExtent = sourceLeadingQ - sourceTrailingQ,
       targetExtent = targetLeadingQ - targetTrailingQ;

  /// Overlay-local source and destination rectangles.
  final Rect windowRect;
  final Rect dockRect;

  /// +1 for a target below the window, -1 for a target above it.
  final double direction;

  /// Signed-axis coordinates. "Trailing" is the edge farther from the target.
  final double sourceTrailingQ;
  final double sourceLeadingQ;
  final double targetTrailingQ;
  final double targetLeadingQ;

  /// Distance from the source's trailing edge to the target's trailing edge.
  final double pathExtent;

  final double sourceExtent;
  final double targetExtent;

  /// The production mesh requires a smaller target beyond the source along the
  /// selected axis. When this is false the caller should use a simple fallback.
  bool get isUsable =>
      windowRect.width > 0.0 &&
      windowRect.height > 0.0 &&
      dockRect.width > 0.0 &&
      dockRect.height > 0.0 &&
      targetTrailingQ > sourceTrailingQ &&
      sourceExtent >= targetExtent;

  GenieFrame frame(GenieFlowSample flow) => GenieFrame._(this, flow);

  static double _lerp(double a, double b, double t) => a + (b - a) * t;

  double _screenY(double q) => q * direction;

  double _spatialProgress(double q) {
    final normalized = (q - sourceTrailingQ) / pathExtent;
    return GenieFlow.quadraticEaseInOut(normalized);
  }

  double _leftBoundary(double q, double pinchProgress) {
    final destinationX = _lerp(windowRect.left, dockRect.left, pinchProgress);
    return _lerp(windowRect.left, destinationX, _spatialProgress(q));
  }

  double _rightBoundary(double q, double pinchProgress) {
    final destinationX = _lerp(windowRect.right, dockRect.right, pinchProgress);
    return _lerp(windowRect.right, destinationX, _spatialProgress(q));
  }
}

/// Geometry for one animation frame.
///
/// [u] runs left -> right through the source texture and [v] runs top ->
/// bottom. No inverse lookup is performed: source UVs remain fixed and only
/// destination vertices move.
class GenieFrame {
  GenieFrame._(this.funnel, this.flow)
    : trailingQ =
          funnel.sourceTrailingQ + funnel.pathExtent * flow.travelProgress,
      leadingQ = math.min(
        funnel.sourceLeadingQ + funnel.pathExtent * flow.travelProgress,
        funnel.targetLeadingQ,
      );

  final GenieFunnel funnel;
  final GenieFlowSample flow;

  final double trailingQ;
  final double leadingQ;

  double axisAt(double v) {
    final row = GenieFlow.clamp01(v);
    if (funnel.direction > 0.0) {
      return GenieFunnel._lerp(trailingQ, leadingQ, row);
    }
    return GenieFunnel._lerp(leadingQ, trailingQ, row);
  }

  double yAt(double v) => funnel._screenY(axisAt(v));

  double leftAt(double v) =>
      funnel._leftBoundary(axisAt(v), flow.pinchProgress);

  double rightAt(double v) =>
      funnel._rightBoundary(axisAt(v), flow.pinchProgress);

  double widthAt(double v) => rightAt(v) - leftAt(v);

  Offset pointAt(double u, double v) {
    final rowQ = axisAt(v);
    final left = funnel._leftBoundary(rowQ, flow.pinchProgress);
    final right = funnel._rightBoundary(rowQ, flow.pinchProgress);
    final x = GenieFunnel._lerp(left, right, GenieFlow.clamp01(u));
    return Offset(x, funnel._screenY(rowQ));
  }
}
