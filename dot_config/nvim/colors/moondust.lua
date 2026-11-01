-- Moondust light colorscheme for Neovim
vim.cmd("hi clear")
if vim.fn.exists("syntax_on") == 1 then
  vim.cmd("syntax reset")
end
vim.o.background = "light"
vim.g.colors_name = "moondust"

local p = {
  bg = "#FFFFFF",
  fg = "#434A51",
  muted = "#71787F",
  dim = "#8E979F",
  border = "#D7DCDF",
  surface = "#F6F7F8",
  surface2 = "#E8EBED",
  selection = "#BBD7EC",
  accent = "#1F639E",
  link = "#3882C2",
  error = "#B35900",
  warning = "#7D4E00",
  strong = "#33383D",
  strongest = "#24292D",
}

local function hl(group, opts)
  vim.api.nvim_set_hl(0, group, opts)
end

-- Editor chrome
hl("Normal", { fg = p.fg, bg = p.bg })
hl("NormalNC", { fg = p.fg, bg = p.bg })
hl("NormalFloat", { fg = p.fg, bg = p.surface })
hl("FloatBorder", { fg = p.border, bg = p.surface })
hl("FloatTitle", { fg = p.strong, bg = p.surface, bold = true })
hl("Cursor", { fg = p.bg, bg = p.accent })
hl("CursorIM", { fg = p.bg, bg = p.accent })
hl("CursorLine", { bg = p.surface })
hl("CursorColumn", { bg = p.surface })
hl("CursorLineNr", { fg = p.strong, bold = true })
hl("LineNr", { fg = p.dim })
hl("LineNrAbove", { fg = p.dim })
hl("LineNrBelow", { fg = p.dim })
hl("SignColumn", { bg = p.bg })
hl("ColorColumn", { bg = p.surface2 })
hl("Visual", { bg = p.selection, fg = p.strongest })
hl("VisualNOS", { bg = p.selection, fg = p.strongest })
hl("Search", { bg = p.selection, fg = p.strongest })
hl("IncSearch", { bg = p.link, fg = p.bg, bold = true })
hl("CurSearch", { bg = p.link, fg = p.bg, bold = true })
hl("Pmenu", { fg = p.fg, bg = p.surface })
hl("PmenuSel", { fg = p.strongest, bg = p.selection, bold = true })
hl("PmenuSbar", { bg = p.surface2 })
hl("PmenuThumb", { bg = p.dim })
hl("StatusLine", { fg = p.fg, bg = p.surface })
hl("StatusLineNC", { fg = p.dim, bg = p.surface })
hl("TabLine", { fg = p.muted, bg = p.surface })
hl("TabLineSel", { fg = p.strongest, bg = p.bg, bold = true })
hl("TabLineFill", { bg = p.surface })
hl("WinSeparator", { fg = p.border, bg = p.bg })
hl("VertSplit", { fg = p.border, bg = p.bg })
hl("Folded", { fg = p.muted, bg = p.surface2 })
hl("FoldColumn", { fg = p.dim, bg = p.bg })
hl("NonText", { fg = p.dim })
hl("SpecialKey", { fg = p.dim })
hl("Whitespace", { fg = p.surface2 })
hl("EndOfBuffer", { fg = p.bg })
hl("Directory", { fg = p.accent })
hl("Title", { fg = p.strongest, bold = true })
hl("MatchParen", { fg = p.accent, bold = true, underline = true })
hl("Conceal", { fg = p.dim })

-- Syntax
hl("Comment", { fg = p.dim })
hl("Constant", { fg = p.fg })
hl("String", { fg = p.accent })
hl("Character", { fg = p.accent })
hl("Number", { fg = p.strong })
hl("Boolean", { fg = p.strong })
hl("Float", { fg = p.strong })
hl("Identifier", { fg = p.fg })
hl("Function", { fg = p.strong })
hl("Statement", { fg = p.fg })
hl("Conditional", { fg = p.fg })
hl("Repeat", { fg = p.fg })
hl("Label", { fg = p.fg })
hl("Operator", { fg = p.muted })
hl("Keyword", { fg = p.fg })
hl("Exception", { fg = p.error })
hl("PreProc", { fg = p.muted })
hl("Include", { fg = p.muted })
hl("Define", { fg = p.muted })
hl("Macro", { fg = p.muted })
hl("Type", { fg = p.strong, italic = true })
hl("StorageClass", { fg = p.fg })
hl("Structure", { fg = p.fg })
hl("Typedef", { fg = p.strong, italic = true })
hl("Special", { fg = p.accent })
hl("Underlined", { fg = p.link, underline = true })
hl("Error", { fg = p.error, bold = true })
hl("Todo", { fg = p.warning, bold = true })

-- Diagnostics
hl("DiagnosticError", { fg = p.error })
hl("DiagnosticWarn", { fg = p.warning })
hl("DiagnosticInfo", { fg = p.accent })
hl("DiagnosticHint", { fg = p.muted })
hl("DiagnosticUnderlineError", { undercurl = true, sp = p.error })
hl("DiagnosticUnderlineWarn", { undercurl = true, sp = p.warning })
hl("DiagnosticUnderlineInfo", { undercurl = true, sp = p.accent })
hl("DiagnosticUnderlineHint", { undercurl = true, sp = p.muted })
hl("DiagnosticVirtualTextError", { fg = p.error, bg = p.surface2 })
hl("DiagnosticVirtualTextWarn", { fg = p.warning, bg = p.surface2 })
hl("DiagnosticVirtualTextInfo", { fg = p.accent, bg = p.surface2 })
hl("DiagnosticVirtualTextHint", { fg = p.muted, bg = p.surface2 })

-- Diffs and git
hl("DiffAdd", { fg = p.accent, bg = p.surface2 })
hl("DiffChange", { fg = p.warning, bg = p.surface2 })
hl("DiffDelete", { fg = p.error, bg = p.surface2 })
hl("DiffText", { fg = p.strongest, bg = p.selection })
hl("Added", { fg = p.accent })
hl("Changed", { fg = p.warning })
hl("Removed", { fg = p.error })
hl("GitSignsAdd", { link = "Added" })
hl("GitSignsChange", { link = "Changed" })
hl("GitSignsDelete", { link = "Removed" })

-- LSP
hl("LspReferenceText", { bg = p.surface2 })
hl("LspReferenceRead", { bg = p.surface2 })
hl("LspReferenceWrite", { bg = p.selection })
hl("LspSignatureActiveParameter", { fg = p.accent, bold = true })
hl("LspCodeLens", { fg = p.dim })

-- Treesitter
local ts = {
  ["@comment"] = { link = "Comment" },
  ["@string"] = { link = "String" },
  ["@function"] = { link = "Function" },
  ["@keyword"] = { link = "Statement" },
  ["@type"] = { link = "Type" },
  ["@variable"] = { link = "Identifier" },
  ["@constant"] = { link = "Constant" },
  ["@number"] = { link = "Number" },
  ["@operator"] = { link = "Operator" },
  ["@punctuation"] = { fg = p.muted },
  ["@markup.heading"] = { fg = p.strongest, bold = true },
  ["@markup.link"] = { fg = p.link, underline = true },
  ["@markup.raw"] = { fg = p.strong },
  ["@markup.quote"] = { fg = p.muted },
  ["@markup.list"] = { fg = p.accent },
  ["@diagnostic.error"] = { link = "DiagnosticError" },
  ["@diagnostic.warn"] = { link = "DiagnosticWarn" },
}
for group, opts in pairs(ts) do
  hl(group, opts)
end

-- Plugins
hl("NeoTreeNormal", { fg = p.fg, bg = p.bg })
hl("NeoTreeNormalNC", { fg = p.fg, bg = p.bg })
hl("NeoTreeWinSeparator", { fg = p.border, bg = p.bg })
hl("NeoTreeDirectoryName", { fg = p.accent })
hl("NeoTreeGitAdded", { fg = p.accent })
hl("NeoTreeGitModified", { fg = p.warning })
hl("NeoTreeGitDeleted", { fg = p.error })
hl("TelescopeNormal", { fg = p.fg, bg = p.bg })
hl("TelescopeBorder", { fg = p.border, bg = p.bg })
hl("TelescopeSelection", { fg = p.strongest, bg = p.selection })
hl("TelescopeMatching", { fg = p.link, bold = true })
hl("WhichKeyFloat", { bg = p.surface })
hl("WhichKey", { fg = p.accent })
hl("WhichKeyDesc", { fg = p.fg })
hl("SnacksDashboardHeader", { fg = p.strong, bold = true })
hl("SnacksDashboardKey", { fg = p.strong, bold = true })
hl("SnacksDashboardIcon", { fg = p.muted })
hl("SnacksDashboardDesc", { fg = p.fg })
