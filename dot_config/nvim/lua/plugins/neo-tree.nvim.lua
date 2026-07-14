-- lua/plugins/neo-tree.lua
return {
  {
    "nvim-neo-tree/neo-tree.nvim",
    opts = function(_, opts)
      opts.sync_root_with_cwd = true
      opts.respect_buf_cwd = false
      opts.filesystem = opts.filesystem or {}
      opts.filesystem.bind_to_cwd = true -- Stays glued to your original :pwd
      opts.filesystem.follow_current_file = {
        enabled = true, -- Auto-highlights file in tree, but won't shift your pwd
      }
      opts.filesystem.filtered_items = {
        visible = false,
        hide_dotfiles = false,
        hide_gitignored = false,
      }
      opts.window = vim.tbl_extend("force", opts.window or {}, {
        width = 30,
        mappings = {},
      })
      opts.default_component_configs = vim.tbl_deep_extend("force", opts.default_component_configs or {}, {
        indent = {
          indent_size = 2,
          padding = 0,
          with_markers = false, -- removes indent guides
          with_expanders = true,
          expander_collapsed = "›", -- Tiny chevron matching your which-key group icon
          expander_expanded = "⌄", -- Matchingly small downward indicator for open folders
        },
        icon = {
          folder_closed = "",
          folder_open = "",
          folder_empty = "",
          folder_empty_open = "",
          -- Explicitly defaults file indicators to empty strings to wipe out file-type icons
          default = "",
        },
        git_status = {
          symbols = {
            added = "",
            modified = "",
            deleted = "",
            renamed = "",
            untracked = "",
            ignored = "",
            unstaged = "",
            staged = "",
            conflict = "",
          },
        },
      })
      return opts
    end,
  },
}
