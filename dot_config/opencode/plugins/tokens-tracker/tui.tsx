import { Plugin, usePlugin } from "@opencode/plugin/tui";
import { For, Show, createMemo } from "solid-js";

// Cumulative token usage for the active session. Rendering reads the reactive
// TUI data store, which the server updates from `session.usage.updated`, so the
// numbers refresh as the session runs.
//
// OpenCode stores `input` as the input tokens that were NOT cache hits, and
// `cache.read` as the input tokens that were served from the prompt cache.
// The cache hit rate is therefore cache.read / (input + cache.read).

type Tokens = {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
};

function formatExact(value: number): string {
  return value.toLocaleString();
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

function cacheHitRate(tokens: Tokens): number | undefined {
  const total = tokens.input + tokens.cache.read;
  if (total <= 0) return undefined;
  return Math.round((tokens.cache.read / total) * 100);
}

function hasUsage(tokens: Tokens | undefined): boolean {
  if (!tokens) return false;
  return (
    tokens.input + tokens.output + tokens.reasoning + tokens.cache.read > 0
  );
}

// Sidebar: a "Tokens" section that lands under the built-in Context section.
function TokensSection(props: { sessionID: string }) {
  const ctx = usePlugin();
  const tokens = () =>
    ctx.data.session.get(props.sessionID)?.tokens as Tokens | undefined;

  const rows = createMemo(() => {
    const t = tokens();
    if (!t) return [];
    const hit = cacheHitRate(t);
    return [
      { value: formatExact(t.input), label: "input" },
      { value: formatExact(t.cache.read), label: "cache read", hit },
      { value: formatExact(t.output), label: "output" },
    ];
  });

  return (
    <Show when={hasUsage(tokens())}>
      <box>
        <text fg={ctx.theme.text.base}>
          <b>Tokens</b>
        </text>
        <For each={rows()}>
          {(row) => (
            <text fg={ctx.theme.text.muted}>
              <span fg={ctx.theme.text.base}>{row.value}</span> {row.label}
              {row.hit === undefined ? "" : ` (${row.hit}%)`}
            </text>
          )}
        </For>
      </box>
    </Show>
  );
}

// Prompt footer: compact single line shown in the same footer row as
// OpenCode's own context/cost figures, which it renders just after ours.
function TokenFooter(props: { sessionID?: string }) {
  const ctx = usePlugin();
  const tokens = () =>
    props.sessionID
      ? (ctx.data.session.get(props.sessionID)?.tokens as Tokens | undefined)
      : undefined;

  const line = createMemo(() => {
    const t = tokens();
    if (!t) return "";
    const hit = cacheHitRate(t);
    // OpenCode renders its context/cost figures after our slot, so end our
    // segment with a separator to keep the two groups visually distinct.
    return `${formatCompact(t.input)}\t|\t${formatCompact(t.cache.read)}${hit === undefined ? "" : ` (${hit}%)`}\t|\t${formatCompact(t.output)}\t|`;
  });

  return (
    <Show when={hasUsage(tokens())}>
      <text fg={ctx.theme.text.muted}>{line()}</text>
    </Show>
  );
}

export default Plugin.define({
  id: "tokens-tracker",
  setup(context) {
    const disposers = [
      context.ui.slot({
        append: "sidebar.content",
        render: (input) => <TokensSection sessionID={input.sessionID} />,
      }),
      context.ui.slot({
        append: "prompt.footer.status",
        render: (input) => <TokenFooter sessionID={input.sessionID} />,
      }),
    ];
    return () => {
      for (const dispose of disposers) dispose();
    };
  },
});
