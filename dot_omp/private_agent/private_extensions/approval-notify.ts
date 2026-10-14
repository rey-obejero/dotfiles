/**
 * Approval notifications
 *
 * OMP notifies on completion, error, and when the `ask` tool blocks; it does
 * not notify when a tool call parks on the approval prompt. This extension
 * listens for `tool_approval_requested` — emitted only when a prompt is
 * genuinely required — and fires the host's terminal notification, so the
 * toast takes the same OSC 9 / OSC 99 path (tmux passthrough included) as the
 * built-in notifications. `/settings` notification suppression applies.
 *
 * Delete this file if OMP grows a built-in approval notification.
 */
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { TERMINAL } from "@oh-my-pi/pi-tui";

export default function approvalNotify(pi: ExtensionAPI): void {
	pi.on("tool_approval_requested", (event, ctx) => {
		// Headless sessions fail closed instead of prompting; nothing to announce.
		if (!ctx.hasUI) return;
		TERMINAL.sendNotification({
			title: ctx.sessionManager.getSessionName() || "omp",
			body: event.reason
				? `Waiting for approval: ${event.toolName} — ${event.reason}`
				: `Waiting for approval: ${event.toolName}`,
			type: "ask",
			urgency: "normal",
			actions: "focus",
		});
	});
}
