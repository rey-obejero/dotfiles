/**
 * WSL host clipboard bridge
 *
 * Text copied inside WSL lands on the Windows clipboard through a small
 * polling loop, and text copied on Windows can be pulled into the composer
 * with `/clipboard paste` or `Alt+Shift+U`.
 *
 * The forward direction polls the Wayland clipboard instead of using
 * `wl-paste --watch`, whose lifetime depends on the compositor. A 700 ms poll
 * is cheap, survives compositor restarts, and skips values already forwarded,
 * so WSLg's own host→guest mirror cannot bounce content back.
 *
 * Vim mode note: `p` puts the editor's internal register, not the system
 * clipboard, so it cannot paste something copied in Windows. Plain `p` also
 * cannot be rebound to the system clipboard without breaking typing. Use
 * `/clipboard paste` or `Alt+Shift+U` for the Windows clipboard; `y`/`p`
 * still round-trip OMP's own selections.
 *
 * `OMP_WSL_CLIP=0` disables the automatic watcher at session start.
 */
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

const POLL_MS = 700;

const isWSL = Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);
const clipExe = Bun.which("clip.exe") ?? "/mnt/c/Windows/System32/clip.exe";
const psExe = Bun.which("powershell.exe") ?? "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
const wlPaste = Bun.which("wl-paste");

interface ClipboardWatcher {
	timer?: Timer;
	running: boolean;
	last: string;
}

const watcher: ClipboardWatcher = { running: false, last: "" };

async function hostWrite(text: string): Promise<void> {
	const proc = Bun.spawn([clipExe], { stdin: "pipe", stdout: "ignore", stderr: "ignore" });
	proc.stdin.write(text);
	await proc.stdin.end();
	await proc.exited;
}

async function hostRead(): Promise<string> {
	const command =
		"$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [Text.Encoding]::UTF8; [Console]::Out.Write([string](Get-Clipboard -Raw))";
	const proc = Bun.spawn([psExe, "-NoProfile", "-NonInteractive", "-Command", command], {
		stdin: "ignore",
		stdout: "pipe",
		stderr: "ignore",
	});
	const timer = setTimeout(() => proc.kill(), 5000);
	try {
		const text = await new Response(proc.stdout).text();
		await proc.exited;
		return text.replaceAll("\r\n", "\n");
	} finally {
		clearTimeout(timer);
	}
}

async function wslClipboardText(): Promise<string> {
	if (!wlPaste) return "";
	const proc = Bun.spawn([wlPaste, "--type", "text", "--no-newline"], {
		stdin: "ignore",
		stdout: "pipe",
		stderr: "ignore",
	});
	const text = await new Response(proc.stdout).text();
	await proc.exited;
	return proc.exitCode === 0 ? text : "";
}

async function pollClipboard(): Promise<void> {
	try {
		const text = await wslClipboardText();
		if (text === watcher.last) return;
		watcher.last = text;
		if (text.length > 0) await hostWrite(text);
	} catch {
		// A transient compositor or PowerShell error must not stop the loop.
	}
}

async function startWatcher(): Promise<string> {
	if (!isWSL) return "Not running in WSL; nothing to bridge.";
	if (!wlPaste) return "wl-paste was not found; the WSL → Windows watcher is unavailable.";
	if (!clipExe) return "clip.exe was not found; the WSL → Windows watcher is unavailable.";
	if (watcher.running) return "Clipboard watcher is already running.";

	watcher.last = await wslClipboardText();
	watcher.running = true;
	watcher.timer = setInterval(() => {
		void pollClipboard();
	}, POLL_MS);
	watcher.timer.unref();
	return "Clipboard watcher started: WSL → Windows.";
}

function stopWatcher(): string {
	if (!watcher.running) return "Clipboard watcher is not running.";
	clearInterval(watcher.timer);
	watcher.running = false;
	watcher.timer = undefined;
	return "Clipboard watcher stopped.";
}

async function status(): Promise<string> {
	const host = await hostRead()
		.then(text => `${text.length} character(s) readable`)
		.catch(() => "unavailable");
	return [
		`WSL: ${isWSL ? "yes" : "no"}`,
		`Watcher: ${watcher.running ? "running" : "stopped"}`,
		`Windows clipboard: ${host}`,
		`Programs: wl-paste=${wlPaste ?? "missing"}, clip.exe=${clipExe ?? "missing"}, powershell.exe=${psExe ?? "missing"}`,
	].join("\n");
}

async function copyDraft(ctx: ExtensionContext): Promise<string> {
	if (!ctx.hasUI) return "The composer is not available in this mode.";
	const text = ctx.ui.getEditorText();
	if (!text) return "The composer is empty.";
	await hostWrite(text);
	return `Copied ${text.length} character(s) to the Windows clipboard.`;
}

async function pasteHost(ctx: ExtensionContext): Promise<string> {
	if (!ctx.hasUI) return "The composer is not available in this mode.";
	const text = await hostRead();
	if (!text) return "The Windows clipboard has no text.";

	const before = ctx.ui.getEditorText();
	ctx.ui.pasteToEditor(text);
	// Vim Normal mode can leave pasteToEditor a no-op; append instead of losing the paste.
	if (ctx.ui.getEditorText() === before) ctx.ui.setEditorText(before + text);
	return `Pasted ${text.length} character(s) from the Windows clipboard.`;
}

function argumentCompletions(prefix: string) {
	const options = [
		{ value: "status", label: "status", description: "Show the bridge and watcher state" },
		{ value: "on", label: "on", description: "Start WSL → Windows text sync" },
		{ value: "off", label: "off", description: "Stop the sync" },
		{ value: "copy", label: "copy", description: "Copy the composer draft to Windows" },
		{ value: "paste", label: "paste", description: "Paste the Windows clipboard into the composer" },
	];
	const query = prefix.trim().toLowerCase();
	const matches = options.filter(option => option.value.startsWith(query));
	return matches.length > 0 ? matches : null;
}

export default function wslClipboard(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx) => {
		if (process.env.OMP_WSL_CLIP === "0") return;
		if (!isWSL) return;
		const result = await startWatcher();
		if (result.includes("unavailable") && ctx.hasUI) ctx.ui.notify(result, "warning");
	});

	pi.on("session_shutdown", (_event, ctx) => {
		if (ctx.agent.kind === "main") stopWatcher();
	});

	pi.registerCommand("clipboard", {
		description: "WSL ↔ Windows clipboard bridge",
		getArgumentCompletions: argumentCompletions,
		handler: async (args, ctx) => {
			const argument = args.trim().toLowerCase();
			switch (argument) {
				case "":
				case "status":
					ctx.ui.notify(await status(), "info");
					return;
				case "on":
					ctx.ui.notify(await startWatcher(), "info");
					return;
				case "off":
					ctx.ui.notify(stopWatcher(), "info");
					return;
				case "copy":
					ctx.ui.notify(await copyDraft(ctx), "info");
					return;
				case "paste":
					ctx.ui.notify(await pasteHost(ctx), "info");
					return;
				default:
					ctx.ui.notify("Usage: /clipboard [status|on|off|copy|paste]", "warning");
			}
		},
	});

	pi.registerShortcut("alt+shift+y", {
		description: "Copy composer draft to the Windows clipboard",
		handler: async ctx => {
			ctx.ui.notify(await copyDraft(ctx), "info");
		},
	});

	pi.registerShortcut("alt+shift+u", {
		description: "Paste the Windows clipboard into the composer",
		handler: async ctx => {
			ctx.ui.notify(await pasteHost(ctx), "info");
		},
	});
}
