# Agent brief — BAJAOVRLAY-56: button state routes for the Ulanzi D200

Copied from the brief in the Plane work item's comment (2026-11-02).

**Goal.** Each Ulanzi D200 button shows what it controls: lit while its graphic is on air, a
second look while it is in preview, lit while its macro runs.

The D200's HTTP plugin (Ulanzi Studio):

* polls a status URL with a GET every N seconds (João uses 1 s);
* reads one value by a JSON path, which in João's example is a single key (`muted`);
* compares it with an expected value (`true`) to choose between two images.
* Whether the path can go deeper than one key is unknown, so every value lives at the top level
  of its answer.

The command API of BAJAOVRLAY-28 (PR #34) is the base, with the same access: open mode or tokens.

## Build

1. **`GET /api/v1/state/layer/:layerId`** answers
   `{ "isOnAir": …, "isInPreview": …, "isMarkedToClear": …, "itemName": "…" }`. `itemName` is the
   item on program, or "" when the layer is empty.
2. **`GET /api/v1/state/shortcut/:panelId/:buttonNumber`**, the same counting as
   `fire-shortcut`. It answers `{ "isOnAir": …, "isInPreview": … }`: true when that button's
   item is the one on program (or in preview) on its layer.
3. **`GET /api/v1/state/macro/:macroId`** answers `{ "isRunning": … }`.
4. **Values are JSON booleans.** Check against the D200 that the expected value `true` matches a
   JSON `true`. If it only matches text, make the answer carry `"true"`/`"false"` strings
   instead and record that in decisions.md.
5. **An id that doesn't exist** answers 404 in the shared error shape, so the button shows its
   "unmatched" image.
6. **Cheap and quiet.**
   * These routes read memory only and never write the event log.
   * Fifteen buttons polling every second would write about 54,000 request-log lines an hour,
     so these GETs log at debug and only their errors at warn.
   * Say so in the README.
7. **`docs/buttons.md`, D200 section**, with one worked button each:
   * "TOMAR": the action `take-next`, with no state;
   * a quick-fire button: the action `fire-shortcut/<panel>/<n>`, with status URL
     `state/shortcut/<panel>/<n>`, JSON path `isOnAir` and expected value `true`;
   * "LIMPAR" a layer: the action `clear-layer/<id>`, with status URL `state/layer/<id>` and
     JSON path `isOnAir`;
   * a macro: the action `run-macro/<id>`, with JSON path `isRunning`.

## Tests (first)

* One table per route, each named row after a real situation:
  * the item on air;
  * the same item in preview;
  * another item of the panel on air;
  * a layer marked "vai limpar";
  * a macro running, then stopped;
  * an unknown id.
* Access: the routes answer in open mode with no header, and refuse with 403 when the API is off.
* The request log stays at debug for these routes.

## Process

Branch `BAJAOVRLAY-56-button-state-routes` off main, once PR #34 is merged. Draft PR, flock'd
verify and the 5× pinned run. Gate 2 is one D200 button that lights while its quick-fire item is
on air.
