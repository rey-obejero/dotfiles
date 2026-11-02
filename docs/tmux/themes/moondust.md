# tmux: Moondust

tmux uses the Moondust terminal palette without painting a separate status-bar
surface.

## File

`dot_tmux.conf` → `~/.tmux.conf`

## Settings

| Option | Value |
| --- | --- |
| `status-style` | `bg=default,fg=#575E66` |
| `status-right-style` | `bg=default,fg=#575E66` |
| `status-right` | `#{server_sessions}` |
| `status-right-length` | `4` |
| `window-status-current-style` | `bg=default,fg=#24292D,bold` |
| `window-status-style` | `bg=default,fg=#71787F` |
| `pane-border-style` | `fg=#D7DCDF` |
| `pane-active-border-style` | `fg=#1F639E` |
| `message-style` | `bg=#E8EBED,fg=#33383D` |
| `mode-style` | `bg=#BBD7EC,fg=#24292D` |
| `copy-mode-position-style` | `bg=#D7DCDF,fg=#24292D` |
| `clock-mode-colour` | `#1F639E` |
| `display-panes-active-colour` | `#1F639E` |

The status bar inherits the terminal background, the active window has no fill,
and the session count is right-aligned at the edge.

The copy-mode position indicator is styled explicitly with the reference
widget-border gray, because tmux otherwise inherits `mode-style` and paints the
scroll readout with the selection blue.

## Apply

```sh
chezmoi apply ~/.tmux.conf
tmux source-file ~/.tmux.conf
```

## Verify

```sh
for o in status-style status-right status-right-length \
  window-status-current-style pane-active-border-style mode-style copy-mode-position-style; do
  printf '%s = ' "$o"
  tmux show-options -gv "$o"
done
```

Expected:

```text
status-style = bg=default,fg=#575E66
status-right = #{server_sessions}
status-right-length = 4
window-status-current-style = bg=default,fg=#24292D,bold
pane-active-border-style = fg=#1F639E
mode-style = bg=#BBD7EC,fg=#24292D
copy-mode-position-style = bg=#D7DCDF,fg=#24292D
```

For an isolated check, start a separate server with
`tmux -L md-check -f ~/.tmux.conf new-session -d -s check 'sleep 30'`, inspect
the options, then `tmux -L md-check kill-server`.
