# Neovim: Moondust

Neovim has a native `moondust` colorscheme plus a matching lualine theme.

## Files

| Target | Source |
| --- | --- |
| `~/.config/nvim/colors/moondust.lua` | `dot_config/nvim/colors/moondust.lua` |
| `~/.config/nvim/lua/plugins/colorscheme.lua` | `dot_config/nvim/lua/plugins/colorscheme.lua` |
| `~/.config/nvim/lua/lualine/themes/moondust.lua` | `dot_config/nvim/lua/lualine/themes/moondust.lua` |
| `~/.config/nvim/lua/plugins/lualine.nvim.lua` | `dot_config/nvim/lua/plugins/lualine.nvim.lua` |
| `~/.config/nvim/lua/plugins/snacks.nvim.lua` | `dot_config/nvim/lua/plugins/snacks.nvim.lua` |

## Load

LazyVim loads it with:

```lua
opts = { colorscheme = "moondust" }
```

The old `github-nvim-theme` spec is removed. A stale `github-nvim-theme` entry
may remain in `lazy-lock.json`; it is no longer referenced.

## Highlights

| Group | Value |
| --- | --- |
| `Normal` | bg `#FFFFFF`, fg `#434A51` |
| `Cursor` | bg `#71787F`, fg `#FFFFFF` |
| `Comment` | `#8E979F` |
| `String` | `#1F639E` |
| `Function` | `#33383D` |
| `Keyword` | `#434A51` |
| `Type` | `#33383D` italic |
| `Typedef` | `#33383D` italic |
| `Constant` | `#434A51` |
| `StorageClass` / `Structure` / `Label` | `#434A51` |
| `PreProc` / `Include` / `Define` / `Macro` | `#71787F` |
| `Visual` | bg `#BBD7EC` |
| `Search` | bg `#BBD7EC` |
| `WinSeparator` | `#D7DCDF` |
| `DiagnosticError` | `#B35900` |
| `DiagnosticWarn` | `#7D4E00` |
| `DiagnosticInfo` | `#8E979F` |

lualine uses `theme = "moondust"`; the dashboard highlights use the same
palette.

## Verify

```sh
nvim --headless -u NONE \
  --cmd "set rtp^=$HOME/.config/nvim" \
  --cmd "colorscheme moondust" \
  --cmd "lua print(vim.g.colors_name); print(vim.inspect(vim.api.nvim_get_hl(0,{name='Normal'})))" \
  +qa
```

Full config check:

```sh
timeout 90 nvim --headless -u ~/.config/nvim/init.lua \
  "+lua print(vim.g.colors_name)" \
  "+lua print(vim.inspect(vim.api.nvim_get_hl(0,{name='Normal'})))" +qa
```

Expected: `moondust`, `bg = 16777215` (`#FFFFFF`), `fg = 4409937` (`#434A51`).
