local wezterm = require("wezterm")
local config = wezterm.config_builder()

config.enable_tab_bar = false
config.font = wezterm.font("GeistMono Nerd Font")

config.color_scheme = "Github (base16)"

config.enable_kitty_keyboard = true

return config
