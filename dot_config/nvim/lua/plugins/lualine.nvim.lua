return {
  {
    "nvim-lualine/lualine.nvim",
    opts = function(_, opts)
      -- Strip section separators entirely
      opts.options = vim.tbl_extend("force", opts.options or {}, {
        component_separators = { left = "", right = "" },
        section_separators = { left = "", right = "" },
        icons_enabled = false, -- No icons anywhere in statusline
        theme = "moondust",
      })

      -- Minimal sections: mode (text) | filename | git branch =>> | position
      opts.sections = {
        lualine_a = {
          {
            "mode",
            fmt = function(s)
              -- Changed from s:lower() to s:upper() to force uppercase (e.g., "VISUAL")
              return s:upper()
            end,
          },
        },
        lualine_b = {
          { "branch", icon = "" }, -- text-only branch name
        },
        lualine_c = {
          { "filename", path = 1, symbols = { modified = "·", readonly = "", unnamed = "[no name]" } },
        },

        lualine_x = {},
        lualine_y = {},
        lualine_z = {
          { "filetype", icon_only = false, icons_enabled = false, padding = { left = 1, right = 1 } },
          { "location", padding = { left = 1, right = 0 } },
        },
      }

      opts.inactive_sections = {
        lualine_a = {},
        lualine_b = {},
        lualine_c = { { "filename", path = 1 } },
        lualine_x = { { "location", padding = { left = 1, right = 0 } } },
        lualine_y = {},
        lualine_z = {},
      }

      return opts
    end,
  },
}
