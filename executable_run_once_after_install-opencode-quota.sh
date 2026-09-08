#!/bin/sh
# Clone + build the opencode-quota fork (with Command Code provider) into the
# OpenCode config dir on first `chezmoi apply` (run_once). The plugin is then
# referenced as a local path ("./opencode-quota") from opencode.jsonc/tui.jsonc.
#
# A bare clone has no dist/ (gitignored), so we build in place — OpenCode loads
# the ./server + ./tui entrypoints from the package.json exports map.
#
# To update later (script only runs once):
#   git -C ~/.config/opencode/opencode-quota pull
#   pnpm --dir ~/.config/opencode/opencode-quota install
#   pnpm --dir ~/.config/opencode/opencode-quota build
# Or re-run this script manually.
set -eu

QUOTA_DIR="$HOME/.config/opencode/opencode-quota"
REPO_URL="https://github.com/rey-obejero/opencode-quota.git"

if [ ! -d "$QUOTA_DIR/.git" ]; then
  CLONE_TMP="$QUOTA_DIR.clone-tmp"
  rm -rf "$CLONE_TMP"
  git clone "$REPO_URL" "$CLONE_TMP"
  if [ -d "$QUOTA_DIR" ]; then
    # Preserve pre-existing user files (e.g. quota-toast.jsonc) not owned by the repo.
    for entry in "$QUOTA_DIR"/*; do
      [ -e "$entry" ] || continue
      base="$(basename "$entry")"
      if [ ! -e "$CLONE_TMP/$base" ]; then
        mv "$entry" "$CLONE_TMP/$base"
      fi
    done
    rm -rf "$QUOTA_DIR"
  fi
  mv "$CLONE_TMP" "$QUOTA_DIR"
fi

command -v pnpm >/dev/null 2>&1 || {
  echo "opencode-quota deploy: pnpm not found on PATH; skipping build." >&2
  exit 1
}

cd "$QUOTA_DIR"
pnpm install
pnpm build
