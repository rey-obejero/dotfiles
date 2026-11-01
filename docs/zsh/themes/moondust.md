# Zsh: Moondust

Zsh uses Moondust for the Starship prompt, syntax highlighting, and `LS_COLORS`.

## Files

| Target | Source |
| --- | --- |
| `~/.zshrc` | `dot_zshrc` |
| `~/.config/starship.toml` | `dot_config/starship.toml` |

## Prompt

Starship uses explicit truecolor instead of ANSI `cyan bold`, which terminals
render as bright cyan:

| Module | Style |
| --- | --- |
| Directory | `fg:#434A51 bold` |
| Git branch | `fg:#1F639E bold` |

The rest of the prompt is disabled or uses the terminal ANSI mapping.

## Shell colors

`dot_zshrc` sets:

- `LS_COLORS` for directories, links, executables, archives, media, and source
  files.
- `ZSH_HIGHLIGHT_STYLES` for comments, commands, builtins, aliases, paths,
  strings, globbing, and unknown tokens.
- `ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=8'` for muted suggestions.

Most values use the ANSI slots documented in the
[shared palette](../../themes/moondust.md#terminal-ansi-mapping); the exact
RGB rendering comes from WezTerm. The command family uses truecolor gray 7
`#434A51` so it matches the reference `p1` without needing an ANSI slot.

## Apply

```sh
chezmoi apply ~/.zshrc ~/.config/starship.toml
exec zsh
```

## Verify

```sh
zsh -n ~/.zshrc
starship prompt --status=0 --pipestatus=0
```

The prompt output should contain truecolor sequences for the directory and
branch, not `1;36`.

```sh
zsh -lic 'typeset -p ZSH_HIGHLIGHT_STYLES; print -r -- "$ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE"'
```

Expected: `command='fg=#434A51'`, `builtin='fg=#434A51'`, `path='fg=8'`,
`string='fg=6'`, `comment='fg=7'`,
`ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=8'`.
