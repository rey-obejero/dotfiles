// Server-side entrypoint. This plugin only renders in the TUI, so the server
// half is intentionally a no-op. It exists so the TUI component in ./tui.tsx
// is discovered and loaded alongside a normal server plugin.
//
// Note: discovered plugins cannot resolve the bare "@opencode/plugin"
// specifier (only "@opencode/plugin/tui" is provided by the runtime), so this
// exports the plugin object directly instead of using Plugin.define.
export default {
  id: "token-tracker",
  setup() {},
}
