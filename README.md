# BajaOvrLay

Stream graphics for Baja SAE Brasil live streams. Read `CLAUDE.md` first: it is the
contract for how this repository is built, and it summarises the design authority.

- `apps/server` — Node server that owns all state (start here).
- `apps/control` — the operator's control page.
- `apps/renderer` — the page OBS loads as a browser source.
- `packages/shared` — Zod schemas shared by all of the above.
- `packages/graphics` — OGraf graphics, one package each.
- `docs/` — design docs, decisions and `testing-style.md` (how every test is written).
  Task briefs live only in their Plane work items (project BAJAOVRLAY).
- `Dockerfile` and `deploy/` — the one image of the whole system and its runbooks (see
  "Deployment" below).

Needs Node 22 (`.nvmrc`) and pnpm (`corepack enable` once), then `pnpm install` and
`pnpm dev`. CI runs `pnpm lint`, `typecheck`, `test`, `build` and the browser tests in
four parallel jobs, on a PR once it is marked ready for review (`docs/ci.md`).

`pnpm verify` runs the same checks on your machine, in order, and stops at the first one
that fails, naming it; `pnpm verify --quick` leaves out the browser tests. Run it before
every push (`docs/testing-style.md`, "Before you push").

## Deployment

BajaOvrLay runs on the **stream PC**: one Docker image under Docker Desktop, with no
internet at the track. `deploy/stream-pc/README.md` is the runbook: the image carried on a
USB stick, the OBS addresses, the checks before going on air, backups and restore.
Running it on **TrueNAS** instead is optional (`deploy/truenas/README.md`, a Portainer
stack behind Nginx Proxy Manager). `scripts/dockerSmoke.sh` checks the image end to end on
a machine with Docker; every variable is in `.env.example`.

**Runbook: a PiP output and its OBS browser source.** An OBS scene with a
picture-in-picture box can carry an overlay of its own. On the control page open
"Saídas" (it opens "Saídas e camadas" in a new tab), type a name ("PiP") under "Nova
saída" (the address `pip` follows it) and press "Adicionar saída"; add its layers
("Moldura", "Legenda") with "Adicionar camada", and drag them into order. Press "Copiar"
beside "Endereço para o OBS" (`http://<server>:<PORT>/render/?output=pip`). In OBS, in the
PiP scene only, add a Browser source with that URL at 1920x1080, as the main source is set
up; the main source stays `http://<server>:<PORT>/render/` (program) and is unchanged.
Items prepared on a PiP layer ("Camada" lists it under "Saída PiP") are drawn by the PiP
source alone, so switching to the PiP scene brings its overlay along. Camadas groups the
layers by output, and the "Prévia"/"Programa" monitors can be switched to the PiP.
