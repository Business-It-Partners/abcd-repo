# M19 Plan — Dock, Applications, and Window Audit

**Status:** VERIFIED — 2026-10-26.
**Starting source:** b11a4b12 on codex/app-store-infrastructure-audit.
**Worktree:** /home/master-x/.codex/worktrees/app-store-infrastructure-audit/fewa_business_os.
**Dependencies:** Existing shared shell, dock, managed-window lifecycle, and isolated runtime.
**Gate:** No new G19 gate. M19 provides review evidence for existing G12/G15 records but does not close them.

## Outcome

Make the existing Dental OS dock and managed app windows dependable for the V1 clinic workflow: launch or activate an app, switch between the two allowed open apps, use window controls, close and reopen safely, and recover one failed app while the shell remains usable.

## Scope

M19 is limited to the findings from the Segment 3 Dock, Applications, and Window Management audit. The existing two-open-window policy remains. The Genie minimize/restore effect is visual polish; retain graceful fallback and reduced-motion behavior without expanding it into a desktop-compositor project.

No work on app business features, package distribution policy, host releases, or unrelated platform gates is included. The audit follow-up does not alter G12, G15, G20, or G21.

## Submilestones

| Submilestone | Scope | Status | Plan |
| --- | --- | --- | --- |
| M19.1 — Dock click reliability | Prevent an in-flight launch of one app from silently swallowing a click on another app. | VERIFIED | [Plan](M19.1_DOCK_CLICK_RELIABILITY_PLAN.md) |
| M19.2 — Window controls and V1 flow | Verify launch, activation, switching, minimize/restore, maximize/restore, close/reopen, and the two-app limit on current source. | VERIFIED | [Plan](M19.2_WINDOW_CONTROLS_PLAN.md) |
| M19.3 — App failure and recovery | Verify a failed or unresponsive app can be restarted while the shell and another app remain usable. | VERIFIED | [Plan](M19.3_APP_RECOVERY_PLAN.md) |
| M19.4 — Test alignment and launch feedback | Align outdated UI tests with the two-app cap and make launch-feedback checks stable. | VERIFIED | [Plan](M19.4_TEST_ALIGNMENT_PLAN.md) |

## Execution order

Completed in the order above. Exact-source reports and limitations are in [the evidence ledger](VERIFICATION_EVIDENCE.md).

## Verification and completion

- Preserve the two-open-window limit and its explicit close-or-cancel behavior.
- Verify one managed window per app identity; repeated dock activation focuses/restores that window rather than creating a duplicate.
- Verify all listed window controls and close/reopen behavior in private UI checks.
- Inject app failure or unresponsiveness and show that the shell and a second app remain usable; explicitly restart and reopen the failed app.
- Keep the launch splash/handoff checks about readiness and correct state. Avoid requiring a brittle exact animation-frame schedule.
- Keep the Genie effect presentational. Verify reduced-motion and animation-failure paths settle the same lifecycle states.
- Bind reports to the tested source revision. Do not treat the planning record or the earlier audit summary as final acceptance evidence.

## Coordination and boundaries

M19 implementation was completed in the user-requested audit worktree and then integrated into M15 by explicit user direction. Keep the integrated source and current status in the M15 worktree. Do not create another branch or worktree for M19. Keep one heavy build/test job active at a time and use the repository's private UI test runner. Do not alter other milestone gates or claim full V1 product acceptance from M19 completion alone.
