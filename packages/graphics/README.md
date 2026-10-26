# packages/graphics

On-air graphics, one folder per graphic, each an EBU OGraf v1 package: a `*.ograf.json`
manifest plus a web component (Lit, GSAP for animation, CSS custom properties for theme
values). Graphics receive resolved data only and never fetch anything themselves.

`race-clock/` is the first graphic and the template every later graphic copies: start
reading at its README.md, which also says how to copy it.
`positions-tower/` is the first data graphic (a whole list bound live to a source) and
the template for the next one with rows.
`notice/` is the card under the bug for a fastest lap or a race control notice, the first
graphic with two variants in one manifest (`variant`) and an on-air hold left to the server.
`lower-strip/` is the bar along the bottom: the clock block, the running order six cars a page.
`message-ticker/` is the same bar with an "AVISO" label and one typed announcement a page.
`sponsor-bug/` is the card top-left all day: the mark, the event word and one sponsor's logo.
`countdown/`, `sessions-board/`, `sponsor-roll/` and `intermission-board/` (BAJAOVRLAY-46) are the
narrow boards and cards that read whole lists from Cadastros ("Lista dos cadastros"); each README
ends with a typical item, field by field.
`podium/` is the full-screen podium, three cards revealed one per step (3rd, 2nd, 1st), each
crowned by its team's logo through the `withTeamLogos` binding transform.
`bracket/` is the full-screen elimination bracket: round boards for the big rounds, the tree from
the quarter-finals, its steps counted from the rounds (`stepCount` -1 and `v_baja.stepCounter`).
`battle-card/` is two cars fighting for one place, bottom-centre, with the gap and its trend.
`qr-card/` is the one light card: a QR code made from the address in the graphic, nothing fetched.
`kit/` (`@bajaovrlay/graphics-kit`) is not a graphic: it holds what the graphics share (the OGraf
types, the play step rule, the page turner, timeline playback, the preview page's controls, the
manifest validator for tests), bundled into each graphic by Vite; its README lists what is there.
Every value a graphic draws with comes from the
theme (`packages/theme`): tokens on the renderer page's `:root`, read as `var(--token)`
inside the shadow root, never a colour or a size of the graphic's own.
A media URL (`/media/<mediaId>`, a logo or a photo) is drawn with `<img>` only, never with
`<object>`, `<embed>` or `<iframe>`: those would run the script an uploaded SVG may carry.

Each graphic folder is its own workspace package (`pnpm-workspace.yaml` already lists
`packages/graphics/*`). A graphic joins the checks without editing anything at the root:
a `vitest.config.ts` is picked up by `pnpm test`, and a `test:e2e` script by
`pnpm test:e2e` and CI, provided it depends on `"@playwright/test": "catalog:"`.

## What the control page reads from your manifest

The operator's form for a graphic is generated from the manifest; no control-page code is
written per graphic. Write every `title` and `description` in pt-BR.

On the manifest itself:

- `v_baja.defaultLayerId` — the layer the graphic is offered on (missing or unknown:
  fullscreen, with a logged warning).
- `v_baja.category` — the group it is listed under (missing: `other`).
- `v_baja.stepCounter` — with `stepCount: -1` (OGraf's "dynamic"), the named step counter the
  server counts the graphic's steps with, from its data (`bracketSteps`, the bracket's;
  packages/shared/src/steps/stepCounters.ts). An unknown name is warned about at boot and
  gives the graphic one step.
- `v_baja.updateRule` — the named rule the server runs every update of the graphic on
  air through (`carryClockForward` keeps a clock from jumping). An unknown name, or a
  schema without the fields the rule needs, is warned about at boot and makes every
  update of the graphic refused. Missing: no rule. The control page reads it too: with
  `carryClockForward` and the four clock roles below, "Edição rápida" shows the time on
  screen in the time field while the graphic is on air.

On each property of `schema.properties` (`type` picks the control: `string` text,
`integer`/`number` number, `boolean` switch):

- `title` — the field's label (missing: the property key). `description` — the help text.
- `enum` — makes a `string` a select; option labels come from `gddOptions.labels`
  (missing: the enum value itself).
- `default` — the value a new form starts with.
- `minimum` / `maximum` — the limits of a number field.
- `format: "date-time"` on a `string` — a date and time input, sent as ISO 8601 text.
- `v_baja.unit: "ms"` on an `integer`/`number` — typed as `mm:ss`, sent as milliseconds.
- `v_baja.unit: "epochMs"` on an `integer` — a moment (a session's start), typed with the
  date and time input on the operator's clock, sent as milliseconds since 1970 (BAJAOVRLAY-46).
  A schedule slot's `startsAtMs` from Cadastros fits it.
- `v_baja.role` — one of the four clock roles, or the image role, each on its own kind of
  property:
  - `"wallClock"` on an `integer` (milliseconds since 1970): the reference moment. The
    field may be left "to the moment of the take": the server then writes its own clock's
    milliseconds into it, and refuses to do that for any field not declared exactly so.
  - `"clockTime"` on the `integer`/`number` that also has `v_baja.unit: "ms"`: the
    reference time.
  - `"clockRunning"` on a `boolean`: whether the clock is counting.
  - `"clockMode"` on a `string` with `enum: ["elapsed", "remaining"]`: which way it counts.

  - `"imageUrl"` on a `string`: an image field (a team's logo, a car photo, a sponsor's
    logo). The value is the image's address on the server, `/media/<mediaId>`, which the
    graphic draws with `<img src>` and nothing else (an `<img>` runs no script, even for an
    SVG). Typed by hand, the field is an image picker that uploads the file to the media
    store; read from the entity library ("Cadastro"), it is offered the image attributes
    only (`logoUrl`, `carPhotoUrl`, `photoUrl`), and no text. A record with no image leaves
    the field out, so an optional image field must draw a finished "no image" state.

  `wallClock` works alone. The four together (each exactly once, plus
  `v_baja.updateRule: "carryClockForward"`) are what makes the graphic a clock for the
  control page; if one is missing, repeated or on the wrong kind of property, the time
  field shows the reference time, as for any graphic.

- `v_baja.suggestedBinding` — `{ shapeKey, path, isLive }`, where the data usually comes
  from (the tower's cars: `{ "shapeKey": "positions", "path": "entries", "isLive": true }`).
  The item editor pre-fills that field's "Fonte" for a new item when exactly one enabled
  source has that shape in its last good data; with none or several, the field opens
  plain. The path must be one the editor offers for the shape and fit the field (a whole
  list on an `array`, a text on a `string`…) and must not need a car number; a hint that
  fails those rules is ignored, never an error.

Any `string` (without `enum`), whole-number or `boolean` field may also read the entity library
in the item editor ("Cadastro", BAJAOVRLAY-19): one attribute of one team (by car number),
person, sponsor or schedule slot, always live. A text attribute fits a `string`, a whole number
an `integer`/`number`, a yes or no a `boolean` (a team's or a sponsor's "Logo sobre placa
clara", BAJAOVRLAY-24 and -23); nothing of the library fits a fixed list.

`schema.required` lists the fields that cannot be left blank; every other field gets a
"limpar" control and, once cleared, is not sent to the graphic at all (never as `null`).

An `array` whose `items` are a plain `type: string` (no `enum`, no `format`) is a list of
texts typed line by line (BAJAOVRLAY-23; the message ticker's messages): one input a line,
"Adicionar <linha>" and each line's controls named after `items.title` ("Mensagem"; missing:
"Linha"), each line checked against `items.minLength` / `items.maxLength` and the list against
`minItems` / `maxItems`, in pt-BR, before anything is sent. It offers no "Fonte" and no
"Cadastro". Other arrays, nested objects and `oneOf` are not typed by hand: such a property
is shown as read-only JSON. An `array` of objects may still read a whole list from a source
("Fonte" in the item editor: the positions, the standings or the bracket rounds).
