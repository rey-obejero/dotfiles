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
├── opencode-status-line.json      ← config: words, order, separator, no gauge
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
| Lowercase words | `avg`, `cache`, `ctx` for the labelled figures; the sliding reading carries no label |
| Context bar removed | The context segment shows only the figures |
| Speed gauge removed | Turned off with `cap.mode: "none"` (no source change) |
| Counts after a space | `82.4% (63)` becomes `82% 63` — whole-number percent, no parentheses |
| Metric unit | `t/s` becomes `tok/s` |
| Compact counts | `572.7k` becomes `573k` — whole thousands |
| Duration | `57m00s` becomes `57m` — minutes drop the seconds field |
| Minus sign | Deletions draw `−` (U+2212), not a hyphen |
| Segment order | Shells, Diff, Cost, Cache, Speed, Time, Context |
| Separator | Middle dot (` · `) between segments |

The line renders as:

```text
1 shell · +6 −1 · $0.18 · cache 99% 223k · 158 tok/s · avg 88 tok/s · 57m · ctx 26% 262k
```

The meter and the segments share the same middle dot, so the line reads as one
row of dots. `shells` hides itself when no command is running, so the line
shifts right whenever a shell starts or stops.

## Upstream base

- Version `1.2.0`, tag `v1.2.0` plus two commits
- Commit `dae4346dc6900e86d9c37973ae9598632e0f4dba` (`v1.2.0-2-gdae4346`)
- Vendored 2026-10-06

Only the runtime files are kept. Upstream's `test/`, `scripts/`, `.github/`,
`docs/`, `assets/`, markdown files, `bun.lock`, `.gitignore` and `.git` are
dropped, so nothing here is a nested git repository.

## Patch detail

The runtime sources differ from upstream in several files.

**`src/rate.ts`** — `USAGE_LABELS.words` becomes lowercase words, the sliding
reading loses its label, and the `UsageLabels` interface gains a `context`
field. `formatRate` drops its three-character space padding, so a two-digit
figure no longer pushes a second space after its label:

```ts
export const USAGE_LABELS: Record<LabelStyle, UsageLabels> = {
  words: { sliding: "", average: "avg", settled: "done", cache: "cache", context: "ctx" },
  icons: { sliding: "↯", average: "μ", settled: "✓", cache: "⧉", context: "" },
}
```

**`src/render.ts`** — `contextRuns` takes a `label`, no longer draws the bar,
and puts the count after a space; `cacheRuns` does the same, and its percent is
a whole number:

```ts
const prefix = input.label.length > 0 ? [muted(`${input.label} `)] : []
// ... { text: `${Math.round(ratio * 100)}%`, tone },
//     muted(" "), muted(compact(used))
```

**`src/format.ts`** — `compact` reports whole thousands (`223k`), and `duration`
drops the seconds field once there are minutes (`57m`, `2h07m`).

**`src/diff.ts`** — `diffParts` draws the deleted count with a minus sign
(`−3`, U+2212) rather than a hyphen.

**`src/tui.tsx`** — passes `label: labels.context` into `contextRuns`, builds
each meter reading as `<label><figure> tok/s` (the label plus a space only when
it has one), and changes ` t/s` to ` tok/s` in both the meter and the
`/opencode-status-line` stats dialog.

## Configuration

`~/.config/opencode/opencode-status-line.json` (source:
`dot_config/opencode/opencode-status-line.json`):

```json
{
  "surface": "prompt.footer.status",
  "usage": {
    "segments": ["shells", "diff", "cost", "cache", "meter", "time", "context"],
    "labels": "words",
    "separator": " · "
  },
  "cap": { "mode": "none" },
  "colors": { "enabled": true }
}
```

`usage.segments`, `usage.labels` and `usage.separator` changed from the
previous status-line config; `surface`, `cap.mode` and `colors` were already
set and are kept.

The line shares its row with OpenCode's own footer text, so the width it gets
depends on how long the current path is. If the last segment ever looks cut
off, move the line to its own full-width row with `"surface": "app"`.

The plugin loads this file with `JSON.parse`, so it must stay **comment-free** —
unlike the JSONC configs beside it. A comment makes the whole file invalid and
the plugin falls back to defaults with a warning.

## Updating

Because `.git` was removed, there is nothing to `git fetch`. To move to a newer
upstream version:

1. Clone upstream at the tag you want.
2. Re-apply the edits above.
3. Optionally run `bun test` in the fresh clone (before dropping `test/`) to
   check the edits against upstream's suite.
4. Copy the runtime files over `dot_config/opencode/plugins/opencode-status-line/`.
5. Update the **Upstream base** section of this document.
6. Run `chezmoi apply` and restart OpenCode.

## Reverting to the npm package

In `dot_config/opencode/private_cli.json`, restore
`"@rashidrazak/opencode-status-line"`, then remove the vendored plugin
directory, `opencode-status-line.json`, and this document. Run `chezmoi apply`.
