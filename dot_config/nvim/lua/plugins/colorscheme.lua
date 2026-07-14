---@diagnostic disable: undefined-global

return {
  -- 1. Configure GitHub Theme Natively
  {
    "projekt0n/github-nvim-theme",
    lazy = false,
    priority = 1000,
    config = function()
      require("github-theme").setup({
        options = {
          transparent = false,
          darken = {
            sidebars = {
              enable = false,
            },
          },
        },
        groups = {
          all = {
            NeoTreeNormal = { bg = "NONE" },
            NeoTreeNormalNC = { bg = "NONE" },
            NeoTreeEndOfBuffer = { fg = "NONE", bg = "NONE" },

            -- Hardcode the official GitHub Light border hex string to prevent compiler errors
            WinSeparator = { fg = "#d0d7de", bg = "NONE" },
            NeoTreeWinSeparator = { fg = "#d0d7de", bg = "NONE" },
          },
        },
      })

      -- Load colorscheme immediately within the theme block
      vim.cmd("colorscheme github_light_default")
    end,
  },

  -- 2. Configure LazyVim to track the active colorscheme cleanly
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "github_light_default",
    },
  },
}
