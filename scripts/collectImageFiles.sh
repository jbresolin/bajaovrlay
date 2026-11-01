#!/usr/bin/env bash
# Collects what the Docker image runs into one folder, laid out as the repository is, so
# main.ts finds every folder at the same relative place as in a checkout
# (../../../packages/graphics from apps/server/dist, and so on). Run by the Dockerfile's
# build stage after `pnpm build` and `pnpm deploy`; nothing else uses it.
#
#   scripts/collectImageFiles.sh <repository folder> <deployed server folder> <image folder>
#
# What could go wrong: a new folder the server reads at run time (a new theme folder, a
# new file next to build-id.json) is not copied, and the image boots without it. The
# offline browser test runs on a checkout, not on the image; scripts/dockerSmoke.sh is
# what catches it.
set -euo pipefail

repository_folder="$1"
deployed_server_folder="$2"
image_folder="$3"

# The server: its build, its migrations, its package.json (read for /health's version)
# and its production node_modules from `pnpm deploy --prod`. cp -a keeps pnpm's links.
mkdir -p "$image_folder/apps/server"
cp -a "$deployed_server_folder/dist" "$image_folder/apps/server/dist"
cp -a "$deployed_server_folder/drizzle" "$image_folder/apps/server/drizzle"
cp -a "$deployed_server_folder/package.json" "$image_folder/apps/server/package.json"
cp -a "$deployed_server_folder/node_modules" "$image_folder/apps/server/node_modules"

# better-sqlite3 ships its C sources and a binary for every platform. The image needs only
# the Linux binaries: x64 for both of João's machines, arm64 so an arm64 build still works.
better_sqlite3_folder="$(find "$image_folder/apps/server/node_modules/.pnpm" -maxdepth 3 -type d -path '*/better-sqlite3@*/node_modules/better-sqlite3')"
rm -rf "$better_sqlite3_folder/deps" "$better_sqlite3_folder/src"
rm -f "$better_sqlite3_folder"/prebuilds/darwin-* "$better_sqlite3_folder"/prebuilds/win32-*

# The two built pages.
mkdir -p "$image_folder/apps/control" "$image_folder/apps/renderer"
cp -a "$repository_folder/apps/control/dist" "$image_folder/apps/control/dist"
cp -a "$repository_folder/apps/renderer/dist" "$image_folder/apps/renderer/dist"

# Every built graphic: the server registers a package only from a dist holding its
# *.ograf.json, and serves nothing else of it. The kit is a library, not a graphic.
for package_folder in "$repository_folder"/packages/graphics/*/; do
  package_name="$(basename "$package_folder")"
  if compgen -G "$package_folder/dist/*.ograf.json" > /dev/null; then
    mkdir -p "$image_folder/packages/graphics/$package_name"
    cp -a "$package_folder/dist" "$image_folder/packages/graphics/$package_name/dist"
  fi
done

# The theme's three served folders (core/http/themeFiles.ts): tokens, font, logo.
mkdir -p "$image_folder/packages/theme"
for theme_folder_name in ardosia fonts brand; do
  cp -a "$repository_folder/packages/theme/$theme_folder_name" "$image_folder/packages/theme/$theme_folder_name"
done

# The id of this build, sent in every hello so open pages reload after an upgrade.
cp -a "$repository_folder/build-id.json" "$image_folder/build-id.json"
