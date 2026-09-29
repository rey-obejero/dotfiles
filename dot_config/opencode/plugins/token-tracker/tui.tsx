import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { Show } from "solid-js"

// Compact token totals for the active session. Rendering reads the reactive
// TUI data store, which is updated from the server's `session.usage.updated`
// event, so the numbers refresh as the session runs.

function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return `${Math.round(value)}`
}

function TokenStatus(props: { sessionID?: string; detail?: boolean }) {
  const ctx = usePlugin()
  const tokens = () => {
    const id = props.sessionID
    return id ? ctx.data.session.get(id)?.tokens : undefined
  }
  const total = () => {
    const t = tokens()
    return t ? t.input + t.output + t.reasoning : 0
  }
  const cache = () => {
    const t = tokens()
    return t ? t.cache.read + t.cache.write : 0
  }
  return (
    <Show when={tokens()} fallback={<text fg={ctx.theme.text.muted}>tokens —</text>}>
      <text fg={ctx.theme.text.muted}>
        {`tokens ${formatTokens(total())}  in ${formatTokens(tokens()!.input)}  out ${formatTokens(tokens()!.output)}` +
          (props.detail ? `  cache ${formatTokens(cache())}` : "")}
      </text>
    </Show>
  )
}

// On Home there is no session in the slot input, so fall back to the most
// recently updated session and show nothing until one exists.
function RecentTokenStatus() {
  const ctx = usePlugin()
  const sessionID = () => ctx.data.session.list()[0]?.id
  return (
    <Show when={sessionID()}>
      {(id) => <TokenStatus sessionID={id()} />}
    </Show>
  )
}

export default Plugin.define({
  id: "token-tracker",
  setup(context) {
    const disposers = [
      // Sidebar: compact token line at the bottom.
      context.ui.slot({
        append: "sidebar.footer",
        render: (input) => <TokenStatus sessionID={input.sessionID} detail />,
      }),
      // Compact status line below the message input.
      context.ui.slot({
        append: "prompt.footer.status",
        render: (input) => <TokenStatus sessionID={input.sessionID} />,
      }),
      // Compact status line on Home.
      context.ui.slot({
        append: "home.footer.status",
        render: () => <RecentTokenStatus />,
      }),
    ]
    return () => {
      for (const dispose of disposers) dispose()
    }
  },
})
