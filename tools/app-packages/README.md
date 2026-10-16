# Internal app-package tooling

The normative wire contract is [dentalpkg/1](../../dental-os_v1-documentation/23_V1_PACKAGE_FORMAT.md). Trusted code is currently `electron/packages/`; compile with the existing controlled build before running tools. No dependency install is needed.

`node tools/app-packages/build.mjs <manifest.json> <assets-dir> <key-id> <external-private-key-path> <new-output.dentalpkg>` assembles in sorted order and refuses existing output. Input manifest has exactly appId, publisher, version, entry, sdkMajor, apiMajor, capabilities (no format/assets fields). It must match a separately approved platform trust policy; building alone cannot authorize execution. Keep release private keys in protected release infrastructure; never put them in this checkout, packages, artifacts or chat.

`node tools/app-packages/generate-fixtures.mjs --test-only` deliberately regenerates the two synthetic packages and their public key using a fresh ephemeral signing key, then discards that private key. Outputs must be reviewed and committed together. Do not regenerate during normal checks; existing signed fixtures are stable across launches and hosts. The normal platform policy trusts neither this key nor these sample IDs. No release private key is supplied or generated for production by M06.

M06 has no renderer install path, file picker, package discovery or production sideload command. These assembly commands produce files only. M07 adds approved distribution; M08 adds full update/revocation/rollback policy.
