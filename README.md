# Dotfiles

Machine-agnostic, transferrable dotfiles managed with [chezmoi](https://www.chezmoi.io/).

## Specifications

- **Terminal**: WezTerm
- **Operating System**: Fedora (via WSL) — **Linux only, no macOS support**
- **Shell**: ZSH with the Oh My Zsh framework and the Starship prompt
- **Multiplexer**: Tmux
- **Code Editor**: Neovim with the LazyVim distribution
- **AI Agent**: OpenCode CLI
- **Dotfiles Manager**: chezmoi

## Configurable values (machine-specific)

These are not hardcoded. They are prompted once on `chezmoi init` and stored in
`~/.config/chezmoi/chezmoi.toml` (`[data]` section). A documented example lives
in `.chezmoi.toml.example` in this repo (it is not read by chezmoi — it is a
`.env.example`-style reference).

| Key | Meaning | Default |
| --- | --- | --- |
| `opencode_model` | Default model for **all** OpenCode agents | `opencode/deepseek-v4-flash-free` |
| `opencode_model_plan` | Override for the `plan` agent only | inherits `opencode_model` |
| `opencode_model_build` | Override for the `build` agent only | inherits `opencode_model` |
| `opencode_model_general` | Override for the `general` agent only | inherits `opencode_model` |
| `opencode_model_explore` | Override for the `explore` agent only | inherits `opencode_model` |
| `opencode_model_scout` | Override for the `scout` agent only | inherits `opencode_model` |
| `jdtls_path` | Absolute path to your `eclipse.jdt.ls` clone | **required, no default** |

Setting only `opencode_model` makes every agent use that one model. To diverge a
single agent, add its key in `~/.config/chezmoi/chezmoi.toml` and re-run
`chezmoi apply`.

The Java LSP intentionally does **not** use Mason — the `eclipse.jdt.ls` host is
slow, so we rely on a local clone you point `jdtls_path` at.

## First-time setup on a new machine

```sh
chezmoi init --apply <your-repo-url>
```

This will:

1. Clone this repo to `~/.local/share/chezmoi`.
2. Render `.chezmoi.toml.tmpl` → `~/.config/chezmoi/chezmoi.toml`, prompting for
   `opencode_model` (with the free default offered) and `jdtls_path` (required).
3. Apply every dotfile, templating `opencode.jsonc` and `java.lua`.
4. Run `run_once_after_install-tpm.sh` once, which clones TPM and installs your
   tmux plugins automatically. You never need to press `prefix + I`.

To change your answers later:

```sh
chezmoi edit-config          # opens ~/.config/chezmoi/chezmoi.toml
chezmoi apply                # re-render everything
```

`chezmoi edit-config` opens the file in your editor (already auto-aplying on save
via the `[edit]` settings), so just change a line and `:w`.

### Resetting your configuration

Answers live in `~/.config/chezmoi/chezmoi.toml` (or
`$XDG_CONFIG_HOME/chezmoi/chezmoi.toml` if `XDG_CONFIG_HOME` is set). Because the
prompts use `promptStringOnce`, `chezmoi init` only re-asks a key that is **missing**
from that file — so to reset, you delete the value(s) first.

* **Re-prompt everything (full reset):**

  ```sh
  rm "${XDG_CONFIG_HOME:-$HOME/.config}/chezmoi/chezmoi.toml"
  chezmoi init
  ```

* **Re-prompt a single value:** open `chezmoi edit-config`, delete just that one
  line (e.g. `jdtls_path = "..."`), save, then run `chezmoi init` — only the
  missing key is asked again.

* **`jdtls_path` is now required.** Leaving it empty aborts `chezmoi init` with
  `jdtls_path cannot be empty`. Just run `chezmoi init` again and type the real
  path to your `eclipse.jdt.ls` clone.

## Daily editing

You have two auto-applying paths — both apply on save, no manual step needed:

- **`chezmoi edit <file>`** — opens the source file and auto-applies on every
  save (configured via `[edit] apply=true watch=true` in `.chezmoi.toml.tmpl`).
  This is the recommended daily command.
- **`nvim ~/.local/share/chezmoi/...`** — a Neovim `BufWritePost` autocmd (in
  `dot_config/nvim/lua/config/autocmds.lua`) runs `chezmoi apply` in the
  background whenever you save any file inside the chezmoi source dir.

Inspect what changed before/after with `chezmoi diff`.

## Gotcha: discarding a change you applied

Auto-apply means saving the source file immediately updates the real target
(e.g. `~/.zshrc`). If you then decide you don't want it and revert the source
with git (`git restore dot_zshrc` inside `~/.local/share/chezmoi`), the **real
target still holds the unwanted version** until you push the revert:

```sh
chezmoi diff     # shows target differs from the reverted blueprint
chezmoi apply    # overwrites the target with the reverted blueprint
```

`chezmoi apply` always makes the target match the blueprint — it is the fix.

## tmux plugins

The `dot_tmux/plugins/**` tree is listed in `.chezmoiignore` and is **not**
committed. Instead it is installed automatically by `run_once_after_install-tpm.sh`
on first `chezmoi apply`. If you later add a plugin to `dot_tmux.conf`, you can
still run `prefix + I` (or just `chezmoi apply` re-runs the script only if its
hash changed — for new plugins use `prefix + I`).

## Updating

```sh
chezmoi update --apply     # pull latest repo + apply
```

## TODO

- Add a minimal script to automate resetting the chezmoi configuration values
  (currently done manually via `rm` + `chezmoi init`, or by deleting a single
  key in `chezmoi edit-config`).

## Note

This configuration is Linux-only; `java.lua` hardcodes `config_linux` for
eclipse.jdt.ls and will not select a macOS config directory.
