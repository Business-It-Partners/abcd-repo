# Appointments shell verification

**Package:** `company.dental.appointments` 1.0.0

The app source is a static page with a centered `Appointments` heading and a visible “Staging preview” badge. Its package manifest requests no Dental OS SDK capabilities. The signed app metadata carries the Appointments module and its `appointments.access` visibility rule. The bundled 512 × 512 icon is an optimized copy of the existing Dental OS Appointments dock artwork.

`npm test` runs four app-owned checks covering package identity, the centered preview page, the empty SDK capability list, metadata and artwork, and the absence of workflow/network/storage/credential code. This evidence covers local app source only; signed package assembly, staging publication, installation and managed-window launch are lead integration work.
