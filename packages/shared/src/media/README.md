# packages/shared/src/media

The media store's shared side (BAJAOVRLAY-19): the logos and photos of the entity library,
uploaded to POST /api/v1/media and kept under DATA_DIR/media. Start at `mediaId.ts`: an
image is named by the SHA-256 of its bytes, so its URL (`/media/<mediaId>`) never changes
content and the pattern is also the server's path-safety check. `mediaRecord.ts` is one
image (type, size, width and height) and the `media` slice; `mediaCommands.ts` holds
recordUploadedMedia (the server's media store only), deleteMedia and the upload's answer.

`mediaReferences.ts` lists the images a record names and every use of one image, which
deleteMedia's refusal and the Cadastros page both read. An image is an asset, not data:
a resolved field holds its URL and the graphic draws it with `<img>`, fetching nothing
itself (concept §3.3). `index.ts` lists every export. Tests name images with
`buildFakeMediaId(42)` from `fakeMediaIds.testSupport.ts` ("000…0042", exported as
`@bajaovrlay/shared/fakeMediaIds.testSupport`), never an invented SHA-256.
