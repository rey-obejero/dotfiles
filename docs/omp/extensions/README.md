# OMP extensions

Chezmoi-managed extensions that live under `dot_omp/private_agent/private_extensions/`
and render to `~/.omp/agent/extensions/`. Loaded once per process at startup; each
file's default export is a factory that receives the extension API.

## Commands

| Extension | Command | What it does |
| --- | --- | --- |
| `commandcode.ts` | `/cmdc` | Per-session zero-data-retention headers; billing-period account usage |
| `yolo.ts` | `/yolo` | Runtime-only approval mode override |

The remaining extensions (`dsh-statusline.ts`, `notifications.ts`,
`rewrite.ts`, `startup-tip.ts`) are not documented here.

## Keybindings

None. No extension in this directory registers a shortcut; all interaction is
through slash commands.

## Persistence

| State | Where | Lifetime |
| --- | --- | --- |
| ZDR on/off per session | process memory, seeded from `CMD_ZDR=1` | one session |
| Approval mode override | process memory, on the `Settings` singleton | one process |

Neither writes to disk. `CMD_ZDR` is read from the environment but is not
currently set by any file this repo manages. A process restart drops both
overrides.
