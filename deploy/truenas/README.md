# BajaOvrLay on TrueNAS

Between events the server runs on TrueNAS (192.168.2.5) as a Portainer stack, behind
Nginx Proxy Manager (NPM). Steps 1–7 are the first install; step 8 is every update after.
`<domain>` stands for the name NPM serves it under (for example `bajaovrlay.casa.lan`);
`/mnt/Local/SSD/bajaovrlay` is the example dataset: use yours wherever it appears.

## 1. Create the dataset

In the TrueNAS web UI: **Datasets** → select `Local/SSD` → **Add Dataset** → Name
`bajaovrlay`, Dataset Preset **Generic** → **Save**. Then, in **System → Shell**:

```sh
sudo mkdir -p /mnt/Local/SSD/bajaovrlay/data
sudo chown -R 1000:1000 /mnt/Local/SSD/bajaovrlay/data
```

The server runs as uid 1000 (the image's `node` user), never root, so the folder must be
its. Everything the server keeps goes in it: the database, recordings, images, backups.

## 2. Let TrueNAS pull the image (once)

The repository is private, so its image on GHCR is too. On GitHub: **Settings → Developer
settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**,
note `TrueNAS pull BajaOvrLay`, scope **read:packages** only, no expiry or a long one →
copy the token. In Portainer: **Registries → Add registry → Custom registry** → Name
`GHCR`, Registry URL `ghcr.io`, **Authentication** on, Username `jbresolin`, Password the
token → **Add registry**.

## 3. Find the network NPM is on

In **System → Shell** (the first line lists the containers; use NPM's name in the second):

```sh
sudo docker ps --format '{{.Names}}' | grep -i proxy
sudo docker inspect --format '{{range $name, $net := .NetworkSettings.Networks}}{{$name}} {{end}}' <NPM container name>
```

Write down the network name it prints (not `bridge` or `host`, if it lists one of those
too).

## 4. Create the stack in Portainer

**Stacks → Add stack** → Name `bajaovrlay` → **Web editor** → paste
`deploy/truenas/compose.yaml` → change the two lines marked FILL IN (the dataset path from
step 1, the network name from step 3). Under **Environment variables** → **Add an
environment variable** (at least this one: Portainer only writes `stack.env` when there is
one):

```
BAJAOVRLAY_PUBLIC_ORIGINS=https://<domain>
```

Add `BAJAOVRLAY_SOURCE_ALLOWED_HOSTS` and any `BAJAOVRLAY_SOURCE_…` secret the same way
(`.env.example` says what each is). → **Deploy the stack**.

## 5. Add the NPM proxy host

In NPM: **Hosts → Proxy Hosts → Add Proxy Host**:

- Domain Names: `<domain>`
- Scheme `http`, Forward Hostname / IP `bajaovrlay`, Forward Port `8080`
- **Websockets Support: on.** The pages talk to the server over `/ws`; without it the
  control page never shows "Conectado" and the renderer draws nothing.
- Block Common Exploits: on. SSL tab: as your other hosts (your certificate, Force SSL).

**Save**. If the address in `BAJAOVRLAY_PUBLIC_ORIGINS` differs from the one you open
(`http` against `https`, another name), image uploads in Cadastros answer "Imagens só podem
ser enviadas pela página Cadastros deste servidor": fix the variable (step 4) and update
the stack.

## 6. Check it

```sh
curl -s https://<domain>/health
sudo docker inspect --format '{{.State.Health.Status}}' bajaovrlay
```

The first prints `{"ok":true,"version":"0.0.0"}`, the second `healthy` (it says
`starting` for up to 30 seconds after a start). Then open `https://<domain>/`: the control
page shows "Conectado". `https://<domain>/render/` is the program output, empty until
something is taken.

## 7. Back up the database every night

Add this line to `/mnt/Local/scripts/db-dumps/dump-databases.sh`, with the other dumps:

```sh
docker exec bajaovrlay node apps/server/dist/backupDatabase.js /data/backups
```

It writes a consistent copy with SQLite's online backup while the server runs, named
`bajaovrlay-<date>T<time>Z.sqlite` (UTC), into `/mnt/Local/SSD/bajaovrlay/data/backups`,
and keeps the newest 14 (files of other names there are never touched). It exits non-zero,
logging why, if it fails. To restore one: stop the stack, copy the backup over
`data/bajaovrlay.sqlite`, start the stack.

## 8. Update to a new image

Every merge to main publishes `:latest` and `:<short sha>` (the Actions tab, workflow
"Publish image", shows it green). In Portainer: **Stacks → bajaovrlay → Editor** →
**Update the stack** with **Re-pull image and redeploy** on. Open pages reload themselves
once the new server is up. To go back to an earlier build, change the image line to
`ghcr.io/jbresolin/bajaovrlay:<short sha>` of that commit and update the stack the same way.
