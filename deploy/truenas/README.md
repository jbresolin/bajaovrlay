# BajaOvrLay on TrueNAS

**Optional.** BajaOvrLay's home is the stream PC (`../stream-pc/README.md`); this stack is
for running it on TrueNAS if that is ever wanted.

Here the server runs on TrueNAS (192.168.2.5) as a Portainer stack, behind Nginx Proxy
Manager (NPM). Steps 1–7 are the first install; step 8 is every update after.
`<domain>` stands for the name NPM serves it under (for example `bajaovrlay.casa.lan`);
`/mnt/Local/SSD/bajaovrlay` is the example dataset: use yours wherever it appears.

## 1. Create the dataset

In the TrueNAS web UI: **Datasets** → select `Local/SSD` → **Add Dataset** → Name
`bajaovrlay`, Dataset Preset **Generic** → **Save**. Then, in **System → Shell**:

```sh
sudo mkdir -p /mnt/Local/SSD/bajaovrlay/data /mnt/Local/db-dumps/bajaovrlay
sudo chown -R 1000:1000 /mnt/Local/SSD/bajaovrlay/data /mnt/Local/db-dumps/bajaovrlay
```

The server runs as uid 1000 (the image's `node` user), never root, so both folders must be
its. Everything the server keeps goes in `data`: the database, recordings, images. The
nightly backups (step 7) go in `/mnt/Local/db-dumps/bajaovrlay`, beside the other dumps
and outside the live dataset, so a problem with that dataset cannot take them too.

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
environment variable** (behind NPM this one is needed; with none at all the stack still
deploys):

```
BAJAOVRLAY_PUBLIC_ORIGINS=https://<domain>
```

Add `BAJAOVRLAY_SOURCE_ALLOWED_HOSTS`, `BAJAOVRLAY_API_TOKENS` (buttons, see `docs/buttons.md`; TrueNAS is not the studio network, so not `BAJAOVRLAY_API_OPEN`) and any `BAJAOVRLAY_SOURCE_…` secret the same way
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
docker exec bajaovrlay node apps/server/dist/backupDatabase.js /backups || echo "bajaovrlay: backup falhou" >&2
```

It writes a consistent copy with SQLite's online backup while the server runs, named
`bajaovrlay-<date>T<time>Z.sqlite` (UTC), into `/mnt/Local/db-dumps/bajaovrlay` (the stack's
`/backups` mount), and keeps the newest 14 there; files of other names are never touched,
and the dump script's own retention can leave the folder alone. A write the server is
committing at that moment only delays it: it tries again for about 5 seconds. If it fails
(the container stopped, the folder not writable, the database locked longer than that) it
writes why to stderr, as well as in its JSON log, and exits non-zero; the `|| echo` then
writes one line to the script's errors instead of ending the script, so a script with
`set -e` still runs the dumps after it.

### Restore a backup

Stop the server first, and remove the journal SQLite may have left beside the database:
otherwise SQLite plays that leftover journal into the restored file. Pick the backup with
`ls`, then put it in place of the database (here the one of 14 November):

```sh
sudo docker stop bajaovrlay
ls /mnt/Local/db-dumps/bajaovrlay
sudo rm -f /mnt/Local/SSD/bajaovrlay/data/bajaovrlay.sqlite-journal
sudo cp /mnt/Local/db-dumps/bajaovrlay/bajaovrlay-2026-11-14T030000Z.sqlite /mnt/Local/SSD/bajaovrlay/data/bajaovrlay.sqlite
sudo chown 1000:1000 /mnt/Local/SSD/bajaovrlay/data/bajaovrlay.sqlite
sudo docker start bajaovrlay
```

## 8. Update to a new image

Every merge to main publishes `:latest` and `:<short sha>` (the Actions tab, workflow
"Publish image", shows it green). In Portainer: **Stacks → bajaovrlay → Editor** →
**Update the stack** with **Re-pull image and redeploy** on. Open pages reload themselves
once the new server is up. To go back to an earlier build, change the image line to
`ghcr.io/jbresolin/bajaovrlay:<short sha>` of that commit and update the stack the same way.
