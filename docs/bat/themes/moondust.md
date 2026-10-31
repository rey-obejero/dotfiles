# bat: Moondust

bat uses a custom TextMate theme built from the Moondust light palette.

## Files

| Target | Source |
| --- | --- |
| `~/.config/bat/config` | `dot_config/bat/config` |
| `~/.config/bat/themes/moondust.tmTheme` | `dot_config/bat/themes/moondust.tmTheme` |

## Configuration

`dot_config/bat/config` selects the theme:

```text
--theme="moondust"
```

## Theme map

| Scope | Value |
| --- | --- |
| Background | `#FFFFFF` |
| Foreground | `#434A51` |
| Comments | `#8E979F` italic |
| Strings / symbols | `#1F639E` |
| Numbers | `#33383D` |
| Constants | `#3882C2` |
| Keywords / storage | `#434A51` |
| Functions | `#33383D` |
| Types | `#1F639E` |
| Variables | `#434A51` |
| Operators / punctuation | `#71787F` |
| Invalid / errors | `#B35900` bold |
| Markdown headings | `#24292D` bold |
| Markdown links | `#3882C2` underline |
| Diff added | `#1F639E` |
| Diff removed | `#B35900` |
| Diff changed | `#7D4E00` |

## Apply

```sh
chezmoi apply ~/.config/bat/config ~/.config/bat/themes/moondust.tmTheme
bat cache --build
```

`bat cache --build` is required after changing or adding a theme; bat keeps a
compiled cache in `~/.cache/bat`.

## Verify

```sh
bat --list-themes | grep -i moondust
bat --theme=moondust --color=always --style=plain test.sh >/dev/null
```

Use a syntax-recognized file (for example `test.sh`) when checking colors.
Extensionless files such as `.zshrc` may be treated as plain text, so only the
foreground color appears.

For a real color check:

```sh
bat --theme=moondust --color=always --style=plain test.sh | cat -v
```

Comments should be `#8E979F`, strings `#1F639E`, and the base text `#434A51`.
