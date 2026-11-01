#!/usr/bin/env bash
# The Docker image, end to end, on this machine (BAJAOVRLAY-34): builds it, runs it on a
# new volume, waits until Docker calls it healthy, loads the control page and /render/,
# takes a race clock over the WebSocket with the control page's browser-test helper,
# backs the database up inside the container, then stops and starts the container and
# checks the clock is still on air. Everything it made is removed at the end, pass or fail.
#
#   pnpm install && scripts/dockerSmoke.sh
#
# Needs Docker (Docker in WSL, or Docker Desktop) and the repository's node_modules (for
# tsx and the helper). It never pushes anything. Not run by CI: CI has no Docker step.
# BAJAOVRLAY_SMOKE_PORT moves the port it publishes on 127.0.0.1 (18080 when unset).
set -euo pipefail

repository_folder="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image_name="bajaovrlay:smoke"
container_name="bajaovrlay-smoke-$$"
volume_name="bajaovrlay-smoke-data-$$"
port="${BAJAOVRLAY_SMOKE_PORT:-18080}"
address="http://127.0.0.1:${port}"
# Long enough for a first boot on a slow disk; Docker checks every 2 s while it starts.
seconds_to_wait_for_healthy=60

say() {
  printf '[dockerSmoke] %s\n' "$*"
}

fail() {
  say "FAILED: $*"
  say "the container's last log lines:"
  docker logs --tail 30 "$container_name" 2>&1 || true
  exit 1
}

remove_what_the_smoke_made() {
  docker rm --force "$container_name" > /dev/null 2>&1 || true
  docker volume rm "$volume_name" > /dev/null 2>&1 || true
}
trap remove_what_the_smoke_made EXIT

wait_until_healthy() {
  local waited=0
  local health_status=""
  while [ "$waited" -lt "$seconds_to_wait_for_healthy" ]; do
    health_status="$(docker inspect --format '{{.State.Health.Status}}' "$container_name")"
    if [ "$health_status" = "healthy" ]; then
      say "ok: Docker calls the container healthy after about ${waited} s"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  fail "not healthy after ${seconds_to_wait_for_healthy} s (last status: ${health_status})"
}

# Fetches a page and fails unless it answers 200 and its text holds the expected words.
expect_page() {
  local path="$1"
  local expected_text="$2"
  local body
  body="$(curl --silent --show-error --fail "${address}${path}")" || fail "GET ${path} did not answer 200"
  if ! grep --quiet --fixed-strings "$expected_text" <<< "$body"; then
    fail "GET ${path} answered, but without \"${expected_text}\""
  fi
  say "ok: GET ${path} answers 200 with \"${expected_text}\""
}

run_websocket_step() {
  pnpm --dir "$repository_folder" --filter @bajaovrlay/server exec \
    tsx ../../scripts/dockerSmokeTakeAnItem.ts "$1" "$port"
}

say "building ${image_name} from ${repository_folder}"
docker build --tag "$image_name" "$repository_folder"
image_size_bytes="$(docker image inspect --format '{{.Size}}' "$image_name")"
say "ok: built, $((image_size_bytes / 1000000)) MB"

say "starting ${container_name} on ${address}, data on the new volume ${volume_name}"
docker volume create "$volume_name" > /dev/null
docker run --detach --name "$container_name" \
  --publish "127.0.0.1:${port}:8080" \
  --volume "${volume_name}:/data" \
  "$image_name" > /dev/null
wait_until_healthy

expect_page /health '"ok":true'
expect_page / '<div id="root">'
expect_page /render/ '<title>BajaOvrLay renderer</title>'

user_id="$(docker exec "$container_name" id -u)"
[ "$user_id" = "1000" ] || fail "the server runs as uid ${user_id}, not 1000 (node)"
say "ok: the server runs as uid 1000 (node), not root"

run_websocket_step take || fail "the race clock could not be taken over the WebSocket"
say "ok: a race clock item made and taken over the WebSocket, on air on the clock layer"

docker exec "$container_name" node apps/server/dist/backupDatabase.js /data/backups > /dev/null \
  || fail "the backup command failed inside the container"
backup_names="$(docker exec "$container_name" ls /data/backups)"
grep --quiet --extended-regexp '^bajaovrlay-[0-9-]+T[0-9]{6}Z\.sqlite$' <<< "$backup_names" \
  || fail "no dated backup in /data/backups (found: ${backup_names})"
say "ok: backupDatabase.js wrote ${backup_names} in /data/backups"

say "stopping and starting the container again"
docker stop "$container_name" > /dev/null
docker start "$container_name" > /dev/null
wait_until_healthy

run_websocket_step check || fail "after the restart the race clock is not on air any more"
say "ok: after the restart the item and the clock on air are still there"

say "PASSED"
