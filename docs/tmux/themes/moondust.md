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
| `message-style` | `bg=#D7DCDF,fg=#24292D` |
| `message-command-style` | `bg=#D7DCDF,fg=#24292D` |
| `mode-style` | `bg=#BBD7EC,fg=#24292D` |
| `copy-mode-position-style` | `bg=#D7DCDF,fg=#24292D` |
| `clock-mode-colour` | `#1F639E` |
| `display-panes-active-colour` | `#1F639E` |

The status bar inherits the terminal background, the active window has no fill,
and the session count is right-aligned at the edge.

tmux fills only the cells its own text occupies, so the message line, the
command prompt, and the copy-mode position indicator are all small chips rather
than full-width bars. All three use the reference widget-border gray `#D7DCDF`
with `#24292D` text: gray 1 `#E8EBED` sits at only 1.20:1 against white, which
reads as a wash over a large row but nearly vanishes behind a short badge, while
`#D7DCDF` reaches 1.38:1 and still holds a visible edge at badge size. The
one shade is deliberate, because these chips differ only in which transient mode
they announce, and their text already says that. The position indicator is set
explicitly because tmux otherwise inherits `mode-style` and paints the scroll
readout with the selection blue.

## Apply

```sh
chezmoi apply ~/.tmux.conf
tmux source-file ~/.tmux.conf
```

## Verify

```sh
for o in status-style status-right status-right-length \
  window-status-current-style pane-active-border-style message-style \
  message-command-style mode-style copy-mode-position-style; do
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
message-style = bg=#D7DCDF,fg=#24292D
message-command-style = bg=#D7DCDF,fg=#24292D
mode-style = bg=#BBD7EC,fg=#24292D
copy-mode-position-style = bg=#D7DCDF,fg=#24292D
```

For an isolated check, start a separate server with
`tmux -L md-check -f ~/.tmux.conf new-session -d -s check 'sleep 30'`, inspect
the options, then `tmux -L md-check kill-server`.
