-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here
vim.keymap.set("n", "<leader>`", function()
  -- for _, buf in ipairs(vim.api.nvim_list_bufs()) do
  --   if vim.api.nvim_buf_is_valid(buf) and vim.bo[buf].buflisted then
  --     vim.cmd("bd " .. buf)
  --   end
  -- end
  Snacks.dashboard()
end, { desc = "Display the dashboard" })
