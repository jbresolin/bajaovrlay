# deploy

How the one Docker image (`/Dockerfile`) runs on João's two machines. Every step is a
copy-paste runbook; nothing here runs by itself.

- `truenas/` — between events: a Portainer stack on TrueNAS (192.168.2.5), behind Nginx
  Proxy Manager, pulling `ghcr.io/jbresolin/bajaovrlay:latest`. Start at its README.
- `stream-pc/` — at the event: Docker Desktop on the Windows stream PC, with no internet;
  the image arrives on a USB stick. Start at its README.

The image: port 8080, everything it keeps in one volume, `/data` (the database, the
recordings, the media), runs as uid 1000. Backups go where the backup command is told:
`/data/backups` on the stream PC, a mount of their own on TrueNAS. GitHub builds and
pushes it on every push to main (`.github/workflows/publish-image.yml`).
`scripts/dockerSmoke.sh` builds and checks it on a machine with Docker. Every variable is
in `/.env.example`.
