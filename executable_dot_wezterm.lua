local wezterm = require("wezterm")
local config = wezterm.config_builder()

config.enable_tab_bar = false
config.font = wezterm.font("GeistMono Nerd Font")

config.color_scheme = "Github (base16)"

config.enable_kitty_keyboard = true

config.keys = {
	{
		key = "Enter",
		mods = "SHIFT",
		action = wezterm.action.SendString("\x1b[13;2u"),
	},
}

config.warn_about_missing_glyphs = false

return config
