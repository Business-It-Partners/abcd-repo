# M13.3 Work Entry — local verification

**Scope:** version 1.0.0 placeholder shell only. No staging publication, installation, SaaS access, patient data, credential handling, or business workflow is included in this verification.

## Result

`npm test` passed all 5 app-local checks on 2026-10-20. The checks cover the package manifest identity and empty SDK capability list, app metadata and the single Work Entry module, centered page label and staging marker, absence of business API/storage/workflow controls, and the copied artwork's PNG signature and package-size limit.

The copied icon uses the existing Dental OS Work Entry dock artwork, resized to 512×512 and stripped/compressed using the same ImageMagick conversion used by the staging packager. The resulting file is 314,885 bytes, below the dentalpkg 2 MiB per-file limit.

## Integration boundary

All implementation, copied artwork, manifest, tests, and this evidence file are under `apps/dental-apps/company.dental.work-entry/`. Shared runtime, package builder, app registry, root tests, and other app directories were not changed. Staging package assembly and the coordinated M13.2–M13.4 release remain lead-level integration work; this local shell has not been published or installed.
