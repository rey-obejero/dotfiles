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
 */
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { TERMINAL } from "@oh-my-pi/pi-tui";

const PREFIX = "omp";
const SEP = " · ";
const MAX_PREVIEW = 200;
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const previewSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

let retrying = false;

function line(title: string, body?: string): string {
	return body ? `${PREFIX}${SEP}${title}: ${body}` : `${PREFIX}${SEP}${title}`;
}

function notify(text: string, type: string): void {
	TERMINAL.sendNotification({ body: text, type, actions: "focus" });
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

export default function notifications(pi: ExtensionAPI): void {
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
			const detail = clampPreview(
				flattenMarkdown(last.errorClassificationMessage ?? last.errorMessage ?? ""),
			);
			notify(line("Task failed", detail), "error");
			return;
		}

		const text = last.content
			.filter(block => block.type === "text")
			.map(block => block.text)
			.join("\n");
		notify(line("Task complete", clampPreview(flattenMarkdown(text))), "completion");
	});

	pi.on("tool_approval_requested", (event, ctx) => {
		if (!ctx.hasUI) return;
		notify(line("Approval required", event.toolName), "ask");
	});

	pi.on("tool_call", (event, ctx) => {
		if (!ctx.hasUI || event.toolName !== "ask") return;
		notify(line("Input required"), "ask");
	});
}
