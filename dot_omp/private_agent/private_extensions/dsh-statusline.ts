/**
 * DSH-style status footer
 *
 * Mirrors dsh-TUI's default compact status line:
 *   `NORMAL · model · effort · cache · cost · folder` + right-aligned `ctx`
 *
 * The native status line is emptied in config (`statusLine.preset: custom`,
 * both segment lists `[]`) so this widget owns the footer row.
 *
 * dsh's segmented context bar is intentionally omitted: it needs a full row of
 * its own, and this footer is deliberately one line.
 *
 * Vim mode has no public extension source and is handled read-only: the
 * editor's `vimMode`/`vimPending`/`vimSelectedLines`/`vimEnabled` getters are
 * wrapped (`installVimProbe`); the host already reads them on every change.
 * If the getters move, the label is omitted.
 */
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { CustomEditor } from "@oh-my-pi/pi-tui/prompt/custom-editor";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const WIDGET_KEY = "dsh-statusline";
const SEP = " · ";
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
	cacheRate?: string;
	cost?: number;
	costPeriod?: "peak" | "idle";
	path: string;
	context?: { used: number; window: number; percent: number };
}

const vim: VimSnapshot = { enabled: false, mode: "insert", pending: "", selectedLines: 0 };
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

// ── row ──────────────────────────────────────────────────────────────────

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

/** The footer row: default metrics left, context right-aligned. */
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
	if (snapshot.effort) left.push({ key: "effort", text: muted(snapshot.effort) });
	if (snapshot.cacheRate !== undefined) {
		left.push({ key: "cache", text: `${muted("cache ")}${theme.fg("text", snapshot.cacheRate)}` });
	}
	if (snapshot.cost !== undefined && snapshot.cost > 0) {
		const period = snapshot.costPeriod ? ` ${snapshot.costPeriod}` : "";
		left.push({ key: "cost", text: theme.fg("text", `≈$${snapshot.cost.toFixed(2)}${period}`) });
	}
	if (snapshot.path) left.push({ key: "path", text: muted(snapshot.path) });

	if (snapshot.context) {
		const { used, window, percent } = snapshot.context;
		const color: StatusColor = percent >= 95 ? "error" : percent >= 80 ? "warning" : "muted";
		right.push({
			key: "ctx",
			text: `${muted("ctx ")}${theme.fg(color, formatContext(used, window, percent))}`,
		});
	}

	const fits = (): { leftText: string; rightText: string; leftWidth: number; rightWidth: number; ok: boolean } => {
		const leftText = joinParts(left, theme);
		const rightText = joinParts(right, theme);
		const leftWidth = visibleWidth(leftText);
		const rightWidth = visibleWidth(rightText);
		const total = leftWidth + rightWidth + (rightText ? 1 : 0);
		return { leftText, rightText, leftWidth, rightWidth, ok: total <= width };
	};

	let state = fits();

	// Shrink the folder before dropping metrics.
	if (!state.ok) {
		const pathPart = left.find(part => part.key === "path");
		if (pathPart) {
			const excess = state.leftWidth + state.rightWidth + 1 - width;
			const target = Math.max(6, visibleWidth(pathPart.text) - excess);
			pathPart.text = padTo(truncate(pathPart.text, target), target);
			state = fits();
		}
	}

	// Then drop the optional metrics, keeping vim and model.
	for (const key of ["cost", "cache", "effort"]) {
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
	return [` ${padTo(renderFields(snapshot, contentWidth, theme), contentWidth)} `];
}

// ── live data ─────────────────────────────────────────────────────────────

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

/** dsh's compact cwd: the folder name only. */
function formatPath(cwd: string): string {
	const parts = cwd.split(/[\\/]/).filter(Boolean);
	return parts.length > 0 ? parts[parts.length - 1]! : cwd;
}

function buildSnapshot(pi: ExtensionAPI, ctx: ExtensionContext): FooterSnapshot {
	const usage = ctx.sessionManager.getUsageStatistics();
	const contextUsage = ctx.getContextUsage();
	const cacheTotal = usage.input + usage.cacheRead + usage.cacheWrite;
	return {
		vim: vim.enabled ? { ...vim } : undefined,
		model: ctx.model?.name ?? ctx.model?.id,
		effort: pi.getThinkingLevel(),
		cacheRate: cacheTotal > 0 ? `${((usage.cacheRead / cacheTotal) * 100).toFixed(1)}%` : undefined,
		cost: typeof usage.cost === "number" ? usage.cost : undefined,
		costPeriod: pricingPeriod(ctx.model?.cost),
		path: formatPath(ctx.cwd),
		context: contextUsage
			? {
					used: contextUsage.tokens,
					window: contextUsage.contextWindow,
					percent: contextUsage.percent,
				}
			: undefined,
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
	pi.on("turn_end", (_event, ctx) => ensure(pi, ctx));
}
