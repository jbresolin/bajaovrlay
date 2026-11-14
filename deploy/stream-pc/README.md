# BajaOvrLay on the stream PC

At the event the server runs on the stream PC (Windows, Docker Desktop). BajaOvrLay runs
entirely there: the control page, the renderer OBS loads and the graphics are served by
that one server. The PC has internet, since it streams, but only BajaOvrLay's external
data sources (the Baja app's API, a scoring poll) and its clock (NTP, step 5) use that
uplink. When the uplink drops, those sources go stale and the last good data stays on air;
nothing on screen is drawn from elsewhere. The image is carried there on a USB stick.
Steps 1–6 are the install; step 7 is the check before every broadcast; step 8 is an update
at the track; step 9 puts a backup of the database back; step 10 restores a whole copy
saved from the control page.

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
download because a stick plugged into Windows is not visible inside the container. Step 10
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

## 5. Relógio

Every clock on air (the race clock, the countdowns) counts on the server clock, and every
page lines up with the server. The server keeps that clock on real time by asking NTP
itself, about once a minute, from inside the container (`BAJAOVRLAY_NTP_SERVERS`, by default
`a.st1.ntp.br`, `b.st1.ntp.br`, `pool.ntp.org`). Windows is set to NTP.br too, so the
machine's own clock, which the server starts from and falls back to, is right as well, and
OBS's and the PC's clock read the same time. Once per PC, in **PowerShell as
administrator**.

**a. The router lets NTP out.** NTP is UDP port 123, **outbound** only: the PC asks, the
answer comes back on the same conversation. No inbound rule and no port forward are
needed; do not add one. Check from the PC (this asks NTP.br without changing anything):

```powershell
w32tm /stripchart /computer:a.st1.ntp.br /samples:3 /dataonly
```

Three lines with a time and an offset such as `+00.0031250s` mean NTP gets through. Lines
ending in `error: 0x800705B4` (a timeout) mean UDP 123 is blocked on the way out: the
router, or the venue's network above it. In the router's firewall, allow outbound UDP to
port 123 (on most home routers outbound traffic is already allowed, and the block is the
venue's).

**b. Windows time service on NTP.br.** Turn the service on, point it at NTP.br, and make it
ask now:

```powershell
Set-Service w32time -StartupType Automatic
Start-Service w32time
w32tm /config /manualpeerlist:"a.st1.ntp.br,0x8 b.st1.ntp.br,0x8" /syncfromflags:manual /update
Restart-Service w32time
w32tm /resync /force
w32tm /query /status
```

`/query /status` must show `Leap Indicator: 0(no warning)` and `Source: a.st1.ntp.br,0x8`
(or `b.st1.ntp.br,0x8`). A `Source: Local CMOS Clock` or `Free-running System Clock` means
Windows has not reached NTP.br yet: run `w32tm /resync /force` again after a minute, and if
it stays, go back to step a. Then:

```powershell
w32tm /stripchart /computer:a.st1.ntp.br /samples:3 /dataonly
```

The offsets are now a few milliseconds (`+00.0012345s`, `-00.0045678s`), not seconds.

**c. Where NTP stays blocked.** If the router cannot be changed and the venue blocks UDP 123,
BajaOvrLay still runs: the server starts on the computer's own clock (it waits up to 3 s for
NTP at boot) and keeps asking, so it takes real time as soon as NTP answers. The race
clocks on every page and in OBS still agree with each other, since they all count on the
server clock. After two NTP polls without an answer (about a minute) the server takes its
time from the Date headers of HTTPS servers instead (`BAJAOVRLAY_HTTP_TIME_SERVERS`), good to
tens of ms, and the top of the header's menu says "Relógio: HTTPS (…)"; NTP takes over again
as soon as it answers. "Verificar servidor" in the header's menu still says
`O NTP ainda não respondeu.` Only when HTTPS is blocked too does the header show "Relógio
sem sincronização": then that clock may be some seconds off the official time of the timing
tent. What to do, in order:

1. Fix the router (step a), or ask the venue to let outbound UDP 123 through.
2. Or use a time source on the event LAN, such as the timing tent's NTP server: put it first
   in `BAJAOVRLAY_NTP_SERVERS`, before the default list. In `C:\BajaOvrLay\compose.yaml`,
   add these two lines under `bajaovrlay:`, with `environment:` indented as `ports:` is
   (here the tent's server at `192.168.10.5`):

   ```yaml
   environment:
     BAJAOVRLAY_NTP_SERVERS: 192.168.10.5,a.st1.ntp.br,b.st1.ntp.br,pool.ntp.org
   ```

   then `docker compose -f C:\BajaOvrLay\compose.yaml up -d`, and point Windows at it too
   (step b, with `/manualpeerlist:"192.168.10.5,0x8"`).

## 6. Point OBS at it

- Program: a **Browser** source, URL `http://localhost:8080/render/`, width 1920, height
  1080, in every scene that carries the graphics.
- PiP: in the PiP scene only, a second Browser source at the address "Saídas e camadas"
  shows beside "Endereço para o OBS", here `http://localhost:8080/render/?output=pip`
  (README.md at the repository root, "a PiP output and its OBS browser source").
- The control page: `http://localhost:8080/` on the stream PC, or
  `http://<stream PC address>:8080/` from another machine on the event LAN.

## 7. Before going on air

1. `docker ps` lists `bajaovrlay` as `Up … (healthy)`.
2. `http://localhost:8080/health` shows `{"ok":true,…}`.
3. The control page shows "Conectado".
4. A test take: an item on the program output shows in OBS, then "Limpar" clears it.
5. "Fontes de dados": each source the session needs is on and "Ok".
6. The clock (step 5): the header shows no "Relógio sem sincronização" and no "Relógio do
   servidor … fora da hora certa", and the top of the header's **Menu** says what the server
   clock follows, such as "Relógio: NTP (a.st1.ntp.br), última resposta às 09:58:12,
   diferença de +3 ms." "HTTPS (www.cloudflare.com)" there means the venue blocks NTP (UDP
   123 out, step 5c) and the clock follows web servers' time instead, good to tens of ms:
   fine for the show, but ask the venue to let UDP 123 out. "Verificar servidor", in the
   same menu, shows the last NTP answer, such as "Última resposta do NTP às 14:32:05
   (a.st1.ntp.br:123), diferença de +3 ms.", or "O NTP ainda não respondeu." while NTP is
   blocked. "Relógio sem sincronização" in the header means neither NTP nor HTTPS answered
   for a minute: every clock on air counts on the PC's own time; check the uplink.
7. With the uplink cable out, steps 3 and 4 still work and nothing on air changes. The
   external sources turn "Atrasada", then "Erro", and are "Ok" again once it is back in.
   The clocks keep running on the server clock meanwhile. After a minute the header shows
   "Relógio sem sincronização", and it goes once the cable is back in.

## 8. Update at the track

Bring a new `bajaovrlay-image.tar.gz` (step 2), copy the data out (step 4), then:

```powershell
docker load -i E:\bajaovrlay-image.tar.gz
docker compose -f C:\BajaOvrLay\compose.yaml up -d
```

Compose sees the new image and replaces the container; the volume and its data stay. Open
pages and OBS reload themselves once the new server is up.

## 9. Restore a backup of the database

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

## 10. Restaurar uma cópia

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
