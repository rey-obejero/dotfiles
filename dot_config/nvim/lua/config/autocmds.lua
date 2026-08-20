-- Autocmds are automatically loaded on the VeryLazy event
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
--
-- Add any additional autocmds here
-- with `vim.api.nvim_create_autocmd`
--
-- Or remove existing autocmds by their group name (which is prefixed with `lazyvim_` for the defaults)
-- e.g. vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")

-- Auto-apply chezmoi on save when editing files in the chezmoi source dir.
-- Covers the `nvim ~/.local/share/chezmoi/...` workflow; `chezmoi edit` is
-- auto-applied separately via the [edit] apply=true/watch=true config.
vim.api.nvim_create_autocmd("BufWritePost", {
  pattern = vim.fn.expand("~/.local/share/chezmoi/**"),
  group = vim.api.nvim_create_augroup("chezmoi_auto_apply", { clear = true }),
  callback = function(args)
    vim.fn.jobstart({ "chezmoi", "apply", "--source-path", args.match }, { detach = true })
  end,
})
