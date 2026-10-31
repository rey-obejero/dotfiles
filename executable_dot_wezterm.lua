local wezterm = require("wezterm")
local config = wezterm.config_builder()

config.enable_tab_bar = false
config.font = wezterm.font("GeistMono Nerd Font")

config.color_schemes = {
	moondust = {
		foreground = "#434A51",
		background = "#FFFFFF",
		cursor_bg = "#434A51",
		cursor_fg = "#FFFFFF",
		cursor_border = "#434A51",
		selection_bg = "#BBD7EC",
		selection_fg = "#24292D",
		scrollbar_thumb = "#B6BEC3",
		split = "#D7DCDF",
		ansi = {
			"#24292D",
			"#B35900",
			"#1F639E",
			"#7D4E00",
			"#1F639E",
			"#144B7B",
			"#3882C2",
			"#8E979F",
		},
		brights = {
			"#71787F",
			"#B35900",
			"#3882C2",
			"#7D4E00",
			"#65A4D7",
			"#144B7B",
			"#8EBCE1",
			"#F6F7F8",
		},
		tab_bar = {
			background = "#F6F7F8",
			active_tab = { bg_color = "#FFFFFF", fg_color = "#24292D" },
			inactive_tab = { bg_color = "#F6F7F8", fg_color = "#71787F" },
			inactive_tab_hover = { bg_color = "#E8EBED", fg_color = "#434A51" },
			new_tab = { bg_color = "#F6F7F8", fg_color = "#71787F" },
			new_tab_hover = { bg_color = "#E8EBED", fg_color = "#434A51" },
		},
	},
}

config.color_scheme = "moondust"

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
