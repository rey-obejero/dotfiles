return {
  {
    "folke/snacks.nvim",
    opts = function(_, opts)
      opts.indent = { enabled = false }
      opts.indent.scope = { enabled = false }
      opts.indent.chunk = { enabled = false }

      -- Dashboard: Curated menu entries with absolute zero icon rendering
      opts.dashboard = vim.tbl_deep_extend("force", opts.dashboard or {}, {
        width = 30, -- Even tighter width layout bounds now that icons are gone
        preset = {
          header = "",
          -- Hand-picked menu items explicitly omitting Lazy-specific options
          keys = {
            { key = "f", desc = "Find File", action = ":lua Snacks.dashboard.pick('files')" },
            { key = "n", desc = "New File", action = ":ene | startinsert" },
            { key = "p", desc = "Projects", action = ":lua Snacks.dashboard.pick('projects')" },
            { key = "g", desc = "Find Text", action = ":lua Snacks.dashboard.pick('live_grep')" },
            { key = "r", desc = "Recent Files", action = ":lua Snacks.dashboard.pick('recent')" },
            {
              key = "c",
              desc = "Config",
              action = ":lua Snacks.dashboard.pick('files', {cwd = vim.fn.stdpath('config')})",
            },
            { key = "s", desc = "Restore Session", action = ":lua Snacks.dashboard.resume()" },
            { key = "q", desc = "Quit", action = ":qa" },
          },
        },
        formats = {
          footer = { "" },
          -- Overrides internal format template to strictly hide icon properties
          key = function(item)
            return { { item.key, hl = "SnacksDashboardKey" } }
          end,
          icon = function()
            return {} -- Forces an empty table slice, preventing fallback rendering
          end,
        },
        sections = {
          -- 1. Pulled all the way to the top margin without vertical pads

          -- 2. Your cleaned, text-only menu block
          { section = "keys", gap = 1, padding = 1 },
        },
      })

      -- Notifier: quiet
      opts.notifier = vim.tbl_extend("force", opts.notifier or {}, {
        style = "minimal",
        timeout = 3000,
      })

      opts.animate = { enabled = false }
      opts.scroll = { enabled = true }

      return opts
    end,

    -- Pure palette tweaks for a polished github_light presentation
    init = function()
      vim.api.nvim_create_autocmd("User", {
        pattern = "VeryLazy",
        callback = function()
          -- Subdued slate grays and dark text for high-contrast light backgrounds
          vim.api.nvim_set_hl(0, "SnacksDashboardHeader", { fg = "#57606a", bold = true })
          vim.api.nvim_set_hl(0, "SnacksDashboardKey", { fg = "#57606a", bold = true })
          vim.api.nvim_set_hl(0, "SnacksDashboardIcon", { fg = "#6e7781" })
          vim.api.nvim_set_hl(0, "SnacksDashboardDesc", { fg = "#24292f" })
        end,
      })
    end,
  },
}
