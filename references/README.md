# Pinned FEWA motion reference

Repository: `fewatechnologies/fewa_business_os`  
Branch: `codex/m08-pharmacy-engine`  
Commit: `314bebd5f45591e966eee2482c7f4a994e2a7564`

The Dart files here are retained reference material only, not runtime dependencies. Original paths are `lib/shell/genie/`, `lib/shell/dock/`, and `docs/motion/GENIE_ENGINE.md`. File hashes are in `SHA256SUMS`.

The initial reading used the local `dev/work-startup` checkout at `b2f90beaad4031459a52de3742837243c70d9f08`. Its relevant field, spring, phase and funnel equations were reconciled with this newer pinned M08 reference. The prototype ports the shared behavior: 40 px rest size, 2.75 peak, 200 px raised-cosine-squared influence; 1200/700 critically damped followers; 636 ms duration; pinch end .50, travel start .40; quadratic spatial easing and two vertices per row with 64–160 adaptive rows.

The user subsequently requested a 10% smaller dock: this prototype now uses 36 px rest icons, 180 px influence, 9 px spacing, and preview/tray geometry scaled to 90%. The 2.75 peak, shared field, spring followers, and Genie equations stay the same. The original sizes above document the pinned source, not the current visual dimensions.

This is a bottom-dock experiment. FEWA's additional top-dock support is not required or implemented. New artwork and icons are intentional prototype assets. Native screenshot capture replaces Flutter's RepaintBoundary. A fixed preview slot keeps the experiment's destination stable; it is not a complete recent-app registry.

Exact visual acceptance requires viewing the running prototype against FEWA; matching equations alone does not constitute that acceptance.
