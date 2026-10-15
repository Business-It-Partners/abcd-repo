/// Dock geometry — Dock Parity Plan §5, frozen here and read nowhere else
/// from raw numbers. Tune the *look* by editing exactly this file; every
/// engine (math / motion / render) derives everything from these symbols,
/// so they can never silently drift apart.
library;

// ── Icon scale (§3.2 — baseline must be genuinely small) ─────────────────────

/// iconRest — resting icon size. Small on purpose: a chunky baseline flattens
/// the magnification delta (Finding §13).
const double kIconRest = 40.0;

/// iconPeak / iconRest — magnification ratio at the exact lens center.
/// §3.2 calls for ~2.5–3×; 2.75 lands in the dramatic-but-controlled middle.
const double kPeakRatio = 2.75;

/// iconPeak — derived; named for readability at call sites and in the table.
const double kIconPeak = kIconRest * kPeakRatio;

// ── Pill (§4.7, §2.3) ─────────────────────────────────────────────────────────

/// padV — vertical gap from an item's scaled edge to the pill edge.
const double kPadV = 14.0;

/// dockH — resting pill height (icon at rest + padding both sides).
const double kDockRestHeight = kIconRest + kPadV * 2;

/// padH — horizontal inset from the end items to the pill's rounded caps.
const double kPadH = 16.0;

/// pillR — corner radius; macOS keeps it pinned to half the resting height
/// so the pill reads as a stadium, not a rounded rectangle.
const double kPillRadius = kDockRestHeight / 2;

// ── Row (§3.1, §3.3) ──────────────────────────────────────────────────────────

/// gap — inter-item spacing at rest = the spacing the flow-layout integral
/// preserves at *every* live width, which is what makes tearing impossible.
const double kGap = 10.0;

/// R — influence radius in baseline item-slots, each side of the lens.
/// Narrower reads as a spike — the #1 tell of a clone (§3.1, Finding §13).
const double kInfluenceItems = 4.0;

/// Influence radius in pixels — the bell's half-width, derived from R so a
/// change to spacing/size automatically keeps the same *felt* neighborhood.
const double kInfluenceSpreadPx = kInfluenceItems * (kIconRest + kGap);

// ── Components (§4) ───────────────────────────────────────────────────────────

/// sepW / sepH — divider between the pinned and recents sections. Does not
/// magnify (real macOS keeps it rigid); it only gets pushed by the field.
const double kSepWidth = 1.0;
const double kSepHeight = kIconRest * 0.8;

/// thumbW / thumbH — placeholder recent-window container. Wider than square
/// icons (window-shaped, §6.4); same field, same integral — it just
/// contributes more width to the running sum.
const double kThumbWidth = kIconRest * 1.6;
const double kThumbHeight = kIconRest * 1.08;

/// capDy — caption-bubble gap above the focused item's *current* (scaled)
/// top edge — it must track continuously, never snap to a resting position.
const double kCaptionDy = 10.0;

/// dotR — running-app indicator dot radius.
const double kDotRadius = 2.0;

/// kDotDyBelowPill — gap from the pill's bottom edge to the dot center.
/// Measured from pillRect.bottom, NOT from baselineY — the pill bottom is
/// kPadV below baselineY, so the old kDotDy = 6 put the dot inside the glass.
const double kDotDyBelowPill = 4.0;

/// kDotCanvasExtension — extra canvas height below the pill to contain the
/// running dot plus 1px anti-aliasing margin on each side of the dot circle.
/// Used by maxDockFootprint (to size the canvas) and _layoutFor (to shift
/// baselineY up so the pill bottom is kDotCanvasExtension above canvas bottom).
const double kDotCanvasExtension = kDotDyBelowPill + kDotRadius * 2 + 2;
