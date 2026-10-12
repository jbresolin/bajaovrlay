# packages/graphics

On-air graphics, one folder per graphic, each an EBU OGraf v1 package: a `*.ograf.json`
manifest plus a web component (Lit, GSAP for animation, CSS custom properties for theme
values). Graphics receive resolved data only and never fetch anything themselves.

`race-clock/` is the first graphic and the template every later graphic copies: start
reading at its README.md, which also says how to copy it.

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
- `v_baja.role: "wallClock"` on an `integer` — the field may be left "to the moment of the
  take": the server then writes its own clock's milliseconds into it. The server refuses
  to do that for any field not declared exactly so.
- `v_baja.role: "clockTime"` (on the `unit: "ms"` time), `"clockRunning"` (on the
  `boolean`) and `"clockMode"` (on the `elapsed`/`remaining` enum) — with `wallClock`,
  the four fields that are a clock. Each role once; if one is missing the time field
  shows the reference time, as for any graphic.

`schema.required` lists the fields that cannot be left blank; every other field gets a
"limpar" control and, once cleared, is not sent to the graphic at all (never as `null`).

Arrays, nested objects and `oneOf` are not supported yet: such a property is shown as
read-only JSON until M2/M3.
