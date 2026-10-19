/**
 * Command Code ZDR toggle
 *
 * Command Code's Provider API enforces zero data retention per request with
 * `x-cmd-zdr: 1`. The header is injected at the `fetch` layer so it also
 * covers subagents, title generation, compaction, cache warming, and usage
 * probes, not just the active chat model.
 *
 * State is per session: `CMD_ZDR=1` seeds a new session as enabled and an
 * unset/`0` value seeds it disabled. `/commandcode-zdr` overrides that choice
 * for the current session only; nothing is written to disk. Subagent requests
 * inherit the root session's choice.
 *
 * ZDR is not free: a model with no ZDR-capable upstream fails with HTTP 422
 * (`cmd_zdr_no_providers`) rather than falling back, and routing may change
 * cost.
 */
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

const HEADER = "x-cmd-zdr";
const HOST = "commandcode.ai";
const WRAPPER = Symbol.for("omp.commandcode-zdr.fetch");

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

function argumentCompletions(prefix: string) {
	const options = [
		{ value: "status", label: "status", description: "Show this session's ZDR state" },
		{ value: "on", label: "on", description: "Enforce ZDR for this session" },
		{ value: "off", label: "off", description: "Send Command Code requests untagged this session" },
	];
	const query = prefix.trim().toLowerCase();
	const matches = options.filter(option => option.value.startsWith(query));
	return matches.length > 0 ? matches : null;
}

export default function commandcodeZdr(pi: ExtensionAPI): void {
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

	pi.registerCommand("commandcode-zdr", {
		description: "Toggle strict ZDR headers on Command Code requests",
		getArgumentCompletions: argumentCompletions,
		handler: async (args, ctx) => {
			const state = activate(ctx);
			const argument = args.trim().toLowerCase();
			switch (argument) {
				case "":
				case "toggle":
					state.enabled = !state.enabled;
					state.source = "command";
					ctx.ui.notify(describe(state), state.enabled ? "warning" : "info");
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
				case "status":
					ctx.ui.notify(describe(state), "info");
					return;
				default:
					ctx.ui.notify("Usage: /commandcode-zdr [on|off|status]", "warning");
			}
		},
	});

	pi.registerShortcut("alt+shift+z", {
		description: "Toggle this session's Command Code ZDR",
		handler: async ctx => {
			const state = activate(ctx);
			state.enabled = !state.enabled;
			state.source = "command";
			ctx.ui.notify(describe(state), state.enabled ? "warning" : "info");
		},
	});
}
