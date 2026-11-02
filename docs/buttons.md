# Botões: Companion, Stream Deck, Ulanzi D200

A step-by-step guide to running the show from hardware buttons, using the command API built in
BAJAOVRLAY-28: Bitfocus Companion (and so a Stream Deck or any macro pad Companion drives), an
Ulanzi D200, or a script. Every button press goes through the same single command path as a
click on the control page: it is checked, saved, written to the event log as `api:<device name>`
(or `api:rede`, see below), and broadcast to every open page.

The examples assume the server runs at `http://192.168.0.10:3000`. Use your server's address;
the Docker image on the stream PC answers on port 8080. Run from a checkout, the server must
listen on the LAN (`HOST=0.0.0.0` in `.env`) for a button to reach it from another machine.

## 1. Choose how the buttons get in

The command API is off until one of two variables turns it on. Set them in `.env` (dev), in
the compose file under `environment:` (stream PC) or under the stack's "Environment variables"
(TrueNAS), then restart the server.

- **Open to the studio network: `BAJAOVRLAY_API_OPEN=true`.** Any machine on the network may
  press a button, with no token. Use it only on the dedicated studio network, where the control
  page has no login either. It is the mode for the Ulanzi D200, whose buttons each carry their
  own headers, so typing a token into every one does not work. A call with no token is written
  to the event log as `api:rede`, and its log line carries the address it came from
  (`client_ip`), so a stray press can be traced. The boot log warns that the API is open to the
  whole network.
- **By token: `BAJAOVRLAY_API_TOKENS`.** Each device sends its own token (section 2). Use it
  anywhere else, and whenever the event log should name the device. Companion and a Stream Deck
  handle a header once per connection, so a token costs nothing there.

Both may be set together: a device with a token is then logged by its name, and a call with no
header as `api:rede`. A wrong token is refused (401) even when the API is open, so a device set
up with an old token is told so. The name `rede` is kept for calls with no token: no device may
take it.

With neither variable, every command route answers 403 "API de comandos desligada: defina
BAJAOVRLAY_API_TOKENS, ou BAJAOVRLAY_API_OPEN=true numa rede só do estúdio." A server reachable
from outside the studio never opens by accident: the open mode is only ever turned on by hand.

## 2. Set the tokens

Skip this section if the API is open and no device needs its own name. Each device gets its own
token, so the event log can tell them apart and a lost device can be cut off alone.

1. Make a token for each device, on any machine with OpenSSL:

   ```sh
   openssl rand -hex 16
   ```

2. Add them as `name=token` pairs separated by commas. The name is 1 to 40 letters, digits, `-`
   or `_` (not `rede`); the token is at least 16 characters, no spaces.

   ```sh
   BAJAOVRLAY_API_TOKENS=companion=<the first token>,streamdeck=<the second token>
   ```

3. Restart the server. The boot log's "command API" line lists the device names
   (`api_token_names`), never the tokens. A token that cannot be used stops the boot with a
   message naming the device.

Check it from a terminal before opening Companion:

```sh
export BAJA=http://192.168.0.10:3000/api/v1
export TOKEN=<Companion's token>
curl -s -H "Authorization: Bearer $TOKEN" $BAJA/layers/status
```

The answer starts with `"tokenName":"companion"` (`"tokenName":"rede"` for a call with no
token on an open API).

## 3. Ulanzi D200 buttons

With the API open (section 1), a D200 button is one HTTP request with nothing to fill in but
the address, and, for a button that shows what it controls, a status URL it polls. The D200's
HTTP plugin reads one value from the status answer by a JSON path and compares it with an
expected value to choose between two images. Each status URL answers a flat object with every
value at the top level, so the path is always one word.

The status URLs (`GET`, no header on an open API):

| Status URL                      | Answer                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `state/layer/<layer id>`        | `{ "isOnAir": true, "isInPreview": false, "isMarkedToClear": false, "itemName": "Relógio no canto" }` |
| `state/shortcut/<panel id>/<n>` | `{ "isOnAir": true, "isInPreview": false }`                                                           |
| `state/macro/<macro id>`        | `{ "isRunning": false }`                                                                              |

- `isOnAir` / `isInPreview`: the layer has a graphic on air / in Prévia; for a quick-fire
  button, _that button's item_ is on air / in Prévia (another item of the panel on the same
  layer leaves it dark).
- `isMarkedToClear`: the layer is marked "vai limpar" in Prévia; the next take clears it.
- `itemName`: the label of the item on air on the layer, `""` when there is none.
- `isRunning`: the macro runs, from the press until its run ends ("Parar" included: it still
  counts as running until the step in progress ends).
- The values are JSON booleans (`true`, not `"true"`).
- An id that names nothing (a mistyped layer, a deleted macro, a button past the panel's last
  one) answers 404, so the button shows its "unmatched" image.

They read the server's memory only and write nothing to the event log, so a poll every second
costs nothing. A poll is logged at `debug`, so it never fills the log; only a refused poll (a
404, a 401) is logged, at `warn`, which is where to look when a button stays on "unmatched".

In Ulanzi Studio, drag an **HTTP request** action (the name may differ by version) onto the
button and fill it in as below. The URLs start with `http://192.168.0.10:3000/api/v1/`; only
their end is shown. The ids a button needs are found as in section 5.

### "TOMAR"

- Method **POST**, URL `take-next`, Content Type **none**, no headers, no body.
- No status URL: "Tomar" takes whatever is under the cursor, so it has no state of its own.
- Text: `TOMAR`.

### A quick-fire button that lights while its item is on air

- Method **POST**, URL `fire-shortcut/atalhos/1` (button 1 of "Atalhos"; section 6 explains
  the counting).
- Status URL `state/shortcut/atalhos/1`, every **1** s.
- JSON path `isOnAir`, expected value `true`.
- The image for a match: lit (red, as on air on the control page); the other one: dark.

The status URL and the action name the same panel and number, so the button always lights for
the very item it fires, even after buttons are moved on the page. For a second look while the
item waits in Prévia, a second state on the same button can read the path `isInPreview`, if
your Ulanzi Studio offers more than one.

### "LIMPAR" a layer

- Method **POST**, URL `clear-layer/bug` (the seeded corner layer; section 5 lists the others).
- Status URL `state/layer/bug`, every **1** s.
- JSON path `isOnAir`, expected value `true`: lit while something is on the layer, so there is
  something to clear.
- Text: `LIMPAR CANTO`.

`isMarkedToClear` is there for a button that should show "vai limpar" is armed in Prévia.

### A macro button

- Method **POST**, URL `run-macro/<the macro's id>`.
- Status URL `state/macro/<the macro's id>`, every **1** s.
- JSON path `isRunning`, expected value `true`: lit while the macro runs.
- Text: the macro's label, for example `ABRIR SESSÃO`.

Every other shortcut in section 8 works the same way: only the end of the URL changes, for
example `.../api/v1/clear-all` for "Limpar tudo".

The D200's field names above have not been checked against a real D200, nor whether its
expected value `true` matches the JSON `true` (rather than only the text `"true"`); gate 2 of
BAJAOVRLAY-56 checks both on João's D200.

## 4. Add Companion's "Generic HTTP" connection

1. In Companion's admin page, open **Connections**, search for **Generic HTTP**, and add it.
2. Name it `BajaOvrLay`.
3. In **Base URL**, type `http://192.168.0.10:3000/api/v1`. Every action below then names only
   the end of the address.
4. Save.

With tokens, every request needs Companion's. In each action below, put this in the **Header**
field (it takes JSON); with the API open, leave the field empty:

```json
{ "Authorization": "Bearer <Companion's token>" }
```

## 5. Find the ids a button needs

"Tomar" and "Limpar tudo" need no id. A button for one item, one layer or one macro names it by
its id, which the control page does not show. Read them from the server:

```sh
# Every item: its id, its label and where it lives (a rundown or a quick-fire panel).
curl -s $BAJA/state | jq -r '.items[] | "\(.id)  \(.label)  \(.home.kind)"'

# Every macro: its id and its label.
curl -s $BAJA/state | jq -r '.macros[] | "\(.id)  \(.label)"'

# Every layer: its id, its output and its name.
curl -s $BAJA/state | jq -r '.layers[] | "\(.id)  \(.outputId)  \(.name)"'
```

A new database seeds the program output's layers as `bug`, `ticker`, `clock`, `tower`,
`lower-third`, `notice` and `fullscreen`. An item's id never changes while the item exists; a
deleted and recreated item gets a new one, and its button must be edited.

## 6. Make the buttons

For each button: add a button on a page, give it its text, and under **Press actions** add
**BajaOvrLay: POST**, with the URL below, the body left empty and the header from section 4.

### "Tomar"

Puts the item under the rundown's cursor on air and moves the cursor on, as the control page's
"Tomar" button does.

- Text: `TOMAR`
- URL: `take-next`

Unlike the page's Space key, it never sends what Prévia holds instead: a fixed button does one
thing. To air what Prévia shows, make a "Tomar tudo" button with `take-all-previews`.

### A quick-fire button by its place

Fires the n-th button of a quick-fire panel, as a click on it does: the item goes on air and
the rundown's cursor stays where it is. A pad's key then follows a place, not an item, so a
button remade on the page keeps working from the same key.

- Text: what the button shows on the page, for example `RELÓGIO CANTO`
- URL: `fire-shortcut/<the panel's id>/<n>`, for example `fire-shortcut/atalhos/1`

Buttons are counted from 1 in the panel's order, as the digit keys 1–9 count them (with no
stop at nine). The seeded panel "Atalhos" has the id `atalhos`; the ids of other panels are in
`curl -s $BAJA/state | jq -r '.quickFirePanels[] | "\(.id)  \(.name)"'`. A panel that does not
exist, or a number past its last button, answers 422 with the reason in pt-BR. Moving a button
on the page moves what its number fires, as with the digit keys.

### "Limpar tudo"

The panic button: takes everything off every layer of every output.

- Text: `LIMPAR TUDO`
- URL: `clear-all`
- Colour it red, so it is never pressed by mistake for another.

### A macro button

Starts one macro, as its button on the control page does.

- Text: the macro's label, for example `ABRIR SESSÃO`
- URL: `run-macro/<the macro's id>`, for example `run-macro/7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11`

A second macro pressed while one runs is refused, as on the page. A "Parar" button is
`stop-macro`: it stops whichever macro is running, and does nothing when none is.

## 7. Colour a button from `/layers/status`

`GET /layers/status` answers what a button needs to show, read from memory, so it can be asked
every second:

```json
{
  "tokenName": "companion",
  "runningMacro": { "macroId": "7d3c1a52-…", "label": "Abrir a sessão", "isStopping": false },
  "outputs": {
    "program": {
      "name": "Programa",
      "layers": {
        "clock": {
          "name": "Relógio",
          "isOnAir": true,
          "onAirItemName": "Relógio do enduro",
          "isInPreview": false,
          "previewItemName": null
        }
      }
    }
  }
}
```

Outputs and layers are keyed by id, so a value has a fixed path, for example
`outputs.program.layers.clock.isOnAir` (or, for an id with a `-`,
`outputs.program.layers['lower-third'].isOnAir`; see below). `runningMacro` is `null` when no
macro runs.

To turn the "Tomar" button of the clock red while the clock is on air:

1. Under **Variables → Custom variables**, add one named `baja_status`.
2. Under **Triggers**, add a trigger:
   - Event: **Time interval**, every 1 second.
   - Action: **BajaOvrLay: GET**, URL `layers/status`, the header from section 4, and **JSON
     Response Data Variable** set to `baja_status`.
3. On the button, under **Feedbacks**, add **Internal: Check expression** with the expression

   ```
   jsonpath($(custom:baja_status), '$.outputs.program.layers.clock.isOnAir') == true
   ```

   and set its style to a red background.

A layer made on "Saídas e camadas" may have an id that starts with a digit or holds a `-`
(the seeded `lower-third` does too). The dot form cannot name such an id; write it in brackets
and quotes instead:

```
jsonpath($(custom:baja_status), "$.outputs.program.layers['lower-third'].isOnAir") == true
```

The bracket form works for every id, so it is the safe one to copy. An output's id can hold a
`-` as well (`$.outputs['pip-2'].layers['legenda-pip'].isInPreview`).

The same way, `isInPreview` can turn a button green while its item waits in Prévia, and
`$.runningMacro.macroId` can light the button of the macro that runs.

The names of Companion's fields above are those of Companion 3 with the Generic HTTP module 2;
another version may word them differently. If a feedback stays dark, check the custom variable
under **Variables** first: it shows the last answer, or the error.

## 8. Every shortcut from a terminal

With `BAJA` and `TOKEN` set as in section 2; with the API open, leave out the
`-H "Authorization: …"` part. Each answers 200 with
`{"type":"commandResult","requestId":null,"ok":true}`, or a refusal with the reason in pt-BR:
400 the command is malformed, 403 not allowed, 422 it names something that does not exist, 409
the state is in the way (nothing in Prévia, a macro already running). `POST /commands` also
answers 415 to a body not sent with `Content-Type: application/json` and 413 to a body over
256 KB.

```sh
# "Tomar": the item under the rundown's cursor.
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BAJA/take-next

# One item on air, wherever it lives (rundown or quick-fire).
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BAJA/take-item/<itemId>

# One item in Prévia.
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BAJA/preview-item/<itemId>

# "Tomar tudo": everything Prévia shows goes on air at once.
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BAJA/take-all-previews

# Clear one layer (here the clock), on air and in Prévia.
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BAJA/clear-layer/clock

# "Limpar tudo".
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BAJA/clear-all

# "Próximo" on a layer: the graphic on air there moves to its next step.
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BAJA/next-on-layer/fullscreen

# A quick-fire button by its place: button 1 of "Atalhos".
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BAJA/fire-shortcut/atalhos/1

# Start a macro.
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BAJA/run-macro/<macroId>

# "Parar": stop the macro that runs.
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BAJA/stop-macro

# What is on air and in preview, for button colours.
curl -s -H "Authorization: Bearer $TOKEN" $BAJA/layers/status

# One button's state, as a D200 polls it (section 3): a layer, a quick-fire button, a macro.
curl -s -H "Authorization: Bearer $TOKEN" $BAJA/state/layer/bug
curl -s -H "Authorization: Bearer $TOKEN" $BAJA/state/shortcut/atalhos/1
curl -s -H "Authorization: Bearer $TOKEN" $BAJA/state/macro/<the macro's id>
```

"Próximo" from a button reads the step on air when the press arrives, so two quick presses move
two steps. The control page refuses the second press instead, because it knows which step the
operator saw.

## 9. Any other command

Anything the control page can do is open to a device through `POST /commands`, with the same
envelope the page sends over the WebSocket. For example, "Prévia automática" off is not a
command, but moving the cursor is:

```sh
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"command","requestId":"pad-1","command":{"type":"moveCursor","rundownId":"sessao-principal","itemId":"<itemId>"}}' \
  $BAJA/commands
```

The answer echoes `requestId`. Every command's shape is in the generated document,
`$BAJA/openapi.json`, under `components.schemas.Command`. Commands only the server sends (a
renderer's report, a data source's poll results, a macro run's bookkeeping) are refused with 403.
