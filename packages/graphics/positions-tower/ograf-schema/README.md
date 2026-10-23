# ograf-schema (vendored)

The EBU OGraf v1 manifest JSON Schema and every schema it `$ref`s, copied byte for byte so
the manifest test (`src/positionsTowerManifest.test.ts`) runs offline in CI.

Source: https://ograf.ebu.io/v1/specification/json-schemas/ (folders `graphics/`, `lib/`,
`gdd/` mirror the published paths). Fetched 2026-10-08. Do not edit; to update, download
the same files again and record the new date here.
