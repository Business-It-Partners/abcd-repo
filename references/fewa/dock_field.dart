/// The MATH engine — Dock Parity Plan §2.1, §3.
///
/// Pure and stateless: `computeDockLayout(items, ..., field)` always returns
/// the same geometry for the same inputs. No time, no history, no per-item
/// state. Everything — every item's scale, every item's position, the pill's
/// envelope — is sampled from one [DockField] driven by one number: the
/// smoothed cursor x (§0, "the one law").
///
/// Litmus test (§0): if a single item ever needs its own controller to look
/// right, this file is wrong. Fix the field, not the item.
library;

import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/foundation.dart';

import 'dock_metrics.dart';

// ── Item kinds (§4 component list) ───────────────────────────────────────────

enum DockItemKind { pinnedIcon, separator, recentThumbnail, trash }

@immutable
class DockItemSpec {
  const DockItemSpec({
    required this.id,
    required this.kind,
    this.label = '',
    this.glyph = '',
    this.accent,
    this.thumbnail,
    this.isRunning = false,
    this.isMinimized = false,
    this.baseWidth = kIconRest,
    this.baseHeight = kIconRest,
  });

  final String id;
  final DockItemKind kind;
  final String label;
  final String glyph;
  final Color? accent;
  final Image? thumbnail;
  final bool isRunning;
  final bool isMinimized;

  /// Base (resting) footprint. Square for icons/trash, wider for thumbnail
  /// containers (§3.4, §6.4) — the field handles either uniformly.
  final double baseWidth;
  final double baseHeight;

  /// Produces a geometry-native size variant.
  ///
  /// The old width-cap path painted the Dock at full size and then wrapped the
  /// finished pixels in `Transform.scale`. That resampled text, emoji, borders
  /// and thumbnails as one bitmap. Scaling the item metrics before layout lets
  /// every primitive be rasterized at its final display size instead.
  DockItemSpec scaledForRaster(double factor) {
    final safeFactor = factor.clamp(0.01, 1.0).toDouble();
    if ((safeFactor - 1.0).abs() <= 1e-9) return this;
    return DockItemSpec(
      id: id,
      kind: kind,
      label: label,
      glyph: glyph,
      accent: accent,
      thumbnail: thumbnail,
      isRunning: isRunning,
      isMinimized: isMinimized,
      baseWidth: baseWidth * safeFactor,
      baseHeight: baseHeight * safeFactor,
    );
  }

  /// The separator is rigid: it gets pushed by the field but never scales —
  /// matching real macOS, where the divider never magnifies.
  bool get magnifies => kind != DockItemKind.separator;

  /// The separator and trash never show a caption — only launchable items do.
  bool get showsCaption =>
      kind == DockItemKind.pinnedIcon || kind == DockItemKind.recentThumbnail;
}

// ── The field (§2.1, §3.1, §3.2) — one curve, sampled everywhere ─────────────

/// A single continuous function of x: `scaleAt(x)`. Both per-item scale and
/// the pill's bowed top edge sample *this exact function* — which is why
/// they can never tear or disagree (§3.3 extended to the envelope itself).
@immutable
class DockField {
  const DockField({
    this.cursorX,
    this.intensity = 0.0,
    this.spreadPx = kInfluenceSpreadPx,
    this.peakRatio = kPeakRatio,
  });

  /// Smoothed cursor x (MOTION engine output) — null when the cursor (or its
  /// settle-out tail) is fully outside the dock's influence.
  final double? cursorX;

  /// Entry-swell / exit-settle envelope, 0..1 (§2.2). Modulates the bell's
  /// amplitude so the wave visibly grows in and relaxes out rather than
  /// snapping — without granting any single item its own animation.
  final double intensity;

  /// Half-width of the influence neighborhood, in pixels (§3.1).
  final double spreadPx;

  /// Peak/rest ratio at the exact lens center (§3.2).
  final double peakRatio;

  /// Raised-cosine-squared bell — smooth shoulders, C¹-continuous: zero
  /// magnitude *and* zero slope at d = ±spreadPx, so neighbors entering or
  /// leaving the neighborhood never produce a velocity kink (§3.1, §8).
  double bellAt(double signedDistance) {
    final cx = cursorX;
    if (cx == null) return 0.0;
    final d = signedDistance.abs();
    if (d >= spreadPx) return 0.0;
    final t = math.cos(d / spreadPx * (math.pi / 2));
    return t * t;
  }

  /// scale(x) — 1.0 at rest, [peakRatio] under the lens center, falling off
  /// through the neighborhood on a gentle shoulder (§3.1, §3.2).
  double scaleAt(double x) {
    final cx = cursorX;
    if (cx == null || intensity <= 0.0) return 1.0;
    return 1.0 + (peakRatio - 1.0) * bellAt(x - cx) * intensity;
  }
}

// ── Computed geometry (output of the pure function) ──────────────────────────

@immutable
class DockItemGeometry {
  const DockItemGeometry({
    required this.spec,
    required this.center,
    required this.width,
    required this.height,
    required this.scale,
    required this.restCenterX,
  });

  final DockItemSpec spec;

  /// Live center — sub-pixel, recomputed every frame (§2.3, §8).
  final Offset center;
  final double width;
  final double height;
  final double scale;

  /// Fixed baseline-slot center. Distances are measured *from here*, never
  /// from the live center — that would close a feedback loop and make the
  /// field stateful. Keeping it here also lets the render layer answer
  /// "where does this item rest" without a second pass (§3.3).
  final double restCenterX;

  Rect get rect =>
      Rect.fromCenter(center: center, width: width, height: height);

  /// Continuous "how focused is this item right now", 0 at rest, 1 at the
  /// lens peak. Drives caption opacity/selection — itself just a sample of
  /// the same field, never an owned animation (§2.3).
  double get focusT => ((scale - 1.0) / (kPeakRatio - 1.0)).clamp(0.0, 1.0);
}

@immutable
class DockLayout {
  const DockLayout({
    required this.items,
    required this.pillRect,
    required this.focusedIndex,
  });

  factory DockLayout.empty() =>
      const DockLayout(items: [], pillRect: Rect.zero, focusedIndex: null);

  final List<DockItemGeometry> items;

  /// The frosted pill's bounding envelope — bottom-anchored, breathes in
  /// width and height as one input to the same layout pass (§2.3, §7).
  final Rect pillRect;

  /// Index of the item currently nearest the lens peak, or null when no
  /// item is magnified above rest. Used for the caption bubble (§4.6).
  final int? focusedIndex;

  DockItemGeometry? get focused =>
      focusedIndex == null ? null : items[focusedIndex!];

  /// Hit-tests against the *exact* geometry that was painted this frame —
  /// what you see is what you tap, by construction. There is no parallel
  /// hit-test layout to drift out of sync with the visuals (§0, §11.5).
  DockItemGeometry? hitTest(Offset position) {
    for (final item in items) {
      if (item.spec.kind != DockItemKind.separator &&
          item.rect.contains(position)) {
        return item;
      }
    }
    return null;
  }
}

/// The envelope a layout actually *occupies* on screen — the glass pill
/// (now fixed-height, §4.7) union every item's live rect. Needed because the
/// pill no longer bounds the tallest item: magnified icons deliberately
/// overflow above its constant top edge (exactly as on real macOS, where the
/// shelf never grows but the icons popping out of it visibly do).
Rect _visualBounds(DockLayout layout) {
  var bounds = layout.pillRect;
  for (final item in layout.items) {
    bounds = bounds.expandToInclude(item.rect);
  }
  return bounds;
}

/// Samples the field across the full row to find the true worst-case visual
/// envelope for this item *list* (not this frame). Cheap — only recomputed
/// when the item count changes, never per frame — and exact rather than
/// guessed: the canvas the render engine allocates is sized from the same
/// function that drives the visuals, so it can never clip the wave, and the
/// hover/hit-test region it backs always fully covers magnified icons even
/// though the (now constant-height) glass pill does not (§2.3, §4.7).
Size maxDockFootprint(List<DockItemSpec> items) {
  if (items.isEmpty) return Size.zero;

  final rest = computeDockLayout(
    items: items,
    anchorCenterX: 0,
    baselineY: 0,
    field: const DockField(),
  );
  final restWidth = rest.pillRect.width;
  var bounds = _visualBounds(rest);

  const samples = 48;
  for (var i = 0; i <= samples; i++) {
    final x = -restWidth / 2 + restWidth * (i / samples);
    final probe = computeDockLayout(
      items: items,
      anchorCenterX: 0,
      baselineY: 0,
      field: DockField(cursorX: x, intensity: 1.0),
    );
    bounds = bounds.expandToInclude(_visualBounds(probe));
  }

  // `_visualBounds` puts the tallest magnified icon's top edge flush against
  // the envelope — no breathing room. Pad by `kPadV` so the canvas (and thus
  // the hover/hit-test region riding on it) never has the peak icon touching
  // its edge, matching the symmetric padding the old pill-only sizing gave
  // "for free" before the pill stopped tracking live item heights (§4.7).
  //
  // The extra kDotDyBelowPill + kDotRadius * 2 + 2 extends the canvas below
  // the pill bottom to contain the running-app dot that paints outside the
  // pill. Without this the dot is clipped by the canvas edge.
  return Size(bounds.width, bounds.height + kPadV + kDotCanvasExtension);
}

// ── The pure layout function — §0, §2.1 ──────────────────────────────────────

/// Given a stable item list, an anchor, a baseline, and one [DockField]
/// sample, returns the *entire* dock geometry for this instant. Calling it
/// twice with identical arguments yields identical output — no history, no
/// surprises, nothing to desync (§2.1 "stateless: same x always yields the
/// same layout").
DockLayout computeDockLayout({
  required List<DockItemSpec> items,
  required double anchorCenterX,
  required double baselineY,
  required DockField field,
}) {
  if (items.isEmpty) return DockLayout.empty();

  // ── Pass 1 — rest layout (fixed baseline slots) ──────────────────────────
  final restCenters = List<double>.filled(items.length, 0.0);
  double cursor = 0.0;
  var restTallest = 0.0;
  for (var i = 0; i < items.length; i++) {
    final w = items[i].baseWidth;
    restCenters[i] = cursor + w / 2.0;
    cursor += w + ((i == items.length - 1) ? 0.0 : kGap);
    if (items[i].baseHeight > restTallest) restTallest = items[i].baseHeight;
  }
  final restTotalWidth = cursor;
  final restLeft = anchorCenterX - restTotalWidth / 2.0;
  for (var i = 0; i < items.length; i++) {
    restCenters[i] += restLeft;
  }

  // ── Pass 2 — sample the field once per item, from the rest slot ──────────
  final scales = List<double>.generate(
    items.length,
    (i) => items[i].magnifies ? field.scaleAt(restCenters[i]) : 1.0,
    growable: false,
  );
  final widths = List<double>.generate(
    items.length,
    (i) => items[i].baseWidth * scales[i],
    growable: false,
  );
  final heights = List<double>.generate(
    items.length,
    (i) => items[i].baseHeight * scales[i],
    growable: false,
  );

  // ── Pass 3 — flow layout from live widths == integral of the same curve ──
  var liveTotalWidth = kGap * (items.length - 1);
  for (final w in widths) {
    liveTotalWidth += w;
  }
  final liveLeft = anchorCenterX - liveTotalWidth / 2.0;

  var x = liveLeft;
  int? focusedIndex;
  var bestScale = 1.0;
  final geometries = <DockItemGeometry>[];
  for (var i = 0; i < items.length; i++) {
    final w = widths[i];
    final h = heights[i];
    final center = Offset(x + w / 2.0, baselineY - h / 2.0);

    geometries.add(
      DockItemGeometry(
        spec: items[i],
        center: center,
        width: w,
        height: h,
        scale: scales[i],
        restCenterX: restCenters[i],
      ),
    );

    if (items[i].magnifies && scales[i] > bestScale) {
      bestScale = scales[i];
      focusedIndex = i;
    }

    x += w + kGap;
  }

  // The pill's height is fixed from resting item extents. Icons overflow above
  // it during magnification; only the horizontal integral breathes.
  final pillRect = Rect.fromLTRB(
    liveLeft - kPadH,
    baselineY - restTallest - kPadV,
    liveLeft + liveTotalWidth + kPadH,
    baselineY + kPadV,
  );

  return DockLayout(
    items: geometries,
    pillRect: pillRect,
    focusedIndex: focusedIndex,
  );
}
