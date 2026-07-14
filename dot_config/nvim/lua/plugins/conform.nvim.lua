return {
  {
    "stevearc/conform.nvim",
    opts = function(_, opts)
      opts.formatters_by_ft = opts.formatters_by_ft or {}
      opts.formatters_by_ft.liquid = opts.formatters_by_ft.liquid or {}
      table.insert(opts.formatters_by_ft.liquid, "prettier")
    end,
  },
}
