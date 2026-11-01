# OMP: Moondust

OMP uses the Moondust light palette in the `light` theme slot.

## Files

| Target | Source |
| --- | --- |
| `~/.omp/agent/themes/moondust.json` | `dot_omp/private_agent/private_themes/moondust.json` |
| `~/.omp/agent/config.yml` | `dot_omp/private_agent/private_config.yml.tmpl` |

## Configuration

```yaml
theme:
  light: moondust
  dark: github-base16
```

Only the light slot is Moondust. The dark slot intentionally remains the prior
GitHub theme; set both slots to `moondust` if you want it regardless of terminal
appearance.

## Role map

| Role | Palette shade |
| --- | --- |
| Text / assistant prose | `#434A51` |
| Muted / thinking | `#71787F` |
| Dim / comments | `#8E979F` |
| Accent / links / strings | `#1F639E` |
| Border | `#D7DCDF` |
| Selection | `#E2EFF8` |
| Status line background | `#F6F7F8` |
| User/tool panel | `#F6F7F8` |
| Raised panel | `#E8EBED` |
| Tool pending panel | `#F6F7F8` |
| Tool success panel | `#F2F8FC` |
| Success indicator | `#33383D` |
| Error | `#B35900` |
| Warning | `#7D4E00` |

Reference note: the reference editor selection is `#BBD7EC` (blue 2); OMP's
`selectedBg` is `#E2EFF8` (blue 1), the lighter selection-highlight shade.

See the [shared palette](../../themes/moondust.md).

## Apply

```sh
chezmoi apply ~/.omp/agent/themes/moondust.json
omp config set theme.light moondust
```

Then restart OMP so the theme loader reads the setting.

## Verify

```sh
omp config get theme.light   # moondust
```

A live launch should show the Moondust light footer and editor chrome. OMP logs
theme load failures to `~/.omp/logs/`; a failed load falls back to the built-in
dark theme.

## Related startup extension

`startup-tip.ts` is separate from the theme. It hides the OMP logo on the start
screen while preserving the tip line, by filtering `WelcomeComponent.render`.
