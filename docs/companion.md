# Companion and Stream Deck: driving BajaOvrLay over HTTP

A step-by-step guide to running the show from Bitfocus Companion (and so from a Stream Deck or
any macro pad Companion drives), using the command API built in BAJAOVRLAY-28. Every button
press goes through the same single command path as a click on the control page: it is checked,
saved, written to the event log as `api:<device name>`, and broadcast to every open page.

The examples assume the server runs at `http://192.168.0.10:3000`. Use your server's address.
The server must listen on the LAN (`HOST=0.0.0.0` in `.env`) for Companion to reach it from
another machine.

## 1. Set the token

Each device gets its own token, so the event log can tell them apart and a lost device can be
cut off alone.

1. Make a token for each device, on any machine with OpenSSL:

   ```sh
   openssl rand -hex 16
   ```

2. Add them to `.env` at the repository root, as `name=token` pairs separated by commas. The
   name is 1 to 40 letters, digits, `-` or `_`; the token is at least 16 characters, no spaces.

   ```sh
   BAJAOVRLAY_API_TOKENS=companion=<the first token>,streamdeck=<the second token>
   ```

3. Restart the server. The "server listening" log line lists the device names
   (`api_token_names`), never the tokens. A token that cannot be used stops the boot with a
   message naming the device.

Without the variable, every command route answers 403 "API de comandos desligada: defina
BAJAOVRLAY_API_TOKENS." A wrong or missing token answers 401.

Check it from a terminal before opening Companion:

```sh
export BAJA=http://192.168.0.10:3000/api/v1
export TOKEN=<Companion's token>
curl -s -H "Authorization: Bearer $TOKEN" $BAJA/layers/status
```

The answer starts with `"tokenName":"companion"`.

## 2. Add Companion's "Generic HTTP" connection

1. In Companion's admin page, open **Connections**, search for **Generic HTTP**, and add it.
2. Name it `BajaOvrLay`.
3. In **Base URL**, type `http://192.168.0.10:3000/api/v1`. Every action below then names only
   the end of the address.
4. Save.

Every request needs the token. In each action below, put this in the **Header** field (it takes
JSON):

```json
{ "Authorization": "Bearer <Companion's token>" }
```

## 3. Find the ids a button needs

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

## 4. Make the buttons

For each button: add a button on a page, give it its text, and under **Press actions** add
**BajaOvrLay: POST**, with the URL below, the body left empty and the header from step 2.

### "Tomar"

Puts the item under the rundown's cursor on air and moves the cursor on, as the control page's
"Tomar" button does.

- Text: `TOMAR`
- URL: `take-next`

Unlike the page's Space key, it never sends what Prévia holds instead: a fixed button does one
thing. To air what Prévia shows, make a "Tomar tudo" button with `take-all-previews`.

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

## 5. Colour a button from `/layers/status`

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
`outputs.program.layers.clock.isOnAir`. `runningMacro` is `null` when no macro runs.

To turn the "Tomar" button of the clock red while the clock is on air:

1. Under **Variables → Custom variables**, add one named `baja_status`.
2. Under **Triggers**, add a trigger:
   - Event: **Time interval**, every 1 second.
   - Action: **BajaOvrLay: GET**, URL `layers/status`, the header from step 2, and **JSON
     Response Data Variable** set to `baja_status`.
3. On the button, under **Feedbacks**, add **Internal: Check expression** with the expression

   ```
   jsonpath($(custom:baja_status), '$.outputs.program.layers.clock.isOnAir') == true
   ```

   and set its style to a red background.

The same way, `isInPreview` can turn a button green while its item waits in Prévia, and
`$.runningMacro.macroId` can light the button of the macro that runs.

The names of Companion's fields above are those of Companion 3 with the Generic HTTP module 2;
another version may word them differently. If a feedback stays dark, check the custom variable
under **Variables** first: it shows the last answer, or the error.

## 6. Every shortcut from a terminal

With `BAJA` and `TOKEN` set as in step 1. Each answers 200 with
`{"type":"commandResult","requestId":null,"ok":true}`, or a refusal with the reason in pt-BR:
400 the command is malformed, 403 not allowed, 422 it names something that does not exist, 409
the state is in the way (nothing in Prévia, a macro already running).

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

# Start a macro.
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BAJA/run-macro/<macroId>

# "Parar": stop the macro that runs.
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BAJA/stop-macro

# What is on air and in preview, for button colours.
curl -s -H "Authorization: Bearer $TOKEN" $BAJA/layers/status
```

"Próximo" from a button reads the step on air when the press arrives, so two quick presses move
two steps. The control page refuses the second press instead, because it knows which step the
operator saw.

## 7. Any other command

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
