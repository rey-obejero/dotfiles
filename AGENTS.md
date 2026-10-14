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
- Oh My Pi settings: `dot_omp/private_agent/private_config.yml`
- zsh: `dot_zshrc`
- tmux: `dot_tmux.conf`, `dot_tmux/`
- wezterm: `executable_dot_wezterm.lua`

## Oh My Pi (OMP)

`~/.omp/` holds configuration and runtime state in one tree. Only the
configuration subset lives in source state, and `.chezmoiignore` guards the rest.

Tracked:

| Target                    | Source                                     |
| ------------------------- | ------------------------------------------ |
| `~/.omp/agent/config.yml` | `dot_omp/private_agent/private_config.yml` |
| `~/.omp/agent/themes/`    | `dot_omp/private_agent/private_themes/`    |

Candidates to track once they exist, added the same way: `~/.omp/agent/AGENTS.md`,
`RULES.md`, `keybindings.yml`, `models.yml`, `commands/`, and `skills/`.

### config.yml is a live file

OMP rewrites `~/.omp/agent/config.yml` whenever a setting changes: from
`/settings`, from `omp config set`, or from a keybind toggle. The tracked copy is
a snapshot. After an in-app change, re-capture it and commit:

```sh
chezmoi add ~/.omp/agent/config.yml
git -C ~/.local/share/chezmoi commit -am "feat(omp): <what changed>"
```

Never `chezmoi add ~/.omp` recursively. Session transcripts, SQLite databases,
blobs, logs, and caches are runtime state, and `models.yml` and `secrets.yml` can
hold provider API keys and plaintext secrets in the clear.

Ignored by `.chezmoiignore`, by target path:

- `~/.omp/agent/sessions/`, `terminal-sessions/`, `cache/`, `predict/`, `logs/`,
  `managed-skills/`, and `*.db`, `*.db-wal`, `*.db-shm`
- `~/.omp/agent/secrets.yml`, `secret-placeholder.key`, `auth.json`,
  `credentials.json`
- `~/.omp/cache/`, `logs/`, `run/`, `blobs/`, and `stats.db*`

### omp on PATH

`dot_zshrc` puts `$HOME/.bun/bin` on `PATH` and exports `BUN_INSTALL`. This is
where `bun install -g` links `omp`. Without it, a fresh shell cannot find `omp`
even though `~/.bun/bin/omp` exists. A shell reads `PATH` once, so open a new
shell (or `exec zsh`) after applying.

## Workflow reminders

- Source dir: `/home/9x14to03/.local/share/chezmoi`
- Target dir: `/home/9x14to03`
- Inspect state with `chezmoi status` / `chezmoi diff`.
- When in doubt about which file to edit, find the `dot_`/`*.tmpl` source, not the file under `~`.
