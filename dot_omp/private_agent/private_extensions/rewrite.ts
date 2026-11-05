/**
 * `/rewrite` — prompt enhancer.
 *
 * Takes the text in the composer, asks the current model for a sharper version
 * of the same request, and presents it with three actions: Accept (replace the
 * draft), Regenerate (another take), Cancel (keep the draft).
 *
 * The request runs as a side turn (`ctx.runEphemeralTurn`), so the suggestion
 * and its provider exchange never enter session history. Side turns do see the
 * session's existing messages, so the rewrite can name what the conversation
 * has already established.
 *
 * omp clears the composer before a command handler runs, so the draft travels
 * as the command's argument (`/rewrite <draft>`, multi-line allowed); the
 * composer read is a fallback for hosts that keep the draft in place.
 *
 * The dialog's built-in "Other…" row is honoured: typed text becomes the
 * composer draft, since nothing else would make sense for a free-text answer.
 */
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

const ACCEPT = "Accept";
const REGENERATE = "Regenerate";
const CANCEL = "Cancel";
/** Side turns cap the deduped reply at 4 KiB; a draft rewrite may exceed it. */
const REPLY_BYTES = 32 * 1024;

let busy = false;

function wordCount(text: string): number {
	const trimmed = text.trim();
	return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Strip one outer code fence, which models wrap plain prose in unasked. */
function unfence(text: string): string {
	const trimmed = text.trim();
	const fenced = /^```[\w-]*\n([\s\S]*?)\n?```$/.exec(trimmed);
	return (fenced?.[1] ?? trimmed).trim();
}

function describe(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

function instruction(draft: string, attempts: readonly string[]): string {
	const lines = [
		"You edit prompts. The text between the DRAFT markers is the user's unfinished prompt for this session.",
		"Rewrite it as a stronger version of the same request:",
		"- Keep the author's intent, language, and voice.",
		"- Make the ask specific and unambiguous; name files, symbols, and constraints that appear in the draft or in this conversation.",
		"- Use only names that literally appear in the draft or in this conversation — invent no projects, files, or symbols.",
		"- Add structure only where it removes ambiguity (ordered steps, invariants, acceptance criteria), and stay close to the draft's length: expand what is ambiguous, never pad.",
		"- Add no new scope, invent no requirements, and never perform the request yourself.",
		"- Keep it as a single message the user will send.",
		"",
		"Reply with the rewritten prompt only: no preamble, no commentary, no surrounding code fences.",
	];
	if (attempts.length > 0) {
		lines.push(
			"",
			"Earlier attempts appear below. Produce a materially different rewrite — different phrasing and structure, not a paraphrase.",
			...attempts.map((text, index) => `\n<<<ATTEMPT ${index + 1}\n${text}\nATTEMPT>>>`),
		);
	}
	lines.push("", "<<<DRAFT", draft, "DRAFT>>>");
	return lines.join("\n");
}

/** Replace the draft, unless the composer changed while generation ran. */
function applyRewrite(ctx: ExtensionContext, before: string, enhanced: string): void {
	if (ctx.ui.getEditorText() !== before) {
		ctx.ui.notify("Composer changed; rewrite not applied.", "warning");
		return;
	}
	ctx.ui.setEditorText(enhanced);
}

const usage = "Usage: /rewrite <draft>";

export default function rewrite(pi: ExtensionAPI): void {
	pi.registerCommand("rewrite", {
		description: "Rewrite a prompt draft into a sharper version",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("No composer in this mode.", "warning");
				return;
			}
			// The host clears the composer before dispatching a command, so the
			// draft arrives as the argument (or not at all in older hosts).
			const before = ctx.ui.getEditorText();
			const submitted = args.trim();
			if (!submitted && !before.trim()) {
				ctx.ui.notify(usage, "warning");
				return;
			}
			const askDialog = ctx.ui.askDialog;
			const runSide = ctx.runEphemeralTurn;
			if (!askDialog || !runSide) {
				ctx.ui.notify("No rewrite dialog in this mode.", "warning");
				return;
			}
			if (busy) {
				ctx.ui.notify("Rewrite already running.", "warning");
				return;
			}
			if (!ctx.isIdle()) {
				ctx.ui.notify("Wait for the current turn to finish.", "warning");
				return;
			}

			const draft = submitted || before;

			busy = true;
			const attempts: string[] = [];
			try {
				for (;;) {
					let enhanced: string;
					try {
						const { replyText } = await runSide({
							promptText: instruction(draft, attempts),
							tools: false,
							replyMaxBytes: REPLY_BYTES,
						});
						enhanced = unfence(replyText);
					} catch (error) {
						ctx.ui.notify(`Rewrite failed: ${describe(error)}`, "error");
						return;
					}
					if (!enhanced) {
						ctx.ui.notify("The model returned no rewrite.", "warning");
						return;
					}

					const answer = await askDialog([
						{
							id: "rewrite",
							header: "Rewrite",
							question: `Rewrite ready · ${wordCount(draft)} → ${wordCount(enhanced)} words`,
							recommended: 0,
							options: [
								{
									label: ACCEPT,
									description: "Replace the draft",
									preview: enhanced,
								},
								{
									label: REGENERATE,
									description: "Ask for another version",
								},
								{
									label: CANCEL,
									description: "Keep the draft",
								},
							],
						},
					]);
					if (!answer || answer.kind !== "submit") return;

					const result = answer.results[0];
					if (!result || result.timedOut) return;

					const typed = result.customInput?.trim();
					if (typed) {
						applyRewrite(ctx, before, typed);
						return;
					}

					const choice = result.selectedOptions[0];
					if (choice === ACCEPT) {
						applyRewrite(ctx, before, enhanced);
						return;
					}
					if (choice !== REGENERATE) return;

					attempts.push(enhanced);
					if (attempts.length > 3) attempts.shift();
				}
			} finally {
				busy = false;
			}
		},
	});
}
