# Command Code Provider (OpenCode V2)

This document describes the custom **Command Code** providers used by
[OpenCode V2](https://opencode.ai/) in
`dot_config/opencode/opencode.jsonc.tmpl`, and the model catalog that lives in
`.chezmoitemplates/opencode/commandcode-models.jsonc` and
`.chezmoitemplates/opencode/commandcode-free-models.jsonc`.

> **V2 migration note.** OpenCode V2 uses a different config schema than V1
> (`providers` not `provider`, `agents` not `agent`, `permissions` as an ordered
> array, `snapshots`, `plugins`, `mcp.servers`, `update`, etc.). The provider
> block and model entries below are written for V2.

---

## Overview

Command Code is an **OpenAI-compatible aggregator**. OpenCode talks to it with
the standard OpenAI chat-completions shape, and it forwards to the requested
model verbatim.

Consequences that matter for this config:

- **No Command Code-specific "reasoning level" abstraction.** The provider does
  not validate or coerce `reasoning_effort`; OpenCode decides which levels to
  expose, which is why reasoning-effort variants are curated per model (below).
- **Authentication.** The config declares **no `apiKey`**. Authenticate once with
  `/connect`, which stores the credential keyed by the **provider id** in
  OpenCode's SQLite database (`~/.local/share/opencode/opencode.db`). V2 imports
  a legacy `auth.json` on first run. Because auth is keyed by provider id,
  **do not rename a provider id** unless you are willing to re-authenticate.
- **Three providers** share one model catalog:
  - `command-code` — sends `x-cmd-zdr: 1` (Zero-Downtime Routing / ZDR).
  - `command-code-non-zdr` — no ZDR header.
  - `command-code-free` — free models only (`commandcode-free-models.jsonc`).

Enforcing ZDR for all models [may cost more](https://commandcode.ai/docs/resources/zdr#why-zdr-costs-more),
hence the separate providers. Command Code still guarantees most models have
[ZDR enabled by default](https://commandcode.ai/docs/resources/zdr#zdr-on-goat-and-pro/).

---

## Provider configuration

In `dot_config/opencode/opencode.jsonc.tmpl` (inside `"providers"`):

```jsonc
"command-code": {
  "name": "Command Code",
  "package": "@opencode/ai/providers/openai-compatible",
  "settings": {
    "baseURL": "https://api.commandcode.ai/provider/v1",
  },
  "headers": {
    "x-cmd-zdr": "1",
  },
  {{ template "opencode/commandcode-models.jsonc" }}
}
```

| Key        | Value                                                                    |
| ---------- | ------------------------------------------------------------------------ |
| `package`  | `@opencode/ai/providers/openai-compatible` — OpenAI-compatible runtime    |
| `name`     | Display name                                                             |
| `settings` | `baseURL` = `https://api.commandcode.ai/provider/v1`                     |
| `headers`  | `x-cmd-zdr: 1` on `command-code` only                                    |
| `apiKey`   | **absent** — use `/connect` once instead                                 |
| `models`   | injected from the `.chezmoitemplates` partial (see below)                |

The `command-code-non-zdr` and `command-code-free` providers are identical
except for the missing ZDR header and the free-model catalog.

---

## Model catalog

The catalog is **not** written inline. It lives in chezmoi template partials and
is injected at render time:

```jsonc
"models": {{- template "opencode/commandcode-models.jsonc" }}
```

- **Source of truth:** `.chezmoitemplates/opencode/commandcode-models.jsonc`
  (79 models) and `.chezmoitemplates/opencode/commandcode-free-models.jsonc`
  (free models).
- **Rendered into:** `~/.config/opencode/opencode.jsonc` (via `chezmoi apply`).
- **Default model:** set through the `opencode_model` chezmoi data variable
  (`command-code/deepseek/deepseek-v4.1-flash`).

### V2 model entry shape

Each model is a key in the provider's `models` map. The **key is the selectable
id** (Command Code's upstream id); `modelID` would override the id sent to the
provider and is not used here. Fields:

```jsonc
"deepseek/deepseek-v4.1-flash": {
  "name": "DeepSeek V4.1 Flash",
  "cost": { "input": 0.15, "output": 0.6, "cache": { "read": 0.003 } },
  "limit": { "context": 1000000, "output": 384000 },
  "capabilities": { "tools": true, "input": ["text", "image"], "output": ["text"] },
  "variants": [
    { "id": "low", "settings": { "reasoningEffort": "low" } },
    { "id": "high", "settings": { "reasoningEffort": "high" } },
    { "id": "max", "settings": { "reasoningEffort": "max" } }
  ]
}
```

| Field          | Notes                                                                 |
| -------------- | --------------------------------------------------------------------- |
| `name`         | Display name (from models.dev).                                        |
| `cost`         | USD per million tokens: `input`, `output`, optional `cache.read`/`cache.write`. |
| `limit`        | `context` and `output` token limits.                                   |
| `capabilities` | `tools` (boolean) and accepted `input`/`output` media types.           |
| `variants`     | Array of named reasoning-effort variants. Omitted when the model has no effort levels. |

---

## Data source: models.dev

All metadata (cost, limits, capabilities, names, and reasoning levels) is
sourced from [models.dev](https://models.dev). Nothing is cross-checked against
Command Code's API, and reasoning levels are no longer hand-curated.

### Reasoning-effort policy

models.dev lists the same model under many providers, each with its own
`reasoning_options`. Those sets vary and naive aggregation is too broad (e.g.
DeepSeek V4.1 Flash would gain `minimal`/`medium` it does not really use). The
generator resolves a **standard** set per model:

1. If the model's **first-party ("lab") provider** has an entry, use its effort
   values. Example: `zhipuai` reports GLM-5 as toggle-only → no variants;
   `anthropic` reports Claude Haiku 4.5 as `budget_tokens` → no variants.
2. Otherwise, fall back to the **most common** effort set across providers.
3. Drop `none` (it means "no reasoning", not a level).

This matches the prior hand-curated levels for nearly every model (DeepSeek V4.1
Flash → `low`/`high`/`max`, GLM-5.2 → `high`/`max`, and so on).

### Regenerate the catalog

The generator is `documentation/opencode/providers/generate-commandcode-models.mjs`:

```sh
cd documentation/opencode/providers
node generate-commandcode-models.mjs           # dry run: prints a match/levels report
node generate-commandcode-models.mjs --write   # rewrites both .chezmoitemplates partials
```

It downloads `https://models.dev/api.json` (cached to the OS temp dir; override
with `MODELS_JSON=/path/to/api.json`), matches each existing Command Code key to
a models.dev model, and writes the V2-shaped entries. The report shows the match
quality, chosen provider, levels, and names so you can review before `--write`.

After writing, render and apply:

```sh
chezmoi cat ~/.config/opencode/opencode.jsonc   # preview
chezmoi apply
```

### Known approximations

- **Prices are models.dev's, not Command Code's.** Different providers list
  different prices; the generator prefers the lab provider, then
  `opencode-go`/`opencode`/`openrouter`/`vercel`. Actual Command Code billing is
  on the [Usage](https://commandcode.ai/usage) page and may differ.
- **Fuzzy matches.** Two keys have no exact models.dev equivalent and use the
  closest model: `deepseek/deepseek-v4-flash-fast` → `deepseek-v4-flash`, and
  `tencent/hy3-paid` → `hy3`. Revisit these if Command Code exposes distinct
  entries.
- **Free models are zeroed.** Entries in `commandcode-free-models.jsonc` are
  forced to zero cost regardless of models.dev pricing.

---

## Editing workflow

Per `AGENTS.md` — **never edit the deployed file**
`~/.config/opencode/opencode.jsonc` directly; it is generated and will be
overwritten on the next `chezmoi apply`.

- Provider block: edit `dot_config/opencode/opencode.jsonc.tmpl`.
- Model catalog: edit the `.chezmoitemplates/opencode/*.jsonc` partials, or
  regenerate them from models.dev with the script above.
- Render preview: `chezmoi cat ~/.config/opencode/opencode.jsonc`.
- Apply: `chezmoi apply`.
- Inspect: `chezmoi diff` / `chezmoi status`; validate with
  `opencode debug config`.
