/**
 * Command Code: ZDR, quota and usage
 *
 * Command Code's Provider API enforces zero data retention per request with
 * `x-cmd-zdr: 1`. The header is injected at the `fetch` layer so it also
 * covers subagents, title generation, compaction, cache warming, and usage
 * probes, not just the active chat model.
 *
 * ZDR state is per session: `CMD_ZDR=1` seeds a new session as enabled and an
 * unset/`0` value seeds it disabled. A `/cmdc zdr` change overrides that choice
 * for the current session only; nothing is written to disk. Subagent requests
 * inherit the root session's choice.
 *
 * ZDR is not free: a model with no ZDR-capable upstream fails with HTTP 422
 * (`cmd_zdr_no_providers`) rather than falling back, and routing may change
 * cost.
 *
 * `/cmdc` is the single Command Code command:
 *
 *   /cmdc                 subcommand list, no network
 *   /cmdc zdr [on|off]    this session's ZDR status, or an explicit change
 *   /cmdc usage           fullscreen account view: 5-hour, weekly and monthly
 *                         limits, balance and period, then the billing period's
 *                         requests, tokens and spend
 *
 * `usage` reads the account's `/alpha/*` routes with the stored Command Code
 * key and reports the account's billing period, not this session's tokens.
 */
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { OverlayPanel, PanelDivider, PanelRows } from "@oh-my-pi/pi-tui/chrome/overlay-box";

const HEADER = "x-cmd-zdr";
const HOST = "commandcode.ai";
const WRAPPER = Symbol.for("omp.commandcode-zdr.fetch");

const API_ORIGIN = "https://api.commandcode.ai";
const FETCH_TIMEOUT_MS = 20_000;
const MEMO_MS = 30_000;
const SEP = " · ";
const NUMBER = new Intl.NumberFormat("en-US");
const SHORT_DATE = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

interface ZdrState {
	enabled: boolean;
	source: "env" | "command";
}

const bySession = new Map<string, ZdrState>();
const sessionByAgent = new Map<string, string>();
const parentByAgent = new Map<string, string | undefined>();
let activeSessionId: string | undefined;

function stateFor(sessionId: string): ZdrState {
	let state = bySession.get(sessionId);
	if (!state) {
		state = { enabled: process.env.CMD_ZDR === "1", source: "env" };
		bySession.set(sessionId, state);
	}
	return state;
}

function rootSessionId(ctx: ExtensionContext): string {
	const own = ctx.sessionManager.getSessionId();
	sessionByAgent.set(ctx.agent.id, own);
	parentByAgent.set(ctx.agent.id, ctx.agent.parentId);

	let sessionId = own;
	let agentId = ctx.agent.id;
	const seen = new Set<string>();
	while (true) {
		const parent = parentByAgent.get(agentId);
		if (!parent || seen.has(parent)) break;
		seen.add(parent);
		const parentSession = sessionByAgent.get(parent);
		if (!parentSession) break;
		sessionId = parentSession;
		agentId = parent;
	}
	return sessionId;
}

function activate(ctx: ExtensionContext): ZdrState {
	activeSessionId = rootSessionId(ctx);
	return stateFor(activeSessionId);
}

function describe(state: ZdrState): string {
	const origin =
		state.source === "env" ? `seeded by CMD_ZDR=${process.env.CMD_ZDR ?? "unset"}` : "set in this session";
	return `ZDR ${state.enabled ? "ON" : "OFF"} (${origin}).`;
}

function installFetchWrapper(): void {
	const root = globalThis as typeof globalThis & { [WRAPPER]?: true };
	if (root[WRAPPER]) return;

	const original = globalThis.fetch;
	const wrapper = ((input: RequestInfo | URL, init?: RequestInit) => {
		const state = activeSessionId ? bySession.get(activeSessionId) : undefined;
		const enabled = state ? state.enabled : process.env.CMD_ZDR === "1";
		if (!enabled) return original(input, init);

		const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
		if (!url.includes(HOST)) return original(input, init);

		const baseHeaders = init?.headers ?? (input instanceof Request ? input.headers : undefined);
		const headers = new Headers(baseHeaders);
		headers.set(HEADER, "1");
		return original(input, { ...(init ?? {}), headers });
	}) as typeof fetch;

	(wrapper as unknown as Record<symbol, unknown>)[WRAPPER] = true;
	globalThis.fetch = wrapper;
}

// ─── HTTP ───────────────────────────────────────────────────────────────────

type ApiResult<T> = { ok: true; body: T } | { ok: false; status?: number; error: string };

async function apiGet<T>(key: string, path: string): Promise<ApiResult<T>> {
	try {
		const response = await fetch(`${API_ORIGIN}${path}`, {
			headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (!response.ok) {
			return {
				ok: false,
				status: response.status,
				error:
					response.status === 401 || response.status === 403
						? `key rejected (HTTP ${response.status})`
						: `HTTP ${response.status}`,
			};
		}
		return { ok: true, body: (await response.json()) as T };
	} catch (error) {
		if (error instanceof Error && error.name === "TimeoutError") {
			return { ok: false, error: "timeout after 20s" };
		}
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

function settled<T>(result: PromiseSettledResult<ApiResult<T>>): ApiResult<T> {
	return result.status === "fulfilled" ? result.value : { ok: false, error: String(result.reason) };
}

/**
 * The stored omp credential is the normal source. The environment and the
 * Command Code CLI's own `auth.json` are fallbacks for setups that never ran
 * `/login`.
 */
async function resolveApiKey(ctx: ExtensionContext): Promise<string | undefined> {
	try {
		const stored = await ctx.modelRegistry.authStorage.keys.get("commandcode");
		if (stored) return stored;
	} catch {
		// Fall through to the environment and the CLI's credential file.
	}
	const fromEnv = process.env.COMMAND_CODE_API_KEY ?? process.env.COMMANDCODE_API_KEY;
	if (fromEnv) return fromEnv;
	try {
		const parsed = JSON.parse(readFileSync(join(homedir(), ".commandcode/auth.json"), "utf8")) as {
			apiKey?: unknown;
		};
		if (typeof parsed.apiKey === "string" && parsed.apiKey) return parsed.apiKey;
	} catch {
		// No CLI credential file; the caller reports the miss.
	}
	return undefined;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

interface WindowLimit {
	used?: number;
	cap?: number;
	resetAt?: number;
	exceeded?: boolean;
}

interface Dashboard {
	fetchedAt: number;
	whoami?: { id?: string; email?: string; orgId?: string };
	credits?: {
		monthly?: number;
		purchased?: number;
		free?: number;
		planId?: string;
		fiveHour?: WindowLimit;
		weekly?: WindowLimit;
	};
	subscription?: {
		planId?: string;
		status?: string;
		periodStart?: number;
		periodEnd?: number;
		cancelAtPeriodEnd?: boolean;
	};
	usage?: {
		totalCount?: number;
		completedCount?: number;
		failedCount?: number;
		successRate?: number;
		tokensIn?: number;
		tokensOut?: number;
		credits?: number;
		averageCost?: number;
		periodBasis?: string;
	};
	errors: { endpoint: "whoami" | "credits" | "subscriptions" | "usage"; message: string }[];
}

let memo: { at: number; key: string; data: Dashboard } | undefined;

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** Bodies arrive either bare or wrapped in `{ data: … }`. */
function payload(body: unknown): Record<string, unknown> {
	const record = asRecord(body);
	return record.data !== undefined && record.data !== null ? asRecord(record.data) : record;
}

function num(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Window timestamps are epoch milliseconds, but ISO strings are accepted too. */
function epoch(value: unknown): number | undefined {
	const parsed =
		typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : Number.NaN;
	return Number.isFinite(parsed) ? parsed : undefined;
}

function str(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function windowOf(value: unknown): WindowLimit | undefined {
	if (typeof value !== "object" || value === null) return undefined;
	const record = asRecord(value);
	const used = num(record.used);
	const cap = num(record.cap);
	if (used === undefined && cap === undefined) return undefined;
	return { used, cap, resetAt: epoch(record.resetAt), exceeded: record.exceeded === true };
}

async function loadDashboard(ctx: ExtensionContext): Promise<Dashboard | undefined> {
	const key = await resolveApiKey(ctx);
	if (key === undefined) {
		ctx.ui.notify(
			"No Command Code API key. Run /login for the Command Code provider or set COMMAND_CODE_API_KEY.",
			"error",
		);
		return undefined;
	}
	if (memo !== undefined && memo.key === key && Date.now() - memo.at < MEMO_MS) return memo.data;

	const errors: Dashboard["errors"] = [];
	const dashboard: Dashboard = { fetchedAt: Date.now(), errors };

	// whoami first: its `org.id` scopes the two billing reads.
	const whoami = await apiGet<unknown>(key, "/alpha/whoami");
	let orgId: string | undefined;
	if (whoami.ok) {
		const body = payload(whoami.body);
		const user = asRecord(body.user);
		const org = asRecord(body.org);
		orgId = str(org.id);
		dashboard.whoami = { id: str(user.id), email: str(user.email), orgId };
	} else {
		errors.push({ endpoint: "whoami", message: whoami.error });
	}

	const query = orgId === undefined ? "" : `?orgId=${encodeURIComponent(orgId)}`;
	const [creditsResult, subscriptionResult, usageResult] = await Promise.allSettled([
		apiGet<unknown>(key, `/alpha/billing/credits${query}`),
		apiGet<unknown>(key, `/alpha/billing/subscriptions${query}`),
		apiGet<unknown>(key, "/alpha/usage/summary"),
	]);

	const credits = settled(creditsResult);
	if (credits.ok) {
		const body = payload(credits.body);
		const pool = asRecord(body.credits);
		const limits = asRecord(body.windowLimits);
		dashboard.credits = {
			monthly: num(pool.monthlyCredits),
			purchased: num(pool.purchasedCredits),
			free: num(pool.freeCredits),
			planId: str(pool.planId),
			fiveHour: windowOf(limits.fiveHour),
			weekly: windowOf(limits.weekly),
		};
	} else {
		errors.push({ endpoint: "credits", message: credits.error });
	}

	const subscription = settled(subscriptionResult);
	if (subscription.ok) {
		const body = payload(subscription.body);
		dashboard.subscription = {
			planId: str(body.planId),
			status: str(body.status),
			periodStart: epoch(body.currentPeriodStart),
			periodEnd: epoch(body.currentPeriodEnd),
			cancelAtPeriodEnd: body.cancelAtPeriodEnd === true,
		};
	} else {
		errors.push({ endpoint: "subscriptions", message: subscription.error });
	}

	const usage = settled(usageResult);
	if (usage.ok) {
		const body = payload(usage.body);
		dashboard.usage = {
			totalCount: num(body.totalCount),
			completedCount: num(body.completedCount),
			failedCount: num(body.failedCount),
			successRate: num(body.successRate),
			tokensIn: num(body.totalTokensIn),
			tokensOut: num(body.totalTokensOut),
			credits: num(body.totalCredits),
			averageCost: num(body.averageCost),
			periodBasis: str(body.periodBasis),
		};
	} else {
		errors.push({ endpoint: "usage", message: usage.error });
	}

	memo = { at: Date.now(), key, data: dashboard };
	return dashboard;
}

// ─── Rendering ──────────────────────────────────────────────────────────────

/** The slice of `Theme` the rendering helpers need; the `custom` factory passes its `theme` in. */
type Style = { fg(color: "muted" | "success" | "warning" | "error", text: string): string };

const PLAIN_STYLE: Style = { fg: (_color, text) => text };

const PLAN_LABELS: readonly (readonly [string, string])[] = [
	["individual-provider", "Provider"],
	["individual-pro-v1", "Pro"],
	["individual-goat", "GOAT"],
	["individual-go", "Go"],
	["individual-ultra", "Ultra"],
	["individual-max", "Max"],
	["individual-pro", "Pro"],
	["teams-pro", "Teams Pro"],
];

/** Longest matching prefix wins; an unrecognised id prints raw. */
function planLabel(planId: string | undefined): string | undefined {
	if (!planId) return undefined;
	const normalized = planId.toLowerCase().replaceAll("_", "-");
	const match = PLAN_LABELS.find(([prefix]) => normalized.startsWith(prefix));
	return match ? match[1] : planId;
}

function bar(ratio: number | undefined, style: Style): string {
	if (ratio === undefined) return style.fg("muted", "░".repeat(10));
	const bounded = Math.min(1, Math.max(0, ratio));
	const filled = Math.round(bounded * 10);
	const tone = bounded >= 0.9 ? "error" : bounded >= 0.75 ? "warning" : "success";
	return style.fg(tone, "█".repeat(filled)) + style.fg("muted", "░".repeat(10 - filled));
}

/** Same ladder as `dsh-statusline.ts`'s `formatTokens`; duplicated deliberately. */
function tokens(value: number | undefined): string {
	if (value === undefined) return "—";
	const rounded = Math.max(0, Math.round(value));
	if (rounded < 1000) return String(rounded);
	if (rounded < 10_000) return `${(rounded / 1000).toFixed(1)}k`;
	if (rounded < 1_000_000) return `${Math.round(rounded / 1000)}k`;
	if (rounded < 10_000_000) return `${(rounded / 1_000_000).toFixed(1)}M`;
	return `${Math.round(rounded / 1_000_000)}M`;
}

function until(ts: number | undefined): string {
	if (ts === undefined) return "no reset time";
	const minutes = Math.floor((ts - Date.now()) / 60_000);
	if (!Number.isFinite(minutes) || minutes < 1) return "<1m";
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return minutes % 60 > 0 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
	const days = Math.floor(hours / 24);
	return hours % 24 > 0 ? `${days}d ${hours % 24}h` : `${days}d`;
}

/** `YYYY-MM-DD HH:MM` in the local zone, independent of locale. */
function stamp(ts: number): string {
	const date = new Date(ts);
	const pad = (value: number): string => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function row(label: string, barText: string, detail: string, style: Style): string {
	return `${style.fg("muted", label.padEnd(8))}${barText}  ${detail}`;
}

/**
 * Fullscreen `usage` dashboard idiom: the overlay borrows the alternate screen
 * (`fullscreen: true`), so the transcript is untouched and not scrollable
 * behind it. The viewport is `tui.terminal.rows`, not the factory's width
 * argument — a fullscreen component covers the whole pane.
 *
 * Rows longer than the pane are dropped by `PanelRows` itself, so the merged
 * account view stays aligned instead of wrapping.
 */
async function fullscreenAccountView(
	ctx: ExtensionContext,
	title: string,
	build: (style: Style) => string[],
): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify([title, ...build(PLAIN_STYLE)].join("\n"), "info");
		return;
	}
	await ctx.ui.custom<void>(
		(tui, theme, keybindings, done) => {
			const rows = Math.max(6, tui.terminal.rows - 4);
			const source: string[] = [...build(theme)];
			const viewport: string[] = [];
			let scroll = 0;

			const panel = new OverlayPanel(title);
			const body = new PanelRows();
			const footer = new PanelRows();
			footer.setHeight(1);
			panel.addChild(body);
			panel.addChild(new PanelDivider());
			panel.addChild(footer);
			footer.setLines([theme.fg("muted", "r refetch · ↑/↓/pgup/pgdn scroll · esc / q close")]);

			const refresh = (): void => {
				viewport.length = 0;
				for (let index = scroll; index < Math.min(source.length, scroll + rows); index++) {
					viewport.push(source[index] ?? "");
				}
				body.setLines(viewport);
			};
			refresh();

			return {
				render: (width: number) => panel.render(width),
				invalidate: () => panel.invalidate(),
				handleInput: (data: string) => {
					const before = scroll;
					if (keybindings.matches(data, "tui.select.cancel") || data === "q" || data === "\r" || data === "\n") {
						done(undefined);
						return;
					}
					if (data === "r") {
						// Refetch rebuilds the rows in place; the dashboard memo
						// means a burst of r presses costs one round trip at most.
						void (async () => {
							const fresh = await loadDashboard(ctx);
							if (fresh === undefined) return;
							source.length = 0;
							source.push(...build(theme));
							scroll = Math.max(0, Math.min(scroll, Math.max(0, source.length - rows)));
							refresh();
						})();
						return;
					}
					if (keybindings.matches(data, "tui.select.up")) scroll -= 1;
					else if (keybindings.matches(data, "tui.select.down")) scroll += 1;
					else if (keybindings.matches(data, "tui.select.pageUp")) scroll -= rows;
					else if (keybindings.matches(data, "tui.select.pageDown")) scroll += rows;
					scroll = Math.max(0, Math.min(scroll, Math.max(0, source.length - rows)));
					if (scroll !== before) refresh();
				},
			};
		},
		{
			overlay: true,
			overlayOptions: { anchor: "bottom-center", width: "100%", maxHeight: "100%", margin: 0, fullscreen: true },
		},
	);
}

function windowLine(label: string, limit: WindowLimit | undefined, style: Style): string | undefined {
	const cap = limit?.cap;
	if (limit === undefined || cap === undefined || cap <= 0) return undefined;
	const used = limit.used ?? 0;
	const percent = Math.round((used / cap) * 100);
	const detail = `${`${percent}%`.padEnd(5)}${used.toFixed(2)}/${cap.toFixed(2)} cr  resets in ${until(limit.resetAt)}`;
	return row(label, bar(used / cap, style), limit.exceeded ? `${detail}${SEP}EXCEEDED` : detail, style);
}

async function showAccountView(ctx: ExtensionContext): Promise<void> {
	const data = await loadDashboard(ctx);
	if (data === undefined) return;

	await fullscreenAccountView(ctx, "Command Code account", style => {
		const lines: string[] = [];
		const failures = new Map(data.errors.map(error => [error.endpoint, error.message]));
		const { credits, subscription, usage } = data;

		const subtitle = [
			planLabel(subscription?.planId ?? credits?.planId),
			subscription?.status,
			data.whoami?.email,
		]
			.filter(part => part !== undefined)
			.join(SEP);
		if (subtitle) lines.push(style.fg("muted", subtitle));

		const windows = [
			windowLine("5h", credits?.fiveHour, style),
			windowLine("7d", credits?.weekly, style),
		];
		// Neither omp nor the API exposes a monthly window object: derive it the
		// way Command Code's Studio Usage page does — billed ÷ (billed + remaining).
		const remaining = (credits?.monthly ?? 0) + (credits?.purchased ?? 0) + (credits?.free ?? 0);
		const billed = usage?.credits;
		if (credits !== undefined && billed !== undefined && billed > 0) {
			const cap = billed + remaining;
			const percent = Math.round((billed / cap) * 100);
			const reset =
				subscription?.periodEnd === undefined
					? "no reset time"
					: SHORT_DATE.format(subscription.periodEnd);
			windows.push(
				row(
					"month",
					bar(billed / cap, style),
					`${`${percent}%`.padEnd(5)}${billed.toFixed(2)}/${cap.toFixed(2)} cr  resets ${reset}`,
					style,
				),
			);
		}
		for (const line of windows) if (line !== undefined) lines.push(line);

		if (credits !== undefined) {
			lines.push(
				row(
					"bal",
					"",
					`${remaining.toFixed(2)} cr (monthly ${(credits.monthly ?? 0).toFixed(2)} · purchased ${(credits.purchased ?? 0).toFixed(2)} · free ${(credits.free ?? 0).toFixed(2)})`,
					style,
				),
			);
		}

		if (subscription?.periodStart !== undefined && subscription.periodEnd !== undefined) {
			const left = Math.max(0, Math.ceil((subscription.periodEnd - Date.now()) / 86_400_000));
			const tail = subscription.cancelAtPeriodEnd ? `${SEP}cancels at period end` : "";
			lines.push(
				row(
					"period",
					"",
					`${SHORT_DATE.format(subscription.periodStart)} → ${SHORT_DATE.format(subscription.periodEnd)}${SEP}${left}d left${tail}`,
					style,
				),
			);
		}

		if (lines.length > 0) lines.push("");
		lines.push(style.fg("muted", `current billing period${SEP}as of ${stamp(data.fetchedAt)}`));

		const usageError = failures.get("usage");
		if (usageError !== undefined) {
			lines.push(style.fg("muted", `${"usage".padEnd(8)}  unavailable (${usageError})`));
		} else if (usage !== undefined) {
			const total = usage.totalCount;
			if (total !== undefined) {
				const parts: string[] = [];
				if (usage.completedCount !== undefined) parts.push(`${NUMBER.format(usage.completedCount)} ok`);
				if (usage.failedCount !== undefined) parts.push(`${NUMBER.format(usage.failedCount)} failed`);
				if (usage.successRate !== undefined) {
					const percent = usage.successRate > 1 ? usage.successRate : usage.successRate * 100;
					parts.push(`${percent.toFixed(1)}% success`);
				}
				lines.push(
					row(
						"requests",
						"",
						parts.length > 0 ? `${NUMBER.format(total)}  (${parts.join(SEP)})` : NUMBER.format(total),
						style,
					),
				);
			}

			if (usage.tokensIn !== undefined || usage.tokensOut !== undefined) {
				lines.push(row("tokens", "", `${tokens(usage.tokensIn)} in${SEP}${tokens(usage.tokensOut)} out`, style));
			}

			if (usage.credits !== undefined) {
				const average =
					usage.averageCost === undefined
						? ""
						: `${SEP}avg ${usage.averageCost < 0.01 ? usage.averageCost.toFixed(4) : usage.averageCost.toFixed(2)} cr/request`;
				lines.push(row("spend", "", `${usage.credits.toFixed(2)} cr${average}`, style));
			}

			if (usage.periodBasis !== undefined) lines.push(row("basis", "", usage.periodBasis, style));
		}

		for (const [endpoint, message] of failures) {
			if (endpoint === "usage") continue;
			lines.push("");
			lines.push(style.fg("muted", `${endpoint.padEnd(8)}  unavailable (${message})`));
		}
		return lines;
	});
}


// ─── Command ────────────────────────────────────────────────────────────────

const USAGE = [
	"Usage: /cmdc [zdr | usage]",
	"  zdr    strict zero-data-retention headers on Command Code requests",
	"  usage  fullscreen account view: limits, balance, spend",
	"  quota  alias for usage",
].join("\n");

const ZDR_USAGE = [
	"Usage: /cmdc zdr [on|off|status]",
	"  on      set enabled and report ZDR ON (warning)",
	"  off     set disabled and report ZDR OFF (default)",
	"  status  report the current state without changing it",
].join("\n");

// omp completes `/cmdc <prefix>` with the whole typed argument string
// ("/cmdc zdr o" → argumentText "zdr o"), and dropdown acceptance replaces
// exactly that prefix, so completion values must carry the `zdr ` stem and the
// completer must switch on the word currently being typed.
function buildCompletions(options: readonly { value: string; description: string }[]) {
	return (prefix: string): { value: string; label: string; description: string }[] | null => {
		const [head = "", tail = ""] = prefix.split(/(?<=\s)/);
		const query = head.trim().toLowerCase();
		const isSub = argumentsIncludeVerb(query);
		const pool = isSub
			? options.filter(option => option.value.startsWith(`${query} `))
			: options;
		const word = tail.trim().length > 0 ? tail : isSub ? "" : head.trim().toLowerCase();
		const matches = pool
			.filter(option => option.value.startsWith(isSub ? `${query} ${word}` : word))
			.map(option => ({
				value: isSub ? `${query} ` : "",
				label: option.value.slice(isSub ? query.length + 1 : 0),
				description: option.description,
			}));
		return matches.length > 0 ? matches : null;
	};
}

function argumentsIncludeVerb(query: string): boolean {
	return query === "zdr";
}

function argumentCompletions(prefix: string) {
	return buildCompletions([
		{ value: "zdr", description: "ZDR controls for this session" },
		{ value: "zdr on", description: "Enforce ZDR on Command Code requests" },
		{ value: "zdr off", description: "Send Command Code requests untagged" },
		{ value: "zdr status", description: "Show this session's ZDR state" },
		{ value: "usage", description: "Billing-period usage: limits, balance, spend" },
	])(prefix);
}

function handleZdr(argument: string, ctx: ExtensionContext): void {
	const state = activate(ctx);
	switch (argument) {
		case "":
		case "status":
			ctx.ui.notify(describe(state), "info");
			return;
		case "on":
			state.enabled = true;
			state.source = "command";
			ctx.ui.notify(describe(state), "warning");
			return;
		case "off":
			state.enabled = false;
			state.source = "command";
			ctx.ui.notify(describe(state), "info");
			return;
		default:
			ctx.ui.notify(ZDR_USAGE, "warning");
	}
}

export default function commandcode(pi: ExtensionAPI): void {
	installFetchWrapper();

	pi.on("session_start", (_event, ctx) => {
		activate(ctx);
	});
	pi.on("session_switch", (_event, ctx) => {
		activate(ctx);
	});
	pi.on("session_branch", (_event, ctx) => {
		activate(ctx);
	});
	pi.on("session_tree", (_event, ctx) => {
		activate(ctx);
	});
	pi.on("session_shutdown", (_event, ctx) => {
		sessionByAgent.delete(ctx.agent.id);
		parentByAgent.delete(ctx.agent.id);
		if (ctx.agent.kind === "main") {
			bySession.delete(ctx.sessionManager.getSessionId());
			activeSessionId = undefined;
		}
	});

	pi.registerCommand("cmdc", {
		description: "Command Code: ZDR, usage",
		getArgumentCompletions: argumentCompletions,
		handler: async (args, ctx) => {
			const [sub = "", ...rest] = args
				.trim()
				.toLowerCase()
				.split(/\s+/)
				.filter(Boolean);
			switch (sub) {
				case "zdr":
					handleZdr(rest.join(" "), ctx);
					return;
				case "usage":
				case "quota":
					await showAccountView(ctx);
					return;
				default:
					ctx.ui.notify(USAGE, "info");
			}
		},
	});
}
