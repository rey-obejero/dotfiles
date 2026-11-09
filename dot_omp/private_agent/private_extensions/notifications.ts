/**
 * Uniform notifications
 *
 * One line per toast, matching dsh-TUI's task-completion shape:
 *
 *   omp · Task complete: <last reply preview>
 *   omp · Task failed: <error>
 *   omp · Approval required: <tool>
 *   omp · Input required
 *
 * The reply preview is the last settled assistant text, Markdown flattened to
 * plain text and capped at 200 graphemes. dsh-TUI only notifies successful
 * completions; the failure, approval and input lines are omp additions.
 *
 * Every toast is sent as a single body so terminals that would split title and
 * body (OSC 99) still render the one-line form.
 *
 * The four switches owned by this extension — completion, error, ask, approval,
 * persisted in `~/.omp/agent/notifications.json` and flipped with `/notify` —
 * are the single source of truth for omp's terminal toasts. omp core has its own
 * `completion.notify`, `error.notify` and `ask.notify` settings and those must
 * stay off (they are off in the chezmoi-managed config): enabling one makes the
 * core emit a second, differently formatted toast for the same event, alongside
 * this extension's. omp core never toasts tool-approval prompts at all, so the
 * `approval` switch has no core counterpart.
 */
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { TERMINAL } from "@oh-my-pi/pi-tui";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PREFIX = "omp";
const SEP = " · ";
const MAX_PREVIEW = 200;
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const previewSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

type NotifyKind = "completion" | "error" | "ask" | "approval";
const KINDS: readonly NotifyKind[] = ["completion", "error", "ask", "approval"];
const STATE_PATH = join(homedir(), ".omp/agent/notifications.json");

const enabled: Record<NotifyKind, boolean> = { completion: true, error: true, ask: true, approval: true };

let retrying = false;

function line(title: string, body?: string): string {
	return body ? `${PREFIX}${SEP}${title}: ${body}` : `${PREFIX}${SEP}${title}`;
}

function notify(text: string, type: string): void {
	TERMINAL.sendNotification({ body: text, type, actions: "focus" });
}

/**
 * Read the switch state; a missing file, malformed JSON or a non-boolean entry
 * leaves that switch at its default (`true`). Never throws.
 */
function loadState(): void {
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(STATE_PATH, "utf8"));
	} catch {
		return;
	}
	if (typeof parsed !== "object" || parsed === null) return;
	const record = parsed as Record<string, unknown>;
	for (const kind of KINDS) {
		const value = record[kind];
		if (typeof value === "boolean") enabled[kind] = value;
	}
}

/** Persist the switch state; returns false when the file could not be written. */
function saveState(): boolean {
	try {
		writeFileSync(STATE_PATH, `${JSON.stringify(enabled, null, "\t")}\n`, { mode: 0o600 });
		return true;
	} catch {
		return false;
	}
}

function statusLine(): string {
	return `Notifications: ${KINDS.map(kind => `${kind} ${enabled[kind] ? "on" : "off"}`).join(SEP)}`;
}

/** Plain-text preview; notification daemons may interpret raw Markdown headings. */
function flattenMarkdown(text: string): string {
	return text
		.replace(ANSI_RE, "")
		.replace(/^```.*$/gm, "")
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/^>\s?/gm, "")
		.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
		.replace(/<[^>]*>/g, "")
		.replace(/[`*_~]/g, "")
		.replace(/\|/g, " ")
		.replace(/[\x00-\x1f\x7f-\x9f]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function clampPreview(text: string): string {
	if (!text) return "";
	const graphemes = Array.from(previewSegmenter.segment(text), part => part.segment);
	return graphemes.length > MAX_PREVIEW ? `${graphemes.slice(0, MAX_PREVIEW - 1).join("")}…` : text;
}

function argumentCompletions(prefix: string) {
	const options = [
		{ value: "completion", label: "completion", description: "Task complete toast" },
		{ value: "error", label: "error", description: "Task failed toast" },
		{ value: "ask", label: "ask", description: "ask tool waiting for input toast" },
		{ value: "approval", label: "approval", description: "tool approval prompt toast" },
		{ value: "on", label: "on", description: "Enable every type" },
		{ value: "off", label: "off", description: "Disable every type" },
	];
	const query = prefix.trim().toLowerCase();
	if (!query) return null;
	const matches = options.filter(option => option.value.startsWith(query));
	return matches.length > 0 ? matches : null;
}

export default function notifications(pi: ExtensionAPI): void {
	loadState();

	pi.on("auto_retry_start", () => {
		retrying = true;
	});
	pi.on("auto_retry_end", () => {
		retrying = false;
	});

	pi.on("agent_end", (event, ctx) => {
		if (event.willContinue || retrying || ctx.hasPendingMessages()) return;

		const last = event.messages.findLast(message => message.role === "assistant");
		if (last === undefined || last.stopReason === "aborted") return;

		if (last.stopReason === "error") {
			if (!enabled.error) return;
			const detail = clampPreview(
				flattenMarkdown(last.errorClassificationMessage ?? last.errorMessage ?? ""),
			);
			notify(line("Task failed", detail), "error");
			return;
		}

		if (!enabled.completion) return;
		const text = last.content
			.filter(block => block.type === "text")
			.map(block => block.text)
			.join("\n");
		notify(line("Task complete", clampPreview(flattenMarkdown(text))), "completion");
	});

	pi.on("tool_approval_requested", (event, ctx) => {
		if (!ctx.hasUI || !enabled.approval) return;
		notify(line("Approval required", event.toolName), "ask");
	});

	pi.on("tool_call", (event, ctx) => {
		if (!ctx.hasUI || event.toolName !== "ask" || !enabled.ask) return;
		notify(line("Input required"), "ask");
	});

	pi.registerCommand("notify", {
		description: "Toggle omp notification types",
		getArgumentCompletions: argumentCompletions,
		handler: (args, ctx) => {
			const words = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
			const apply = (message: string, type: string): void => {
				const saved = saveState();
				ctx.ui.notify(
					saved ? message : `${message} (could not write ${STATE_PATH})`,
					saved ? type : "error",
				);
			};

			if (words.length === 0) {
				ctx.ui.notify(statusLine(), "info");
				return;
			}

			if (words.length === 1) {
				const [word] = words;
				if (word === "on" || word === "off") {
					for (const kind of KINDS) enabled[kind] = word === "on";
					apply(statusLine(), "info");
					return;
				}
				if ((KINDS as readonly string[]).includes(word)) {
					const kind = word as NotifyKind;
					enabled[kind] = !enabled[kind];
					apply(statusLine(), "info");
					return;
				}
			}

			if (words.length === 2) {
				const [kind, verb] = words;
				if ((KINDS as readonly string[]).includes(kind) && (verb === "on" || verb === "off")) {
					enabled[kind as NotifyKind] = verb === "on";
					apply(statusLine(), "info");
					return;
				}
			}

			ctx.ui.notify("Usage: /notify [completion|error|ask|approval [on|off]]", "warning");
		},
	});
}
