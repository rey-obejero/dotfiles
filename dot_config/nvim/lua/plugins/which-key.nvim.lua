return {
  "folke/which-key.nvim",
  event = "VeryLazy",
  opts = {
    icons = {
      mappings = false,
      rules = false,
      breadcrumb = "",
      separator = "", -- Adds a clean, flat text arrow for your mappings
      group = "› ", -- Uses a tiny, subtle text-based plus sign for sub-menus
    },
  },
  keys = {
    {
      "<leader>?",
      function()
        require("which-key").show({ global = false })
      end,
      desc = "Buffer Local Keymaps (which-key)",
    },
  },
}
