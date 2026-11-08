# BajaOvrLay on the stream PC

At the event the server runs on the stream PC (Windows, Docker Desktop). BajaOvrLay runs
entirely there: the control page, the renderer OBS loads and the graphics are served by
that one server. The PC has internet, since it streams, but only BajaOvrLay's external
data sources use that uplink (the Baja app's API, a scoring poll). When the uplink drops,
those sources go stale and the last good data stays on air; nothing on screen is drawn
from elsewhere. The image is carried there on a USB stick. Steps 1–5 are the install; step
6 is the check before every broadcast; step 7 is an update at the track; step 8 puts a
backup of the database back; step 9 restores a whole copy saved from the control page.

## 1. Install Docker Desktop (once, with internet)

Download Docker Desktop for Windows from docker.com, install it with the **WSL 2** option
(the default), and restart when it asks. Open it once, accept the terms, then in
**Settings → General** turn on **Start Docker Desktop when you sign in**. In PowerShell,
`docker version` must print a Server section.

## 2. Save the image to the USB stick (on a machine with internet)

On João's WSL (any machine with Docker and internet). The repository is private, so its
image on GHCR is too: the first line, once per machine, asks for a token. Make it on
GitHub: **Settings → Developer settings → Personal access tokens → Tokens (classic) →
Generate new token (classic)**, note `Pull BajaOvrLay`, scope **read:packages** only →
copy the token, and paste it as the password.

```sh
docker login ghcr.io -u jbresolin
docker pull ghcr.io/jbresolin/bajaovrlay:latest
docker save ghcr.io/jbresolin/bajaovrlay:latest | gzip > bajaovrlay-image.tar.gz
```

The file is about 90 MB. Copy it, and `deploy/stream-pc/compose.yaml`, to the stick.

## 3. Load the image on the stream PC

Plug the stick in (here `E:`). In PowerShell:

```powershell
docker load -i E:\bajaovrlay-image.tar.gz
```

It ends with `Loaded image: ghcr.io/jbresolin/bajaovrlay:latest`.

## 4. Start it

```powershell
New-Item -ItemType Directory -Force C:\BajaOvrLay
Copy-Item E:\compose.yaml C:\BajaOvrLay\compose.yaml
docker compose -f C:\BajaOvrLay\compose.yaml up -d
```

The data lives in the Docker volume `bajaovrlay-data`, on the PC's own disk, and survives
restarts and updates. It is a volume rather than a Windows folder because SQLite's file
locking is not reliable through Docker Desktop's Windows file sharing.

At every session break, save a copy onto the USB stick from the control page: **Cópia de
segurança** in the header → **Baixar**, and pick the stick in the browser's save dialog. It
is one zip (`bajaovrlay-AAAA-MM-DD-HHMM.zip`) of the database, the images and, unless
"Incluir gravações" is unticked, the recordings, taken with the server running. It is a
download because a stick plugged into Windows is not visible inside the container. Step 9
puts one back.

To copy the whole data folder out from the PC itself (before an update), stop the
server first: a copy taken while it writes can catch the database half-written. Each copy
goes into a new folder named by the moment, so a second copy never lands inside the first.
Between sessions only: the server is down for those seconds.

```powershell
docker stop bajaovrlay
docker cp bajaovrlay:/data "C:\BajaOvrLay\copia-dados-$(Get-Date -Format yyyy-MM-dd_HHmm)"
docker start bajaovrlay
```

With the server running, copy the database alone, through the backup command, which takes
a consistent copy while it writes (the newest 14 are kept in `/data/backups`):

```powershell
docker exec bajaovrlay node apps/server/dist/backupDatabase.js /data/backups
docker cp bajaovrlay:/data/backups "C:\BajaOvrLay\copias-banco-$(Get-Date -Format yyyy-MM-dd_HHmm)"
```

The first time an operator laptop opens the control page, Windows may ask whether Docker
Desktop may use the network: allow **private** networks.

## 5. Point OBS at it

- Program: a **Browser** source, URL `http://localhost:8080/render/`, width 1920, height
  1080, in every scene that carries the graphics.
- PiP: in the PiP scene only, a second Browser source at the address "Saídas e camadas"
  shows beside "Endereço para o OBS", here `http://localhost:8080/render/?output=pip`
  (README.md at the repository root, "a PiP output and its OBS browser source").
- The control page: `http://localhost:8080/` on the stream PC, or
  `http://<stream PC address>:8080/` from another machine on the event LAN.

## 6. Before going on air

1. `docker ps` lists `bajaovrlay` as `Up … (healthy)`.
2. `http://localhost:8080/health` shows `{"ok":true,…}`.
3. The control page shows "Conectado".
4. A test take: an item on the program output shows in OBS, then "Limpar" clears it.
5. "Fontes de dados": each source the session needs is on and "Ok".
6. With the uplink cable out, steps 3 and 4 still work and nothing on air changes. The
   external sources turn "Atrasada", then "Erro", and are "Ok" again once it is back in.

## 7. Update at the track

Bring a new `bajaovrlay-image.tar.gz` (step 2), copy the data out (step 4), then:

```powershell
docker load -i E:\bajaovrlay-image.tar.gz
docker compose -f C:\BajaOvrLay\compose.yaml up -d
```

Compose sees the new image and replaces the container; the volume and its data stay. Open
pages and OBS reload themselves once the new server is up.

## 8. Restore a backup of the database

Stop the server first, and remove the journal SQLite may have left beside the database:
otherwise SQLite plays that leftover journal into the restored file. The volume is reached
through a short-lived container of the same image. List the backups, then put one in place
of the database (here the one of 14 November):

```powershell
docker stop bajaovrlay
docker run --rm --user root -v bajaovrlay-data:/data --entrypoint ls ghcr.io/jbresolin/bajaovrlay:latest /data/backups
docker run --rm --user root -v bajaovrlay-data:/data --entrypoint sh ghcr.io/jbresolin/bajaovrlay:latest -c "rm -f /data/bajaovrlay.sqlite-journal && cp /data/backups/bajaovrlay-2026-11-14T030000Z.sqlite /data/bajaovrlay.sqlite && chown node:node /data/bajaovrlay.sqlite"
docker start bajaovrlay
```

For a backup copied out to the PC (step 4), add `-v C:\BajaOvrLay\copias-banco-<moment>:/copia`
to the second `docker run` and copy from `/copia/<file>` instead of `/data/backups/<file>`.

## 9. Restaurar uma cópia

A zip saved with **Cópia de segurança** (step 4) holds `bajaovrlay.sqlite`, `media/`,
`recordings/` when the recordings were included, and `leia-me.txt`, which says when it was
made and with which version. Restoring puts those in place of the data folder's own, with
the server stopped:

1. Stop the server.
2. Unzip the copy into the data folder, replacing `bajaovrlay.sqlite`, `media/` and, if the
   copy has it, `recordings/`. A copy without recordings leaves the folder's own in place.
3. Delete any leftover `bajaovrlay.sqlite-journal`: SQLite would otherwise play it into the
   restored database.
4. Start the server.

There is no "Restaurar" button on purpose: an in-app restore would replace the database
under the running server, which has it open and may be writing to it. Doing it by hand
with the server stopped is a minute's work and cannot catch the database half-written.

**On the stream PC (the Docker volume).** Unzip the copy into a new folder, then copy it
into the volume through a short-lived container of the same image (here the copy of 14:32
on 14 November, from the stick at `E:`):

```powershell
docker stop bajaovrlay
Expand-Archive E:\bajaovrlay-2026-11-14-1432.zip C:\BajaOvrLay\restaurar-2026-11-14-1432
docker run --rm --user root -v bajaovrlay-data:/data -v C:\BajaOvrLay\restaurar-2026-11-14-1432:/copia --entrypoint sh ghcr.io/jbresolin/bajaovrlay:latest -c "trap 'chown -R node:node /data' EXIT; set -e; rm -f /data/bajaovrlay.sqlite-journal; cp /copia/bajaovrlay.sqlite /data/bajaovrlay.sqlite; mkdir -p /copia/media; rm -rf /data/media; cp -r /copia/media /data/media; if [ -d /copia/recordings ]; then rm -rf /data/recordings; cp -r /copia/recordings /data/recordings; fi"
docker start bajaovrlay
```

A copy made with no images has no `media/` folder at all (the zip holds files, not empty
folders), so the line makes an empty one first. It stops at the first step that fails,
says which, and exits non-zero, and either way the `trap` hands `/data` back to the
server's user, so the server can still write there after a restore cut short.

**In a plain folder** (`pnpm start`, or a bind mount instead of the volume), with the
server stopped, from the data folder (`DATA_DIR`; `apps/server/data` in `.env.example`):

```sh
cd apps/server/data
rm -f bajaovrlay.sqlite-journal
rm -rf media
unzip -l ~/bajaovrlay-2026-11-14-1432.zip | grep -q ' recordings/' && rm -rf recordings
unzip -o ~/bajaovrlay-2026-11-14-1432.zip -x leia-me.txt
mkdir -p media
```

The zip names the database `bajaovrlay.sqlite`, as the volume does. If `DATABASE_PATH`
names another file, rename it to that. Then start the server: the control page shows the
copy's items, rundown and library, and "Fontes de dados" lists its recordings.
