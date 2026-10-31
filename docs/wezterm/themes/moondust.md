# WezTerm: Moondust

WezTerm defines the terminal-level Moondust light scheme.

## File

`executable_dot_wezterm.lua` → `~/.wezterm.lua`

## Scheme

| Role | Value |
| --- | --- |
| Background | `#FFFFFF` |
| Foreground | `#434A51` |
| Cursor block | `#434A51` |
| Cursor text | `#FFFFFF` |
| Selection | `#BBD7EC` |
| Selection text | `#24292D` |
| Scrollbar thumb | `#B6BEC3` |
| Split border | `#D7DCDF` |

The 16-color ANSI mapping is listed in the
[shared palette](../../themes/moondust.md#terminal-ansi-mapping). tmux and
Zsh inherit those ANSI colors.

## Apply

```sh
chezmoi apply ~/.wezterm.lua
```

Reload WezTerm with `Ctrl+Shift+R` or restart it.

## Verify

If the `wezterm` CLI is available:

```sh
wezterm --config-file ~/.wezterm.lua show-keys >/dev/null
```

In WSL the CLI is often absent even when WezTerm runs on Windows; the Lua config
can also be checked with Neovim's Lua interpreter using a package stub. The
important values are `color_scheme = "moondust"` and the cursor colors above.
