# Agent brief — BAJAOVRLAY-28: REST /api/v1 for Companion and Stream Deck, OpenAPI from Zod

Copied from the brief in the Plane work item's comment (2026-10-31).

**Goal.** Companion, a Stream Deck or any script on the LAN can do over HTTP what an operator
does on the control page, through the same single command path. Today commands arrive only over
the WebSocket, and /api/v1 holds read routes only (state, data snapshots, the flex sample,
media). This item is the door BAJAOVRLAY-48's triggers will use.

## Build

1. **`POST /api/v1/commands`.** The body is the same command envelope the control page sends
   over the WebSocket (the shared command schemas, no copy). The answer is the same command
   result: 200 with the result, 400 for an invalid command, 409 or 422 for a refusal, always
   with the pt-BR reason in the error shape every route uses.
   * It goes through the store's one path (validate → authorize → apply → persist → event log →
     broadcast). There is no REST-only logic.
   * The event log's actor is `api:<token name>`.
2. **A token, one per device.**
   * The tokens come from one variable, `BAJAOVRLAY_API_TOKENS`, as `name=token` pairs
     separated by commas (for example `companion=…,streamdeck=…`), documented in `.env.example`.
   * The request sends `Authorization: Bearer <token>`, compared in constant time. A token is
     never logged and never echoed; the log carries the token's name and `request_id`.
   * With the variable unset, the route answers 403 "API de comandos desligada: defina
     BAJAOVRLAY_API_TOKENS." A wrong or missing token gets 401.
3. **Which commands.** Every command an operator can send from the control page. Never the
   renderer's or the system's own (`reportInstanceStatus`, `refreshBoundInstanceData`,
   `recordDataSourcePoll`, `recordDetectedEvents`, and any other with a non-operator actor),
   refused with 403 and a reason. Write the list once, in shared, next to the command
   definitions, and test it against the full list of commands so a new command must be classed.
4. **Shortcuts for buttons.** Companion's generic HTTP module does best with fixed URLs and no
   body. Add thin routes that each build one command and call the same path:
   * `POST /api/v1/take-next`
   * `POST /api/v1/take-item/:itemId`
   * `POST /api/v1/preview-item/:itemId`
   * `POST /api/v1/take-all-previews`
   * `POST /api/v1/clear-layer/:layerId`
   * `POST /api/v1/clear-all`
   * `POST /api/v1/next-on-layer/:layerId`
   * `POST /api/v1/run-macro/:macroId`
   * `POST /api/v1/stop-macro`
5. **Feedback for button colours.** `GET /api/v1/layers/status` gives, for each output and
   layer, whether something is on air or in preview, and its item's name, the macro running,
   and the token's name. It is small and cheap, so it can be polled every second.
6. **OpenAPI.** Every new route is in `/api/v1/openapi.json`, generated from the Zod schemas,
   with the bearer scheme declared.
7. **Docs.** `docs/companion.md`, a step-by-step for João:
   * set the token;
   * add Companion's "Generic HTTP" connection;
   * make a "Tomar" button, a "Limpar tudo" button and a macro button;
   * colour a button from `/layers/status`.
   * Plus `curl` lines for every shortcut.

## Tests (first)

* Integration on a real SQLite file through Hono's request helper. Cover:
  + each shortcut changes state exactly as its WebSocket command does, compared through the
    same slices;
  + a refusal carries the reasons the WebSocket gives;
  + the event-log row names the `api:` actor;
  + the control page's clients receive the broadcast.
* Auth table, one named row each: no variable, no header, a wrong token, a right one of two, a
  malformed `Authorization` header, a token pasted with surrounding spaces in the variable.
* No token in any log line: capture the logger and assert it.
* The command list test from item 3.

## Out of scope

Roles and PINs for the control page (M4), HTTPS, rate limits (LAN only), a proper Companion
module, OBS (BAJAOVRLAY-27), triggers (BAJAOVRLAY-48).

## Gate 2

Besides the review, João presses a real Companion button that takes an item and one that
clears all.

## Process

Branch `BAJAOVRLAY-28-rest-commands` off main, draft PR, the usual verify and 5× pinned run.

## Earlier note on the work item (João, 2026-10-11)

A hardware macro pad will drive the system, so this REST surface must expose as first-class
endpoints at least: `runMacro` by id, `takeItem` by id, `takeNext` / `takePreview` /
`clearLayer` / `clearAll`, and "fire quick-fire button N of panel P" so a pad can map to
positions rather than ids that change. Token auth, OpenAPI from the Zod schemas as already
planned.

## Addition: an open mode for the studio network (João, 2026-11-01)

João's buttons are Ulanzi D200s, where each button's HTTP call carries its own headers, so a
token per button is unworkable. The API only runs on the dedicated studio network, where the
control page has no login either (PINs are M4).

9. `BAJAOVRLAY_API_OPEN=true` turns the command API on with no token. Every route of this PR
   answers without an `Authorization` header; the actor is `api:rede`, and the request log
   carries the client's IP. Server-only commands are still refused. With
   `BAJAOVRLAY_API_TOKENS` also set, tokens are still accepted and logged by name. With
   neither variable, the API stays off (403), the message naming both. The boot log says
   plainly that the API is open to the whole network. `docs/companion.md` becomes
   `docs/buttons.md` ("Botões: Companion, Stream Deck, Ulanzi D200") with an Ulanzi section:
   an HTTP POST to `http://<server>:3000/api/v1/take-next`, Content Type none, no headers or
   body; the button's look reads `/api/v1/layers/status`. A plain per-layer state route for
   the D200 may follow once João says how the D200 reads state; not in this PR.
