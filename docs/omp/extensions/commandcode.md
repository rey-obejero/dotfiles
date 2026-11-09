# OMP extension: commandcode

`/cmdc` — one command covering Command Code session state (zero-data-retention
headers) and account usage for the current billing period.

## Files

| Target | Source |
| --- | --- |
| `~/.omp/agent/extensions/commandcode.ts` | `dot_omp/private_agent/private_extensions/commandcode.ts` |

## State model

ZDR state is per session and lives in memory only. A new session is seeded from
the environment: `CMD_ZDR=1` starts it enabled, anything else (including unset)
starts it disabled. `CMD_ZDR` is read at session start, not set by this
extension or any file this repo manages. Changes made with `/cmdc zdr on` /
`off` apply to the current session only and are never written to disk; subagent
requests inherit the root session's choice.

## Header injection

The header is injected at the `fetch` layer, so it covers every request the
process makes to `api.commandcode.ai` — subagents, title generation,
compaction, cache warming, usage probes — not just the active chat model.

A model with no ZDR-capable upstream fails with HTTP 422
(`cmd_zdr_no_providers`) rather than falling back, and routing may change cost.

## Commands

### `/cmdc`

Prints the subcommand list. No network call.

### `/cmdc zdr [on|off|status]`

With no argument or `status`, reports the current session's state. `on` and
`off` set it for this session only. Every other argument — including `toggle`,
which the previous `/commandcode-zdr` command accepted — prints the usage line.
There is no keyboard shortcut.

### `/cmdc usage`

Fullscreen panel showing, top to bottom:

| Row group | Meaning |
| --- | --- |
| 5h / 7d | Five-hour and weekly credit windows from `windowLimits` |
| month | Derived: `billed ÷ (billed + remaining)`, matching Studio's Usage page |
| bal | Credit balance split by monthly / purchased / free |
| period | Subscription window and days remaining |
| requests / tokens / spend / basis | Billing-period totals from `usage/summary` |

Rows whose source data is absent are omitted, not shown as zero — pay-as-you-go
accounts see no 5h/7d rows at all, and a failed endpoint contributes a line like
`credits  unavailable (key rejected (HTTP 401))` instead of zeroing the bars.

`quota` is accepted as an alias for `usage`. The snapshot is memoized for 30
seconds, so `/cmdc usage` immediately after `/cmdc quota` costs one round trip;
`r` refetches in place and re-baselines the `checked … ago` header.

`Esc`, `q`, or `Enter` closes. Fullscreen on the alternate screen; the
transcript underneath is untouched and not scrollable while the panel is open.

## API access

Reads four endpoints with the stored Command Code key. `whoami` runs first
because its `org.id` scopes the two billing reads; `credits`,
`subscriptions`, and `usage/summary` then run in parallel.

Credential resolution, in order:

1. omp's stored key for the `commandcode` provider (`/login`)
2. `COMMAND_CODE_API_KEY`
3. `COMMANDCODE_API_KEY`
4. `~/.commandcode/auth.json` (`apiKey` field)

If none resolve, the command reports the miss instead of prompting. Timeout is
20 seconds per request; other failures surface in the panel rather than as
crashes.

The base URL is fixed to `https://api.commandcode.ai`. Account routes live at
the host root, so a `models.yml` inference `baseUrl` override must not be
forwarded to them.

## Related files

`dsh-statusline.ts` shows this session's token and cost statistics from the
session manager; it does not read the account data this extension drafts from
the Command Code API. For per-session totals use that widget's numbers; for
account-wide billing use `/cmdc usage`.
