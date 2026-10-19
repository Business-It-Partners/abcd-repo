# M12 Implementation Notes — Dental OS workspace and shell experience

## Starting baseline

M03 already established the shared window manager, app isolation, dock, overview and Genie composition. M10 established a bounded accessibility/usability baseline. M12 is a product-level UX pass over those foundations, not a new app window system.

## Implementation record

No M12 implementation has started. Do not treat submilestone plans, prototype screenshots or M03/M10 results as M12 acceptance.

## Ownership and boundaries

`src/` owns shell and app presentation; `src/windowManager.tsx` and `src/ManagedWindow.tsx` continue to own shared lifecycle behavior; `electron/` remains the native trusted boundary. Map any new presentation surface to an existing owner before creating new modules. M11 remains authority for verified app updates; shell components may render its state but cannot mint or approve it.

Preserve the existing SaaS as business authority, single active clinic session, first-party-only app boundary, shared dock field/Genie fallback and softer clarity style. Any implementation change must retain app-scoped forms/blur and avoid introducing persistent patient data.

## Change log / deviations

None. Record approved interaction/design decisions, source paths, tests and deviations as each M12 phase begins. Physical Windows visual acceptance is G14 after M13.
