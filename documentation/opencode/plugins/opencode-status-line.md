# Status Line (patched)

This repository vendors a **locally patched copy** of
[`rashidrazak/opencode-status-line`](https://github.com/rashidrazak/opencode-status-line),
the OpenCode v2 CLI status-line plugin. It replaces the upstream npm package
`@rashidrazak/opencode-status-line`.

The plugin has no settings for the changes below, so the source is edited in
place rather than configured.

## Layout

```text
dot_config/opencode/
├── private_cli.json               ← plugins: "./plugins/opencode-status-line"
├── opencode-status-line.json      ← grants: words, order, separator, no gauge
└── plugins/opencode-status-line/ ← the vendored, patched plugin
    ├── LICENSE
    ├── package.json
    ├── tsconfig.json
    ├── tui.tsx                     ← directory entry shim (do not delete)
    └── src/                        ← patched sources
```

Deployed to `~/.config/opencode/plugins/opencode-status-line`.

## What is patched

| Change | Detail |
| --- | --- |
| Words for every reading | `TPS`, `AVG`, `CACHE`, `CONTEXT` — upstream leaves `↯` and `✓` even in `"words"` mode |
| Context bar removed | The context segment shows only the figures |
| Speed gauge removed | Turned off with `cap.mode: "none"` (no source change) |
| Parenthesised counts | `82.4% — 63` becomes `82.4% (63)` |
| Metric unit | `tok/s` becomes `t/s` |
| Segment order | Shells, Diff, Cost, Speed, Cache, Context, Time |
| Separator | Unchanged: a tab between segments; the middle dot stays the meter's |

The line renders as (segments joined by a tab):

```text
2 shells	+42 -7	$0.75	TPS 261 · AVG 159 t/s	CACHE 99.8% (571.8k)	CONTEXT 57% (572.7k)	2h07m
```

The middle dot appears only inside the meter, between `TPS` and `AVG`. `shells`
hides itself when no command is running, so the line shifts right whenever a
shell starts or stops.

## Upstream base

- Version `1.2.0`, tag `v1.2.0` plus two commits
- Commit `dae4346dc6900e86d9c37973ae9598632e0f4dba` (`v1.2.0-2-gdae4346`)
- Vendored 2026-10-06

Only the runtime files are kept. Upstream's `test/`, `scripts/`, `.github/`,
`docs/`, `assets/`, markdown files, `bun.lock`, `.gitignore` and `.git` are
dropped, so nothing here is a nested git repository.

## Patch detail

Three files differ from upstream.

**`src/rate.ts`** — `USAGE_LABELS.words` becomes real words, and the
`UsageLabels` interface gains a `context` field:

```ts
export const USAGE_LABELS: Record<LabelStyle, UsageLabels> = {
  words: { sliding: "TPS", average: "AVG", settled: "DONE", cache: "CACHE", context: "CONTEXT" },
  icons: { sliding: "↯", average: "μ", settled: "✓", cache: "⧉", context: "" },
}
```

**`src/render.ts`** — `contextRuns` takes a `label`, no longer draws the bar,
and brackets the count; `cacheRuns` brackets its count too:

```ts
const prefix = input.label.length > 0 ? [muted(`${input.label} `)] : []
// ... { text: `${Math.round(ratio * 100)}%`, tone },
//     muted(" ("), muted(compact(used)), muted(")")
```

**`src/tui.tsx`** — passes `label: labels.context` into `contextRuns`, and
changes ` tok/s` to ` t/s` in both the meter and the `/opencode-status-line`
stats dialog.

## Configuration

`~/.config/opencode/opencode-status-line.json` (source:
`dot_config/opencode/opencode-status-line.json`):

```json
{
  "surface": "prompt.footer.status",
  "usage": {
    "segments": ["shells", "diff", "cost", "meter", "cache", "context", "time"],
    "labels": "words",
    "separator": "\t"
  },
  "cap": { "mode": "none" },
  "colors": { "enabled": true }
}
```

Only `usage.segments` and `usage.labels` changed from the previous status-line
config; `surface`, `separator` and `colors` were already set and are kept.

The plugin loads this file with `JSON.parse`, so it must stay **comment-free** —
unlike the JSONC configs beside it. A comment makes the whole file invalid and
the plugin falls back to defaults with a warning.

## Updating

Because `.git` was removed, there is nothing to `git fetch`. To move to a newer
upstream version:

1. Clone upstream at the tag you want.
2. Re-apply the three edits above.
3. Optionally run `bun test` in the fresh clone (before dropping `test/`) to
   check the edits against upstream's suite.
4. Copy the runtime files over `dot_config/opencode/plugins/opencode-status-line/`.
5. Update the **Upstream base** section of this document.
6. Run `chezmoi apply` and restart OpenCode.

## Reverting to the npm package

In `dot_config/opencode/private_cli.json`, restore
`"@rashidrazak/opencode-status-line"`, then remove the vendored plugin
directory, `opencode-status-line.json`, and this document. Run `chezmoi apply`.
