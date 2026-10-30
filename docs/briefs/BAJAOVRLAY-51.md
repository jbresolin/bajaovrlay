# Agent brief — BAJAOVRLAY-51: Cadastros: "Salvar" waits for image uploads

Found during the gate-2 fix-up of PR #32. The control e2e "a podium of the first three cars, with
car 1's logo" fails on main (0a57c40) about 6 times in 7. The cause is a real operator bug, not a
flaky test: the Cadastros form keeps "Salvar" enabled while an image is still uploading.
`EntityRecordFormPanel.tsx:144` only waits for the server's answer. A save pressed during the upload
stores the record without its logo or photo, and a slow network at the track makes this likely.

## Build

* While any image field of the form is uploading, "Salvar" is off and reads "Enviando imagem…"
  (through the pt-BR catalog). It comes back when every upload has finished or failed.
* A failed upload leaves the field without the new image and shows the upload error, as today, and
  "Salvar" comes back on.
* Enter on the form during an upload does not save either, so the guard sits in the submit handler,
  not only on the button.

## Tests (first)

* Component test with an upload that the test holds open and then releases: "Salvar" is off with
  its text while the upload runs, on after it resolves, and the saved record carries the new
  mediaId.
* Same with a rejected upload: "Salvar" comes back on and the record keeps its old image.
* Enter during the upload sends no command.
* Each test must fail without the change; say in the report how that was checked.
* The podium e2e passes 10 times out of 10 on its own (`--repeat-each=10`) and in a full
  `pnpm verify`. Do not change the e2e to wait longer: it presses "Salvar" right after picking the
  file, as an operator would, and that is the point.

## Process

Branch `BAJAOVRLAY-51-save-waits-for-uploads` off main, draft PR, no quarantine anywhere. PR #32
rebases onto main once this merges.
