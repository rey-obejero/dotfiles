local p = {
  bg = "#FFFFFF",
  fg = "#434A51",
  muted = "#71787F",
  dim = "#8E979F",
  surface = "#F6F7F8",
  selection = "#BBD7EC",
  accent = "#1F639E",
  link = "#3882C2",
  error = "#B35900",
  strongest = "#24292D",
}

return {
  normal = {
    a = { fg = p.fg, bg = p.bg, gui = "bold" },
    b = { fg = p.muted, bg = p.surface },
    c = { fg = p.fg, bg = p.bg },
  },
  insert = {
    a = { fg = p.bg, bg = p.accent, gui = "bold" },
    b = { fg = p.muted, bg = p.surface },
    c = { fg = p.fg, bg = p.bg },
  },
  visual = {
    a = { fg = p.strongest, bg = p.selection, gui = "bold" },
    b = { fg = p.muted, bg = p.surface },
    c = { fg = p.fg, bg = p.bg },
  },
  replace = {
    a = { fg = p.bg, bg = p.error, gui = "bold" },
    b = { fg = p.muted, bg = p.surface },
    c = { fg = p.fg, bg = p.bg },
  },
  command = {
    a = { fg = p.bg, bg = p.link, gui = "bold" },
    b = { fg = p.muted, bg = p.surface },
    c = { fg = p.fg, bg = p.bg },
  },
  terminal = {
    a = { fg = p.bg, bg = p.accent, gui = "bold" },
    b = { fg = p.muted, bg = p.surface },
    c = { fg = p.fg, bg = p.bg },
  },
  inactive = {
    a = { fg = p.dim, bg = p.surface },
    b = { fg = p.dim, bg = p.surface },
    c = { fg = p.dim, bg = p.surface },
  },
}
