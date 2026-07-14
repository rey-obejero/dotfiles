return {
  {
    "mason-org/mason-lspconfig.nvim",
    opts = function(_, opts)
      opts.ensure_installed = opts.ensure_installed or {}

      -- REMOVE jdtls completely
      opts.ensure_installed = vim.tbl_filter(function(v)
        return v ~= "jdtls"
      end, opts.ensure_installed)

      return opts
    end,
  },

  {
    "mason-org/mason.nvim",
    opts = function(_, opts)
      opts.ensure_installed = opts.ensure_installed or {}

      -- ALSO prevent direct mason install
      opts.ensure_installed = vim.tbl_filter(function(v)
        return v ~= "jdtls"
      end, opts.ensure_installed)

      return opts
    end,
  },
}
