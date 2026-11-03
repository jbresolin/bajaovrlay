# deploy

How the one Docker image (`/Dockerfile`) runs: on the stream PC, and optionally on
TrueNAS. Every step is a copy-paste runbook; nothing here runs by itself.

- `stream-pc/` — BajaOvrLay's home: Docker Desktop on the Windows stream PC, where it runs
  entirely; only its external data sources use the PC's uplink. The image arrives on a USB
  stick. Start at its README.
- `truenas/` — optional, for running it elsewhere: a Portainer stack on TrueNAS
  (192.168.2.5), behind Nginx Proxy Manager, pulling `ghcr.io/jbresolin/bajaovrlay:latest`.

The image: port 8080, everything it keeps in one volume, `/data` (the database, the
recordings, the media), runs as uid 1000. Backups go where the backup command is told:
`/data/backups` on the stream PC, a mount of their own on TrueNAS. GitHub builds and
pushes it on every push to main (`.github/workflows/publish-image.yml`).
`scripts/dockerSmoke.sh` builds and checks it on a machine with Docker. Every variable is
in `/.env.example`.
