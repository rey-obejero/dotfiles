# OMP extension: yolo

`/yolo` — flips the tool approval mode to `yolo` for the running omp process
only, without touching the persisted config.

## Files

| Target | Source |
| --- | --- |
| `~/.omp/agent/extensions/yolo.ts` | `dot_omp/private_agent/private_extensions/yolo.ts` |

## Scope

A runtime setting override on the process-wide `Settings` singleton. It
outranks global and project config, is never saved to `config.yml`, and
disappears when the process exits — same lifetime as the `--yolo` command-line
flag. Tools re-read the approval mode per call, so a change takes effect on the
next tool call with no restart.

Yolo is not a security bypass. `tools.approval` policy rules and
`tools.restrictedFolders` still apply, so a configured deny or a restricted
folder still prompts or blocks.

## Commands

### `/yolo`

Toggles. Turns yolo on when it isn't on; clears the override when it is.

### `/yolo on`

Sets yolo for the rest of the process.

### `/yolo off`

Clears the override, restoring whatever the configured layers resolve to. When
the configured value is itself `yolo`, clearing would leave yolo in effect, so
the override is re-pinned to `write` instead — `off` always leaves yolo mode.

### `/yolo status`

Reports the current mode and where it came from, without changing anything:
`Approval mode: write (settings: global)` or
`Approval mode: yolo (runtime override)`.

Unrecognized arguments print `Usage: /yolo [on|off|status]`. If the
`tools.approvalMode` setting is not registered in the running omp build, the
command reports that rather than failing silently.

## Notification tones

| State change | Tone |
| --- | --- |
| yolo turned on | warning |
| yolo turned off | info |
| status report or usage line | info |

The `warning` tone for `on` mirrors omp's own treatment of dangerous settings.

## Persistence

Nothing on disk. The override lives in the process's `Settings` singleton; omp
writes `config.yml` only on changes routed through `/settings` or
`omp config set`, and this extension uses neither. A `chezmoi apply` will not
see it, a restart loses it, and `git status` in the source dir is unaffected.
