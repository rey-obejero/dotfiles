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

## Ports

- [OMP](../omp/themes/moondust.md)
- [WezTerm](../wezterm/themes/moondust.md)
- [Neovim](../neovim/themes/moondust.md)
- [tmux](../tmux/themes/moondust.md)
- [Zsh](../zsh/themes/moondust.md)
- [bat](../bat/themes/moondust.md)
