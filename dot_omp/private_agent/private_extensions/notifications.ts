/**
 * Uniform notifications
 *
 * omp's built-in completion/error/`ask` toasts are disabled in config; this
 * extension sends every toast instead, so their wording and shape stay
 * consistent.
 *
 * Format:
 *   - OSC 99 terminals carry a real title and body:
 *       title  omp – <status>
 *       body   <repo> – <session title>
 *   - OSC 9 and BEL have no title field; omp joins title and body with ": ",
 *     so this extension sends a single composed line instead:
 *       omp – <status> · <repo> – <session title>
 *
 * The session title keeps its card in the terminal tab; `splitCardTitle`
 * strips the icon and code from the toast, so a Nerd Font glyph never reaches
 * a notification font that cannot render it.
 */
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { splitCardTitle } from "@oh-my-pi/pi-coding-agent/utils/title-card";
import { isOsc99Supported, TERMINAL } from "@oh-my-pi/pi-tui";

const DASH = "–";
let retrying = false;

function context(ctx: {
	cwd: string;
	sessionManager: { getSessionName(): string | undefined };
}): string {
	const raw = ctx.sessionManager.getSessionName() || "omp";
	const session = splitCardTitle(raw)?.title ?? raw;
	const project = ctx.cwd.split(/[\\/]/).filter(Boolean).pop() || "omp";
	return `${project} ${DASH} ${session}`;
}

function notify(status: string, body: string, type: string): void {
	// OSC 99 renders a title and body separately; OSC 9 and BEL collapse the two
	// into `title: body`, so there the whole message rides in the body instead.
	if (isOsc99Supported()) {
		TERMINAL.sendNotification({ title: `omp ${DASH} ${status}`, body, type, actions: "focus" });
		return;
	}

	TERMINAL.sendNotification({ body: `omp ${DASH} ${status} ${DASH} ${body}`, type, actions: "focus" });
}

export default function notifications(pi: ExtensionAPI): void {
	pi.on("auto_retry_start", () => {
		retrying = true;
	});
	pi.on("auto_retry_end", () => {
		retrying = false;
	});

	pi.on("agent_end", (event, ctx) => {
		if (event.willContinue || retrying) return;

		const last = event.messages.findLast(message => message.role === "assistant");
		if (last?.stopReason === "aborted") return;

		const failed = last?.stopReason === "error";
		notify(failed ? "Failed" : "Completed", context(ctx), failed ? "error" : "completion");
	});

	pi.on("tool_approval_requested", (event, ctx) => {
		if (!ctx.hasUI) return;

		const permission = event.toolName === "computer" || event.toolName === "browser";
		notify(
			`${permission ? "Permission needed for" : "Approval needed for"} ${event.toolName}`,
			context(ctx),
			"ask",
		);
	});

	pi.on("tool_call", (event, ctx) => {
		if (!ctx.hasUI || event.toolName !== "ask") return;

		notify("Input needed", context(ctx), "ask");
	});
}
