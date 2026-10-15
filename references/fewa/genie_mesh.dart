import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'genie_funnel.dart';

/// Preallocated, forward-mapped texture mesh for the Genie effect.
///
/// Two vertices per row are intentional. The public macOS reconstruction uses
/// one mesh column: the left and right boundary curves define the silhouette,
/// while the rasterizer interpolates the window texture across each strip.
/// Adding independent interior-column clocks creates twisting and folds that
/// are not part of the characteristic Genie motion.
class GenieMesh {
  GenieMesh({
    required this.rowCount,
    required double textureWidth,
    required double textureHeight,
  }) : assert(rowCount >= 2),
       positions = Float32List(rowCount * 4),
       textureCoordinates = Float32List(rowCount * 4),
       indices = Uint16List((rowCount - 1) * 6) {
    _buildStaticBuffers(textureWidth, textureHeight);
  }

  static const int columns = 2;

  /// Vertex rows selected from physical height: dense enough that the curved
  /// side is sub-pixel smooth, bounded so a giant window cannot explode work.
  static int rowCountFor({
    required double logicalHeight,
    required double devicePixelRatio,
  }) {
    final physicalHeight = math
        .max(1.0, logicalHeight * math.max(devicePixelRatio, 1.0))
        .toDouble();
    final estimate = (physicalHeight / 5.0).ceil() + 1;
    return math.max(64, math.min(160, estimate)).toInt();
  }

  final int rowCount;
  final Float32List positions;
  final Float32List textureCoordinates;
  final Uint16List indices;

  int get vertexCount => rowCount * columns;
  int get triangleCount => (rowCount - 1) * 2;

  void _buildStaticBuffers(double textureWidth, double textureHeight) {
    for (var row = 0; row < rowCount; row++) {
      final v = row / (rowCount - 1.0);
      final y = v * textureHeight;
      final base = row * 4;

      textureCoordinates[base] = 0.0;
      textureCoordinates[base + 1] = y;
      textureCoordinates[base + 2] = textureWidth;
      textureCoordinates[base + 3] = y;
    }

    var index = 0;
    for (var row = 0; row < rowCount - 1; row++) {
      final topLeft = row * 2;
      final topRight = topLeft + 1;
      final bottomLeft = topLeft + 2;
      final bottomRight = topLeft + 3;

      indices[index++] = topLeft;
      indices[index++] = topRight;
      indices[index++] = bottomLeft;
      indices[index++] = topRight;
      indices[index++] = bottomRight;
      indices[index++] = bottomLeft;
    }
  }

  /// Updates only destination positions. UVs and topology never change.
  void update(GenieFrame frame) {
    for (var row = 0; row < rowCount; row++) {
      final v = row / (rowCount - 1.0);
      final base = row * 4;
      final y = frame.yAt(v);

      positions[base] = frame.leftAt(v);
      positions[base + 1] = y;
      positions[base + 2] = frame.rightAt(v);
      positions[base + 3] = y;
    }
  }

  /// Anti-aliased silhouette clip. `drawVertices` itself does not guarantee
  /// anti-aliased outer edges on every Flutter backend, so the painter clips
  /// the mesh through the exact same sampled boundary.
  ui.Path createBoundaryPath() {
    final path = ui.Path();
    path.moveTo(positions[0], positions[1]);

    for (var row = 1; row < rowCount; row++) {
      final base = row * 4;
      path.lineTo(positions[base], positions[base + 1]);
    }
    for (var row = rowCount - 1; row >= 0; row--) {
      final base = row * 4;
      path.lineTo(positions[base + 2], positions[base + 3]);
    }

    path.close();
    return path;
  }

  ui.Vertices createVertices() => ui.Vertices.raw(
    ui.VertexMode.triangles,
    positions,
    textureCoordinates: textureCoordinates,
    indices: indices,
  );

  ui.Offset positionAt(int row, int column) {
    assert(row >= 0 && row < rowCount);
    assert(column >= 0 && column < columns);
    final index = row * 4 + column * 2;
    return ui.Offset(positions[index], positions[index + 1]);
  }
}
