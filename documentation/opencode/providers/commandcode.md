# Command Code Provider (OpenCode)

**TODO: Document the different provider and model types.**

- Some models are available for free but without ZDR support. These
  models are defined in `.chezmoitemplates/opencode/commandcode-free-models.jsonc`.
- Since enforcing ZDR for all models [may result in higher costs](https://commandcode.ai/docs/resources/zdr#why-zdr-costs-more),
  separate providers are defined for ZDR and non-ZDR requests.
  Both provider types pull from the same `commandcode-models.jsonc`, but the default
  `commandcode` provider does not request for ZDR via the headers.
- Although the default provider may not explicitly request for ZDR, Command Code
  does guarantee that most models have [ZDR enabled by default](https://commandcode.ai/docs/resources/zdr#zdr-on-goat-and-pro/).

This document describes the custom **Command Code** (`commandcode`) provider
used by [OpenCode](https://opencode.ai/). It covers the provider block in
`dot_config/opencode/opencode.jsonc.tmpl`, the full model catalog that lives in
`.chezmoitemplates/opencode/commandcode-models.jsonc`, and how reasoning-effort
variants are derived and trimmed.

> **ZDR (Zerodebug/Routing)**: the provider sends the `x-cmd-zdr: 1` header on
> every request. See the header section below.

---

## Overview

Command Code is an **OpenAI-compatible aggregator**. From its docs: _"You get
the exact model you ask for… Nothing downgraded. Nothing rerouted."_ and _"we
don't pre-gate per model."_ It is a pass-through gateway — OpenCode talks to it
with the standard OpenAI chat-completions shape, and it forwards to the
requested model verbatim.

Consequences that matter for this config:

- **No Command Code-specific "reasoning level" abstraction.** The provider does
  not validate or coerce `reasoning_effort`; it accepts whatever value is sent.
  OpenCode therefore decides which reasoning levels to expose, which is why the
  variant handling below is so important.
- **Authentication.** The config declares **no `apiKey`** field. You authenticate
  once with OpenCode's `/connect`, which stores the credential keyed by the
  **provider id** (`commandcode`) in `~/.local/share/opencode/auth.json`.
  Because auth is keyed by provider id, **do not rename the provider id** unless
  you are willing to re-authenticate.

---

## Provider configuration

In `dot_config/opencode/opencode.jsonc.tmpl` (inside `"provider"`):

```jsonc
"commandcode": {
  "npm": "@ai-sdk/openai-compatible",
  "name": "Command Code",
  "options": {
    "baseURL": "https://api.commandcode.ai/provider/v1",
    "headers": {
      "x-cmd-zdr": "1"
    }
  },
  "models": {{- template "opencode/commandcode-models.jsonc" }}
}
```

| Key       | Value                                                                           |
| --------- | ------------------------------------------------------------------------------- |
| `npm`     | `@ai-sdk/openai-compatible` — OpenAI-compatible integration                     |
| `name`    | `Command Code` (display name)                                                   |
| `baseURL` | `https://api.commandcode.ai/provider/v1` (OpenAI-style endpoint)                |
| `headers` | `x-cmd-zdr: 1` (enables Zero-Delay Routing / ZDR)                               |
| `apiKey`  | **absent** — use `/connect` once instead                                        |
| `models`  | injected from `.chezmoitemplates/opencode/commandcode-models.jsonc` (see below) |

### ZDR header

`x-cmd-zdr: 1` opts in to Command Code's routing behavior for this provider.
Keep it present on the provider's `options.headers`; it applies to every request
made through this provider.

---

## Model catalog

The provider's `models` object is **not** written inline in
`opencode.jsonc.tmpl`. It lives in a chezmoi template partial and is injected at
render time:

```jsonc
"models": {{- template "opencode/commandcode-models.jsonc" }}
```

- **Source of truth:** `.chezmoitemplates/opencode/commandcode-models.jsonc`
- **Rendered into:** `~/.config/opencode/opencode.jsonc` (via `chezmoi apply`)
- **Size:** 68 models across the two partials, including **all 42 GOAT-plan
  models** and the **free** models (Laguna S 2.1 Free, LongCat 2.0 Free).
- **Default model:** `commandcode/deepseek/deepseek-v4-flash`, set through the
  `opencode_model` chezmoi data variable (see the main `README.md` →
  _Configuration_ table).

> The partial contains extra models beyond the GOAT plan (e.g. the `gpt-5.6-*`
> family, `gemini-*`, `claude-*`, `muse-spark-1.1`). These are kept deliberately
> so the provider is a general catalog, not a GOAT-exclusive one.

---

## Reasoning-effort variants

### Where the levels come from

Command Code is **not** a [models.dev](https://models.dev) provider, so OpenCode
cannot look up each model's supported reasoning options from models.dev. For a
custom `@ai-sdk/openai-compatible` provider, OpenCode **auto-generates** a
default variant set:

```
{ low, medium, high }        (+ "max" if the model id contains "deepseek-v4")
```

For clarity, this repo sources each model's _true_ supported effort levels from
the models.dev entries OpenCode ships for the **`opencode-go`** and
**`opencode`** (OpenCode Zen) harness providers, which expose the same models
with their real `reasoning_options`.

### How to look up a model's reasoning options

When adding or updating a model, **never conclude the reasoning levels "can't be
verified" before running the lookup below.** Every model listed on
[models.dev](https://models.dev) carries its real `reasoning_options` in the
public combined catalog, so the data is almost always available.

1. **Fetch the catalog.** Pull the public combined API snapshot and keep it
   locally:

   ```sh
   curl https://models.dev/api.json > /tmp/models.json
   ```

   (Or open the same URL with a web fetch and save the response.)

2. **Find the model's `reasoning_options`.** The JSON is one giant line, so a
   line-based search tool (`rg` / the ripgrep-based search) fails with
   `Ripgrep JSON record exceeded 65536 bytes`. Use **GNU grep** with a bounded
   window instead:

   ```sh
   grep -oE '"<model-id>":\{.{0,500}' /tmp/models.json
   ```

   Example that works:

   ```sh
   grep -oE '"qwen3.8-flash":\{.{0,500}' /tmp/models.json
   ```

   (Note the window `.{0,500}` — ripgrep will not do this; GNU grep will.)

3. **Read the `reasoning_options` array:**
   - An `effort` entry lists the model's real effort levels in its `values`
     array, e.g. `"values":["low","medium","xhigh"]` → variants
     `low`/`medium`/`xhigh`. Translate each into a flat
     `"<name>": { "reasoningEffort": "<name>" }` variant and add
     `"disabled": true` for every auto-generated level **outside** that set.
   - A bare `toggle` entry (no `effort` values) means there is **no**
     low/medium/high picker → set all of `low`/`medium`/`high` to
     `"disabled": true` (the "no effort toggles" case below).
   - Values like `"none"` are not real effort toggles — only the meaningful
     levels (e.g. `low`, `high`, `max`) become variants.

4. **Confirm attachment/multimodality** from the same entry (`attachment: true`)
   and mirror the closest sibling's structure in the catalog when the exact
   config shape is ambiguous.

### How OpenCode merges variants

Two rules from OpenCode's source determine the final toggles:

1. **Union, not replace.** OpenCode `mergeDeep`s your configured variants **on
   top of** the auto-generated set. It does not overwrite the auto set.
2. **`disabled: true` removes.** The _only_ way to drop an auto-generated
   variant is to add `"<name>": { "disabled": true }`. After merging, OpenCode
   drops disabled variants and strips the `disabled` key before the value is
   sent to the provider (so the flag never leaks upstream).
3. **Flat shape.** Variants use flat keys — `"high": { "reasoningEffort": "high" }`
   — **not** a `{ "options": { ... } }` wrapper.

### Strategy per model

| Model family                              | What we set                                                                        | Why                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------- |
| Clear effort set                          | exact variants, plus `disabled: true` on auto variants outside the set             | match models.dev exactly                |
| No effort levels (`opts = []` / `toggle`) | `reasoning: true` only, with **all** of `low`/`medium`/`high` set `disabled: true` | no effort toggles, matching the harness |
| Unclear / conflicting per models.dev      | keep current variants, do **not** guess                                            | defer to OpenCode's defaults            |

### Resulting toggles

Active reasoning-effort toggles (after `disabled` trimming) by model:

| Model                                                                                  | Active variants                                           |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `deepseek/deepseek-v4-flash`                                                           | `low`, `high`, `max`                                      |
| `deepseek/deepseek-v4-flash-vision-exp`                                                | `low`, `high`, `max`                                      |
| `deepseek/deepseek-v4-flash-fast`                                                      | `low`, `high`, `max`                                      |
| `deepseek/deepseek-v4-pro`                                                             | `high`, `max`                                             |
| `zai-org/GLM-5`, `GLM-5.1`                                                             | _(no effort toggles)_                                     |
| `zai-org/GLM-5.2`                                                                      | `high`, `max`                                             |
| `zai-org/GLM-5.2-Fast`                                                                 | _(current, deferred)_                                     |
| `zai-org/GLM-5.3`                                                                      | `low`, `high`, `max`                                      |
| `zai-org/GLM-5.3-Flash`                                                                | `low`, `high`, `max`                                      |
| `nvidia/nemotron-3-ultra-550b-a55b`                                                    | `medium`, `high`                                          |
| `sakana/fugu-ultra`                                                                    | `high`, `xhigh`                                           |
| `stepfun/Step-3.5-Flash`                                                               | `low`, `high`                                             |
| `stepfun/Step-3.7-Flash`                                                               | `low`, `medium`, `high`                                   |
| `tencent/hy3-paid`                                                                     | `low`, `high`                                             |
| `tencent/hy4-preview`                                                                  | `high`                                                    |
| `google/gemini-3.8-flash`                                                              | _(no effort toggles)_                                     |
| `Qwen/Qwen3.7-Flash`                                                                   | `high`                                                    |
| `Qwen/Qwen3.8-27B`                                                                     | _(current, deferred)_                                     |
| `Qwen/Qwen3.8-Flash`                                                                   | `low`, `medium`, `xhigh`                                  |
| `Qwen/Qwen3.7-Max`, `3.7-Plus`, `3.6-Plus`, `3.8-Max`                                  | _(no effort toggles)_                                     |
| `Qwen/Qwen3.8-Max-0902`                                                                | `low`, `medium`, `high`, `max`                            |
| `xiaomi/mimo-v2.5`, `v2.5-pro`                                                         | _(no effort toggles)_                                     |
| `MiniMaxAI/MiniMax-M2.5`, `M2.7`                                                       | _(no effort toggles)_                                     |
| `moonshotai/Kimi-K2.5`, `K2.6`, `K2.7-Code`, `K2.7-Code-Highspeed`                     | _(no effort toggles)_                                     |
| `meituan/longcat-2.0:free`                                                             | _(no effort toggles)_                                     |
| all other models (`gpt-5.6-*`, `gpt-6-astra`, `gemini-*`, `claude-*`, `grok-*`, `muse-spark-*`, etc.) | full set as configured (auto subset is already supported) |

_(No effort toggles)_ means reasoning is enabled but the TUI shows no
low/medium/high/max picker — matching the model's real capabilities.

---

## Editing workflow

Per `AGENTS.md` — **never edit the deployed file**
`~/.config/opencode/opencode.jsonc` directly; it is generated and will be
overwritten on the next `chezmoi apply`.

- Provider block: edit `dot_config/opencode/opencode.jsonc.tmpl`.
- Model catalog / variants: edit `.chezmoitemplates/opencode/commandcode-models.jsonc`.
- Render preview: `chezmoi cat ~/.config/opencode/opencode.jsonc`.
- Apply: `chezmoi apply`.
- Inspect: `chezmoi diff` / `chezmoi status`.
