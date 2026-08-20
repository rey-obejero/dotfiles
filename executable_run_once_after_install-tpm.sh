#!/bin/sh
# Auto-install tmux plugins on first `chezmoi apply` (run_once).
# Plugins are ignored via .chezmoiignore, so this clones TPM and installs them.
set -eu

TPM_DIR="$HOME/.tmux/plugins/tpm"

if [ ! -d "$TPM_DIR" ]; then
  git clone https://github.com/tmux-plugins/tpm "$TPM_DIR"
fi

"$TPM_DIR/bin/install_plugins"
