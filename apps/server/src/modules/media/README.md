# apps/server/src/modules/media

The media store (BAJAOVRLAY-19): the logos and photos of the entity library, kept as files
under `DATA_DIR/media/<mediaId>` and listed in the `media` slice. The record and command
schemas are shared code (`packages/shared/src/media/`).

Start at `mediaUpload.ts`: an upload is refused over 5 MB, checked by its bytes alone
(`imageContent.ts`, with `rasterImageSizes.ts` and `svgImageSize.ts` reading the size),
named by its SHA-256, written, then recorded with recordUploadedMedia as `sistema:midia`.
`api.ts` declares POST /api/v1/media and serves GET /media/<mediaId> with a year of cache,
nosniff and a Content-Security-Policy that runs no script, so an SVG opened directly runs
nothing. `reducers/` holds recordUploadedMedia and deleteMedia (refused while a record uses
the image); `service.ts` removes the file of an image that left the slice, and
`mediaOfRecords.ts` is the check every entity write runs. `index.ts` lists what core may use.
