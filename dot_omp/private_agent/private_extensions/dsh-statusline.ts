/**
 * DSH-style status footer
 *
 * Reimplements dsh-TUI's footer as an OMP widget placed below the editor. The
 * native status line is emptied in config (`statusLine.preset: custom`, both
 * segment lists `[]`) so this widget owns the footer row.
 *
 * Layout:
 *   1. segmented context bar + right-aligned `used/window pct`
 *   2. `NORMAL · model · tps · ● agents · effort · cache · tokens · cost ·
 *       path` … right-aligned `git · #pr · session · #id · ctx`
 *
 * dsh's third row exists for hover details; widgets receive no mouse targets,
 * so it is omitted.
 *
 * Two values have no public extension source and are handled read-only:
 *   - vim mode: the editor's `vimMode`/`vimPending`/`vimSelectedLines`/
 *     `vimEnabled` getters are wrapped (`installVimProbe`); the host already
 *     reads them on every change. If the getters move, the label is omitted.
 *   - context composition: `getContextUsage()` exposes only the total, so the
 *     five bar segments are estimated from message/system text and scaled to
 *     the measured total. Counts and percentage stay exact.
 */
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import type { SessionMessageEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import { CustomEditor } from "@oh-my-pi/pi-tui/prompt/custom-editor";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const WIDGET_KEY = "dsh-statusline";
const SEP = " · ";

/** dsh-TUI's segmentation palette; dark and light themes share it. */
const SEGMENT_COLORS = ["#22305F", "#2B3D78", "#344A92", "#4D6BFE", "#5A7CFF"] as const;
const FREE_FILL = "#E8E8E8";
const RESET = "\x1b[0m";

type StatusColor = "muted" | "text" | "accent" | "success" | "warning" | "error";
type FgTheme = { fg(color: StatusColor, text: string): string };
type ModelCost = NonNullable<ExtensionContext["model"]>["cost"];

export interface VimSnapshot {
	enabled: boolean;
	mode: string;
	pending: string;
	selectedLines: number;
}

export interface FooterSnapshot {
	vim?: VimSnapshot;
	model?: string;
	effort?: string;
	tps?: number;
	subagents: number;
	cacheRate?: string;
	tokensIn: number;
	tokensOut: number;
	cost?: number;
	costPeriod?: "peak" | "idle";
	path: string;
	git?: string;
	pr?: number;
	sessionName?: string;
	sessionId?: string;
	context?: { used: number; window: number; percent: number };
	segments?: { system: number; prompt: number; assistant: number; thinking: number; tools: number };
}

const vim: VimSnapshot = { enabled: false, mode: "insert", pending: "", selectedLines: 0 };
let gitBranch: string | undefined;
let prNumber: number | undefined;
let hostUi: { requestRender?(): void } | undefined;
let currentCtx: ExtensionContext | undefined;
let registered = false;

const patchedEditors = new WeakSet<object>();

/** The probe runs inside a host getter; repaint after it returns. */
function requestHostRender(): void {
	queueMicrotask(() => hostUi?.requestRender?.());
}

/** `tui.vimMode` from the live config; the probe only reports after the first change. */
function vimEnabledFromConfig(): boolean {
	try {
		return /^\s*vimMode:\s*true\s*$/m.test(readFileSync(join(homedir(), ".omp/agent/config.yml"), "utf8"));
	} catch {
		return false;
	}
}
vim.enabled = vimEnabledFromConfig();

// ── formatting ────────────────────────────────────────────────────────────

/** Compact token count: 988, 3.4k, 12k, 1.0M. */
export function formatTokens(count: number): string {
	const value = Math.max(0, Math.round(count));
	if (value < 1000) return String(value);
	if (value < 10_000) return `${(value / 1000).toFixed(1)}k`;
	if (value < 1_000_000) return `${Math.round(value / 1000)}k`;
	if (value < 10_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	return `${Math.round(value / 1_000_000)}M`;
}

/** dsh's ctx field: `34% (43.8k/128k)`, or `9.7% (…)` below ten percent. */
export function formatContext(used: number, window: number, percent: number): string {
	const pct = percent < 10 ? percent.toFixed(1) : String(Math.round(percent));
	return `${pct}% (${formatTokens(used)}/${formatTokens(window)})`;
}

/** dsh's bar readout: `43.8k/128k 34.2%`. */
export function formatBarReadout(used: number, window: number, percent: number): string {
	return `${formatTokens(used)}/${formatTokens(window)} ${percent.toFixed(1)}%`;
}

function charWidth(char: string): number {
	const cp = char.codePointAt(0) ?? 0;
	if (cp === 0x200d) return 0;
	if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0;
	if (
		(cp >= 0x1100 && cp <= 0x115f) ||
		(cp >= 0x2e80 && cp <= 0xa4cf) ||
		(cp >= 0xac00 && cp <= 0xd7a3) ||
		(cp >= 0xf900 && cp <= 0xfaff) ||
		(cp >= 0xfe30 && cp <= 0xfe4f) ||
		(cp >= 0xff00 && cp <= 0xff60) ||
		(cp >= 0xffe0 && cp <= 0xffe6) ||
		(cp >= 0x1f300 && cp <= 0x1f64f) ||
		(cp >= 0x1f900 && cp <= 0x1f9ff) ||
		(cp >= 0x20000 && cp <= 0x3fffd)
	) {
		return 2;
	}
	return 1;
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;

/** Visible cell width of a string carrying SGR escapes. */
export function visibleWidth(text: string): number {
	let width = 0;
	for (const char of text.replace(ANSI_RE, "")) width += charWidth(char);
	return width;
}

/** Cut to `width` cells, keeping escapes and closing any open style. */
function truncate(text: string, width: number): string {
	if (width <= 0) return "";
	let out = "";
	let used = 0;
	for (let i = 0; i < text.length; ) {
		if (text[i] === "\x1b") {
			const match = /^\x1b\[[0-9;]*m/.exec(text.slice(i));
			if (match) {
				out += match[0];
				i += match[0].length;
				continue;
			}
		}
		const char = String.fromCodePoint(text.codePointAt(i) ?? 0);
		const next = charWidth(char);
		if (used + next > width) break;
		out += char;
		used += next;
		i += char.length;
	}
	return `${out}${RESET}`;
}

function padTo(text: string, width: number): string {
	const current = visibleWidth(text);
	return current >= width ? text : text + " ".repeat(width - current);
}

function bg(hex: string): string {
	const value = Number.parseInt(hex.slice(1), 16);
	const r = (value >> 16) & 0xff;
	const g = (value >> 8) & 0xff;
	const b = value & 0xff;
	return `\x1b[48;2;${r};${g};${b}m`;
}

/** Largest-remainder split so segment cells always sum to `total`. */
export function allocate(total: number, weights: readonly number[]): number[] {
	const sum = weights.reduce((acc, weight) => acc + Math.max(0, weight), 0);
	if (total <= 0 || sum <= 0) return weights.map(() => 0);
	const raw = weights.map(weight => (Math.max(0, weight) / sum) * total);
	const cells = raw.map(Math.floor);
	let remainder = total - cells.reduce((acc, value) => acc + value, 0);
	const order = raw
		.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
		.sort((a, b) => b.fraction - a.fraction);
	for (let i = 0; remainder > 0; i++, remainder--) cells[order[i % order.length]!.index]! += 1;
	return cells;
}

// ── rows ──────────────────────────────────────────────────────────────────

/** dsh's segmented bar: background fills, readout inside the free part. */
export function renderBar(snapshot: FooterSnapshot, width: number): string | undefined {
	const context = snapshot.context;
	if (!context || context.window <= 0 || width <= 0) return undefined;

	const percent = Math.max(0, Math.min(100, context.percent));
	const used = Math.min(width, context.used > 0 ? Math.max(1, Math.round((percent / 100) * width)) : 0);
	const free = width - used;

	let out = "";
	if (used > 0) {
		const segments = snapshot.segments;
		const weights = segments
			? [segments.system, segments.prompt, segments.assistant, segments.thinking, segments.tools]
			: [];
		const allocated = weights.some(weight => weight > 0) ? allocate(used, weights) : [];
		const cells =
			allocated.length === 5 && allocated.reduce((a, b) => a + b, 0) === used ? allocated : [used, 0, 0, 0, 0];
		for (let i = 0; i < cells.length; i++) {
			const count = cells[i] ?? 0;
			if (count > 0) out += `${bg(SEGMENT_COLORS[i] ?? SEGMENT_COLORS[2])}${" ".repeat(count)}${RESET}`;
		}
	}

	if (free > 0) {
		const full = formatBarReadout(context.used, context.window, context.percent);
		const short = `${context.percent.toFixed(1)}%`;
		const readout = visibleWidth(full) + 1 <= free ? full : visibleWidth(short) + 1 <= free ? short : undefined;
		if (readout) {
			const lead = free - visibleWidth(readout);
			out += `${bg(FREE_FILL)}${" ".repeat(lead)}\x1b[38;2;74;74;74m${readout}\x1b[39m${RESET}`;
		} else {
			out += `${bg(FREE_FILL)}${" ".repeat(free)}${RESET}`;
		}
	}

	return out;
}

const VIM_LABELS = {
	insert: ["INSERT", "success"],
	normal: ["NORMAL", "accent"],
	visual: ["VISUAL", "warning"],
	"visual-line": ["V-LINE", "warning"],
	replace: ["REPLACE", "accent"],
} as const satisfies Record<string, readonly [string, StatusColor]>;

interface Part {
	key: string;
	text: string;
}

function joinParts(parts: readonly Part[], theme: FgTheme): string {
	return parts.map(part => part.text).join(theme.fg("muted", SEP));
}

/** The field row: metrics left, provenance and ctx right-aligned. */
export function renderFields(snapshot: FooterSnapshot, width: number, theme: FgTheme): string {
	const left: Part[] = [];
	const right: Part[] = [];
	const muted = (text: string): string => theme.fg("muted", text);

	if (snapshot.vim?.enabled) {
		const style = VIM_LABELS[snapshot.vim.mode as keyof typeof VIM_LABELS];
		const label = style?.[0] ?? snapshot.vim.mode.toUpperCase();
		const color = style?.[1] ?? "muted";
		const selected = snapshot.vim.selectedLines > 1 ? ` ${snapshot.vim.selectedLines}L` : "";
		const pending = snapshot.vim.pending ? ` ${muted(snapshot.vim.pending)}` : "";
		left.push({ key: "vim", text: `${theme.fg(color, `${label}${selected}`)}${pending}` });
	}
	if (snapshot.model) left.push({ key: "model", text: theme.fg("text", snapshot.model) });
	if (snapshot.tps !== undefined) left.push({ key: "tps", text: theme.fg("text", `${Math.round(snapshot.tps)} tps`) });
	if (snapshot.subagents > 0) left.push({ key: "subagents", text: theme.fg("text", `● ${snapshot.subagents}`) });
	if (snapshot.effort) left.push({ key: "effort", text: muted(snapshot.effort) });
	if (snapshot.cacheRate !== undefined) {
		left.push({ key: "cache", text: `${muted("cache ")}${theme.fg("text", snapshot.cacheRate)}` });
	}
	if (snapshot.tokensIn > 0 || snapshot.tokensOut > 0) {
		left.push({
			key: "tokens",
			text: theme.fg("text", `${formatTokens(snapshot.tokensIn)}→${formatTokens(snapshot.tokensOut)}`),
		});
	}
	if (snapshot.cost !== undefined && snapshot.cost > 0) {
		const period = snapshot.costPeriod ? ` ${snapshot.costPeriod}` : "";
		left.push({ key: "cost", text: theme.fg("text", `≈$${snapshot.cost.toFixed(2)}${period}`) });
	}
	if (snapshot.path) left.push({ key: "path", text: muted(snapshot.path) });

	if (snapshot.git) right.push({ key: "git", text: theme.fg("accent", snapshot.git) });
	if (snapshot.pr !== undefined) right.push({ key: "pr", text: theme.fg("accent", `#${snapshot.pr}`) });
	if (snapshot.sessionName) right.push({ key: "sessionName", text: theme.fg("accent", snapshot.sessionName) });
	if (snapshot.sessionId) {
		right.push({ key: "sessionId", text: muted(`#${snapshot.sessionId.slice(0, 8)}`) });
	}
	if (snapshot.context) {
		const { used, window, percent } = snapshot.context;
		const color: StatusColor = percent >= 95 ? "error" : percent >= 80 ? "warning" : "muted";
		right.push({
			key: "ctx",
			text: `${muted("ctx ")}${theme.fg(color, formatContext(used, window, percent))}`,
		});
	}

	// Drop the least useful right fields first, but never ctx.
	const fits = (): { leftText: string; rightText: string; leftWidth: number; rightWidth: number; ok: boolean } => {
		const leftText = joinParts(left, theme);
		const rightText = joinParts(right, theme);
		const leftWidth = visibleWidth(leftText);
		const rightWidth = visibleWidth(rightText);
		const total = leftWidth + rightWidth + (rightText ? 1 : 0);
		return { leftText, rightText, leftWidth, rightWidth, ok: total <= width };
	};

	let state = fits();
	for (const key of ["sessionId", "pr", "sessionName", "git"]) {
		if (state.ok) break;
		const index = right.findIndex(part => part.key === key);
		if (index >= 0) {
			right.splice(index, 1);
			state = fits();
		}
	}

	// Shrink the path before dropping metrics.
	if (!state.ok) {
		const pathPart = left.find(part => part.key === "path");
		if (pathPart) {
			const excess = state.leftWidth + state.rightWidth + 1 - width;
			const target = Math.max(8, visibleWidth(pathPart.text) - excess);
			pathPart.text = padTo(truncate(pathPart.text, target), target);
			state = fits();
		}
	}

	// Then drop left metrics, keeping vim, model and path.
	for (const key of ["subagents", "tps", "tokens", "cost", "cache", "effort"]) {
		if (state.ok) break;
		const index = left.findIndex(part => part.key === key);
		if (index >= 0) {
			left.splice(index, 1);
			state = fits();
		}
	}

	const gap = state.rightText ? Math.max(1, width - state.leftWidth - state.rightWidth) : 0;
	const line = state.rightText
		? `${state.leftText}${" ".repeat(gap)}${state.rightText}`
		: padTo(state.leftText, width);
	return padTo(truncate(line, width), width);
}

export function renderFooter(snapshot: FooterSnapshot, width: number, theme: FgTheme): string[] {
	const contentWidth = Math.max(0, width - 2);
	if (contentWidth <= 0) return [];
	const rows: string[] = [];
	const bar = renderBar(snapshot, contentWidth);
	if (bar) rows.push(bar);
	rows.push(renderFields(snapshot, contentWidth, theme));
	return rows.map(row => ` ${padTo(row, contentWidth)} `);
}

// ── live data ─────────────────────────────────────────────────────────────

function textLength(content: unknown): number {
	if (typeof content === "string") return content.length;
	if (!Array.isArray(content)) return 0;
	let total = 0;
	for (const block of content) {
		if (
			typeof block === "object" &&
			block !== null &&
			"type" in block &&
			block.type === "text" &&
			"text" in block &&
			typeof block.text === "string"
		) {
			total += block.text.length;
		}
	}
	return total;
}

let segmentCache: { key: string; value: FooterSnapshot["segments"] } | undefined;

/** Estimated composition; the renderer scales it to the measured total. */
function estimateSegments(ctx: ExtensionContext): FooterSnapshot["segments"] | undefined {
	const entries = ctx.sessionManager.getEntries();
	let systemLength = 0;
	try {
		systemLength = ctx.getSystemPrompt().join("\n").length;
	} catch {
		systemLength = 0;
	}
	const key = `${entries.length}:${systemLength}:${entries.at(-1)?.timestamp ?? ""}`;
	if (segmentCache && segmentCache.key === key) return segmentCache.value;

	let prompt = 0;
	let assistant = 0;
	let thinking = 0;
	let tools = 0;
	for (const entry of entries) {
		if (entry.type !== "message") continue;
		const message: SessionMessageEntry["message"] = entry.message;
		if (message.role === "user") prompt += textLength(message.content);
		else if (message.role === "toolResult") tools += textLength(message.content);
		else if (message.role === "assistant") {
			for (const block of message.content) {
				if (block.type === "text") assistant += block.text.length;
				else if (block.type === "thinking") thinking += block.thinking.length;
				else if (block.type === "toolCall") {
					const args = JSON.stringify(block.input ?? "");
					tools += block.name.length + args.length;
				}
			}
		}
	}

	const total = systemLength + prompt + assistant + thinking + tools;
	const value =
		total > 0
			? {
					system: systemLength / 4,
					prompt: prompt / 4,
					assistant: assistant / 4,
					thinking: thinking / 4,
					tools: tools / 4,
				}
			: undefined;
	segmentCache = { key, value };
	return value;
}

/** Same arithmetic as OMP's status line: last assistant output over its run. */
function lastTokensPerSecond(ctx: ExtensionContext): number | undefined {
	const entries = ctx.sessionManager.getEntries();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry?.type !== "message") continue;
		const message: SessionMessageEntry["message"] = entry.message;
		if (message.role !== "assistant") continue;
		const output = message.usage.output;
		if (!(output > 0)) return undefined;
		const duration =
			typeof message.duration === "number" && message.duration > 0
				? message.duration
				: !ctx.isIdle()
					? Date.now() - message.timestamp
					: undefined;
		if (duration === undefined || duration < 100) return undefined;
		const rate = (output * 1000) / duration;
		return Number.isFinite(rate) && rate > 0 ? rate : undefined;
	}
	return undefined;
}

function pricingPeriod(cost: ModelCost | undefined, now = Date.now()): "peak" | "idle" | undefined {
	const schedule = cost?.timeBased;
	if (!schedule) return undefined;
	if (schedule.peakWindows.length === 0 && (schedule.offPeakMultiplier ?? 1) === 1) return undefined;
	const day = Math.floor(now / 86_400_000);
	const weekday = (((day + 4) % 7) + 7) % 7;
	const minute = Math.floor((now - day * 86_400_000) / 60_000);
	for (const window of schedule.peakWindows) {
		if (minute >= window.startMinute && minute < window.endMinute && window.weekdays.includes(weekday)) {
			return "peak";
		}
	}
	return "idle";
}

function formatPath(cwd: string): string {
	const home = process.env.HOME;
	const path = home && cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
	if (visibleWidth(path) <= 34) return path;
	const chars = Array.from(path);
	return `…${chars.slice(-33).join("")}`;
}

function buildSnapshot(pi: ExtensionAPI, ctx: ExtensionContext): FooterSnapshot {
	const usage = ctx.sessionManager.getUsageStatistics();
	const contextUsage = ctx.getContextUsage();
	const cacheTotal = usage.input + usage.cacheRead + usage.cacheWrite;
	return {
		vim: vim.enabled ? { ...vim } : undefined,
		model: ctx.model?.name ?? ctx.model?.id,
		effort: pi.getThinkingLevel(),
		tps: lastTokensPerSecond(ctx),
		subagents: ctx.getAsyncJobSnapshot()?.running.filter(job => job.type === "task").length ?? 0,
		cacheRate: cacheTotal > 0 ? `${((usage.cacheRead / cacheTotal) * 100).toFixed(1)}%` : undefined,
		tokensIn: usage.input,
		tokensOut: usage.output,
		cost: typeof usage.cost === "number" ? usage.cost : undefined,
		costPeriod: pricingPeriod(ctx.model?.cost),
		path: formatPath(ctx.cwd),
		git: gitBranch,
		pr: prNumber,
		sessionName: ctx.sessionManager.getSessionName(),
		sessionId: ctx.sessionManager.getSessionId(),
		context: contextUsage
			? {
					used: contextUsage.tokens,
					window: contextUsage.contextWindow,
					percent: contextUsage.percent,
				}
			: undefined,
		segments: estimateSegments(ctx),
	};
}

// ── vim probe ─────────────────────────────────────────────────────────────

/** Wrap the editor's vim getters read-only so the footer can see the mode. */
function installVimProbe(ctx: ExtensionContext): void {
	const factory = ctx.ui.getEditorComponent();
	const prototype: unknown = factory ? Reflect.get(factory, "prototype") : CustomEditor.prototype;
	if (typeof prototype !== "object" || prototype === null || patchedEditors.has(prototype)) return;

	const wrap = (key: string, apply: (value: unknown) => void): void => {
		let owner: object | null = prototype;
		let descriptor: PropertyDescriptor | undefined;
		while (owner && !(descriptor = Object.getOwnPropertyDescriptor(owner, key))) owner = Object.getPrototypeOf(owner);
		if (!descriptor?.get) return;
		const original = descriptor.get;
		Object.defineProperty(prototype, key, {
			configurable: true,
			enumerable: descriptor.enumerable,
			get(this: unknown) {
				const value: unknown = original.call(this);
				try {
					apply(value);
				} catch {
					// A probe must never disturb the editor.
				}
				return value;
			},
		});
	};

	wrap("vimEnabled", value => {
		if (value !== true || vim.enabled) return;
		vim.enabled = true;
		requestHostRender();
	});
	wrap("vimMode", value => {
		const next = typeof value === "string" ? value : String(value);
		if (next === vim.mode) return;
		vim.mode = next;
		requestHostRender();
	});
	wrap("vimPending", value => {
		const next = typeof value === "string" ? value : "";
		if (next === vim.pending) return;
		vim.pending = next;
		requestHostRender();
	});
	wrap("vimSelectedLines", value => {
		const next = typeof value === "number" ? value : 0;
		if (next === vim.selectedLines) return;
		vim.selectedLines = next;
		requestHostRender();
	});
	patchedEditors.add(prototype);
}

// ── git / PR ──────────────────────────────────────────────────────────────

let vcsAt = 0;
let vcsCwd = "";
let prAt = 0;
let prKey = "";

function refreshVcs(pi: ExtensionAPI, ctx: ExtensionContext): void {
	const now = Date.now();
	if (now - vcsAt < 3000 && vcsCwd === ctx.cwd) return;
	vcsAt = now;
	vcsCwd = ctx.cwd;
	prNumber = undefined;
	void pi
		.exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ctx.cwd, timeout: 1000 })
		.then(result => {
			gitBranch = result.code === 0 ? result.stdout.trim() || undefined : undefined;
			hostUi?.requestRender?.();
			const key = `${ctx.cwd}:${gitBranch ?? ""}`;
			if (!gitBranch || (now - prAt < 60_000 && prKey === key)) return;
			prAt = Date.now();
			prKey = key;
			void pi
				.exec("gh", ["pr", "view", "--json", "number", "--jq", ".number"], {
					cwd: ctx.cwd,
					timeout: 1500,
				})
				.then(result => {
					const parsed = Number.parseInt(result.stdout.trim(), 10);
					prNumber = result.code === 0 && Number.isFinite(parsed) ? parsed : undefined;
					hostUi?.requestRender?.();
				})
				.catch(() => {
					prNumber = undefined;
				});
		})
		.catch(() => {
			gitBranch = undefined;
		});
}

// ── extension ─────────────────────────────────────────────────────────────

function renderHost(ui: unknown): { requestRender?(): void } | undefined {
	if (typeof ui !== "object" || ui === null) return undefined;
	const request = Reflect.get(ui, "requestRender");
	return typeof request === "function" ? { requestRender: () => Reflect.apply(request, ui, []) } : undefined;
}

function ensure(pi: ExtensionAPI, ctx: ExtensionContext): void {
	if (ctx.agent.kind !== "main") return;
	currentCtx = ctx;
	vim.enabled = vimEnabledFromConfig();
	if (registered) return;
	registered = true;
	installVimProbe(ctx);
	ctx.ui.setWidget(
		WIDGET_KEY,
		(widgetUi, theme) => {
			hostUi = renderHost(widgetUi);
			refreshVcs(pi, ctx);
			return {
				render: (width: number): readonly string[] => renderFooter(buildSnapshot(pi, currentCtx!), width, theme),
			};
		},
		{ placement: "belowEditor" },
	);
}

export default function dshStatusline(pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => ensure(pi, ctx));
	pi.on("session_switch", (_event, ctx) => ensure(pi, ctx));
	pi.on("turn_end", (_event, ctx) => {
		ensure(pi, ctx);
		if (currentCtx) refreshVcs(pi, currentCtx);
	});
	pi.on("tool_result", (_event, ctx) => {
		ensure(pi, ctx);
		if (currentCtx) refreshVcs(pi, currentCtx);
	});
}
