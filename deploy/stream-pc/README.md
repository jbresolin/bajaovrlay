# BajaOvrLay on the stream PC

At the event the server runs on the stream PC (Windows, Docker Desktop) with no internet
at all. The image is carried there on a USB stick. Steps 1–5 are the install; step 6 is
the check before every broadcast; step 7 is an update at the track; step 8 puts a backup
of the database back.

## 1. Install Docker Desktop (once, with internet)

Download Docker Desktop for Windows from docker.com, install it with the **WSL 2** option
(the default), and restart when it asks. Open it once, accept the terms, then in
**Settings → General** turn on **Start Docker Desktop when you sign in**. In PowerShell,
`docker version` must print a Server section.

## 2. Save the image to the USB stick (on a machine with internet)

On João's WSL (any machine with Docker and internet). The first line only once per
machine: it asks for the `read:packages` token of deploy/truenas/README.md, step 2.

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

To copy the whole data folder out (before an update, or onto the USB stick), stop the
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
6. With the uplink cable out, steps 3 and 4 still work and nothing on air changes.

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
