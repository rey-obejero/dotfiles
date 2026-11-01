# Moondust theme ports

The palette is taken from the light theme in
[`vanyauhalin/moondusttheme`](https://github.com/vanyauhalin/moondusttheme),
specifically `lightTheme()` in `theme.js`.

No port invents new hex colors. The shared palette is fixed; each port chooses
which reference shade to use for which role.

## Palette

| Family | Values |
| --- | --- |
| Grays | `#F6F7F8` `#E8EBED` `#D7DCDF` `#B6BEC3` `#8E979F` `#71787F` `#575E66` `#434A51` `#33383D` `#24292D` |
| Blues | `#F2F8FC` `#E2EFF8` `#BBD7EC` `#8EBCE1` `#65A4D7` `#3882C2` `#1F639E` `#144B7B` |
| Error | `#B35900` |
| Warning | `#7D4E00` |
| Background | `#FFFFFF` |

The raw light theme also defines blue 8 `#113C5F` and blue 9 `#0E2E48`; the
light UI and every port leave those unused.

## Terminal ANSI mapping

Used by WezTerm and inherited by tmux and Zsh:

| Slot | Color |
| --- | --- |
| 0 | `#24292D` |
| 1 | `#B35900` |
| 2 | `#1F639E` |
| 3 | `#7D4E00` |
| 4 | `#1F639E` |
| 5 | `#144B7B` |
| 6 | `#3882C2` |
| 7 | `#8E979F` |
| 8 | `#71787F` |
| 9 | `#B35900` |
| 10 | `#3882C2` |
| 11 | `#7D4E00` |
| 12 | `#65A4D7` |
| 13 | `#144B7B` |
| 14 | `#8EBCE1` |
| 15 | `#F6F7F8` |

## Reference usage

The reference uses grays for hierarchy and blues for interaction. Values are
from `theme.js`; UI roles are from `editor.js` `lightColors()`.

### Grays

| Index | Value | Reference role |
| --- | --- | --- |
| 0 | `#F6F7F8` | Sidebar/peek backgrounds, ruler |
| 1 | `#E8EBED` | Toolbar hover, inactive list selection, line highlight |
| 2 | `#D7DCDF` | Widget/status borders, editor whitespace |
| 3 | `#B6BEC3` | Scrollbar, peek border, modified gutter |
| 4 | `#8E979F` | Comments, line numbers, inactive activity bar, `info` |
| 5 | `#71787F` | Description text, cursor, breakpoint icon |
| 6 | `#575E66` | Activity/status bars, status items, suggest status |
| 7 | `#434A51` | Main foreground/body text, panel active border |
| 8 | `#33383D` | Secondary button hover only |
| 9 | `#24292D` | Unused by the light UI |

### Blues

| Index | Value | Reference role |
| --- | --- | --- |
| 0 | `#F2F8FC` | Unused by the light UI |
| 1 | `#E2EFF8` | Editor selection highlight |
| 2 | `#BBD7EC` | Editor selection background, list focus highlight |
| 3 | `#8EBCE1` | Focus border, list focus outline |
| 4 | `#65A4D7` | Unused by the light UI |
| 5 | `#3882C2` | Links, buttons, list active selection, peek selection, string delimiters |
| 6 | `#1F639E` | Button hover |
| 7 | `#144B7B` | String content |
| 8 | `#113C5F` | Unused |
| 9 | `#0E2E48` | Unused |

### Syntax classes

The core theme exposes exactly five syntax classes; per-language
`langs/*/config.yaml` files map scopes onto them.

| Class | Value | Role |
| --- | --- | --- |
| `c0` | gray 4 `#8E979F` | Comments |
| `p0` | gray 5 `#71787F` | Keywords, operators, punctuation |
| `p1` | gray 7 `#434A51` | Commands, declarations, functions |
| `s0` | blue 5 `#3882C2` | String delimiters, quotes, backticks |
| `s1` | blue 7 `#144B7B` | String content |

Across the language configs, `p0` is used 1342 times, `p1` 496, `s1` 86,
`s0` 73, and `c0` 77. Keywords are therefore the quiet `p0`; commands and
declarations are the darker `p1`, the same shade as body text. Strings are the
only syntax family with hue.

### Contrast

| Color | Contrast on white |
| --- | --- |
| Gray 7 body text | 8.99:1 |
| Gray 6 secondary UI | 6.57:1 |
| Gray 5 description | 4.47:1 |
| Gray 4 comments | 2.97:1 |
| Blue 5 links/strings | 4.09:1 |
| Blue 6 hover | 6.29:1 |
| Blue 7 string content | 9.04:1 |

Selection surfaces are intentionally low contrast: blue 1 is 1.17:1 and blue 2
is 1.50:1. Error `#B35900` and warning `#7D4E00` are the only warm colors.

### Port notes

- OMP `selectedBg` is blue 1 `#E2EFF8`; the reference editor selection is blue
  2 `#BBD7EC`, list focus highlight is blue 2, and list active selection is
  blue 5. OMP is using the reference’s lighter selection-highlight shade.
- OMP and bat add function/type roles beyond the reference’s five syntax
  classes; those are port-level interpretations, not reference tokens.
- The 16-slot ANSI mapping is our construction. The reference’s `terminal`
  block is commented out and defines no ANSI palette.
- Error/warning tokens, the status line, prompts, and diff semantics are port
  adaptations; the reference has no equivalent tokens.

## Ports

- [OMP](../omp/themes/moondust.md)
- [WezTerm](../wezterm/themes/moondust.md)
- [Neovim](../neovim/themes/moondust.md)
- [tmux](../tmux/themes/moondust.md)
- [Zsh](../zsh/themes/moondust.md)
- [bat](../bat/themes/moondust.md)
