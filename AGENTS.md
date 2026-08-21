# AGENTS.md

This repository is a [chezmoi](https://www.chezmoi.io/)-managed dotfiles repository. The files here are the **source of truth**; they are rendered and applied to the real home directory (`~`) by chezmoi.

## Critical rule for editing managed files

**Never edit the deployed/target files under `~` directly** (e.g. `~/.config/opencode/opencode.jsonc`, `~/.zshrc`, `~/.tmux.conf`). Those are generated outputs. Editing them directly gets overwritten on the next `chezmoi apply` and the change is lost from the source of truth.

Instead:

1. Edit the corresponding **source file in this repository**.
   - Plain files are prefixed `dot_` (e.g. `dot_zshrc` -> `~/.zshrc`).
   - chezmoi templates use the `.tmpl` suffix (e.g. `dot_config/opencode/opencode.jsonc.tmpl` -> `~/.config/opencode/opencode.jsonc`).
2. Apply the change with `chezmoi apply` (run from this repo or anywhere chezmoi can find its source).
3. Verify the rendered target, then commit the source change with git.

## Common source paths

- OpenCode config: `dot_config/opencode/opencode.jsonc.tmpl`
- zsh: `dot_zshrc`
- tmux: `dot_tmux.conf`, `dot_tmux/`
- wezterm: `executable_dot_wezterm.lua`

## Workflow reminders

- Source dir: `/home/9x14to03/.local/share/chezmoi`
- Target dir: `/home/9x14to03`
- Inspect state with `chezmoi status` / `chezmoi diff`.
- When in doubt about which file to edit, find the `dot_`/`*.tmpl` source, not the file under `~`.
