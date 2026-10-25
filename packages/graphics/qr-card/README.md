# qr-card (`@bajaovrlay/qr-card`)

The QR card OGraf graphic in Ardósia (design: PR #21, catalogue entry 12), on the `lower-third`
layer: the one light surface of the catalogue, a code made from the address, the call to action at
34 px and the address at 26 px. The graphic makes the code itself when it loads, with
`qrcode-generator` (MIT, no dependencies, pinned, bundled into `qr-card.js`) at error-correction
level M: nothing comes from the network. Nothing moves while the card is up. Start reading at
`src/qr-card.ts` (the OGraf lifecycle, the team card's: load once, play in, stop out, update in
place any time after load, every call answers a status, never throws); it wires `qrCardModel.ts`
(Zod data, the address's rules), `qrCodeEncoding.ts` (the squares, and the longest address, 106),
`qrCodeLayout.ts` (whole px a module in the 176 px `--qr-size` box), `qrCardView.ts`,
`qrCardStyles.ts`, `qrCardAnimations.ts` and `ptBR.ts`. Preview: `pnpm --filter @bajaovrlay/qr-card
dev`, then http://localhost:5214/preview.html (add `?address=longest`, `?stage=grey|black` or
`?data=<JSON>`). Unit tests: `pnpm --filter @bajaovrlay/qr-card test`; Playwright on the built
`dist/`, with the scan of the code on screen and the 4 screenshots: `pnpm --filter
@bajaovrlay/qr-card test:e2e` (add `--update-snapshots` after a deliberate visual change).

## A typical item: the results page

Both fields are typed in the item editor.

| Field (form label) | Value in the item editor                                       |
| ------------------ | -------------------------------------------------------------- |
| Chamada            | Acompanhe os resultados                                        |
| Endereço do QR     | resultados.bajasaebrasil.net (no accents or spaces; up to 106) |

The editor refuses an address longer than 106 characters while it is typed; the server refuses one
with a space or an accent at the save. The code holds the address as typed (case included); only
the line under the call is set in caps. Check the preview's code with a phone before the show.
