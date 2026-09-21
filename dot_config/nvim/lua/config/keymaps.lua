-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here
local sidebar_ft = { ["neo-tree"] = true }

local function usable(win)
  local buf = vim.api.nvim_win_get_buf(win)
  return vim.api.nvim_win_get_config(win).relative == "" and not sidebar_ft[vim.bo[buf].filetype]
end

-- Prompt before dropping unsaved changes. Returns false if the user cancels.
local function confirm_unsaved()
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if
      vim.api.nvim_buf_is_valid(buf)
      and vim.bo[buf].buflisted
      and vim.bo[buf].buftype == ""
      and vim.bo[buf].modified
    then
      local name = vim.api.nvim_buf_get_name(buf)
      name = name == "" and "[No Name]" or vim.fn.fnamemodify(name, ":~:.")
      local choice = vim.fn.confirm("Save changes to " .. name .. "?", "&Save\n&Discard\n&Cancel", 1)
      if choice == 1 then
        local ok = pcall(vim.api.nvim_buf_call, buf, function()
          vim.cmd("write")
        end)
        if not ok then
          return false
        end
      elseif choice ~= 2 then -- Cancel or Esc
        return false
      end
    end
  end
  return true
end

vim.keymap.set("n", "<leader>`", function()
  if not confirm_unsaved() then
    return
  end

  -- Prefer the current window, but never take over a sidebar like neo-tree.
  local target = vim.api.nvim_get_current_win()
  if not usable(target) then
    for _, win in ipairs(vim.api.nvim_list_wins()) do
      if usable(win) then
        target = win
        break
      end
    end
  end

  -- Open the dashboard first: deleting the editing buffers below also closes
  -- the windows showing them, so the dashboard window has to exist already.
  Snacks.dashboard({ win = target })
  vim.api.nvim_set_current_win(target)

  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_valid(buf) and vim.bo[buf].buflisted and vim.bo[buf].buftype == "" then
      pcall(vim.api.nvim_buf_delete, buf, { force = true })
    end
  end
end, { desc = "Show Dashboard" })
