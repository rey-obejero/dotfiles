/**
 * Command Code ZDR toggle
 *
 * Command Code's Provider API enforces zero data retention per request with
 * `x-cmd-zdr: 1`. When enabled, every outgoing request to a Command Code host
 * gets that header; when disabled, requests are left untouched.
 *
 * The header is injected at the `fetch` layer instead of through provider
 * configuration so it also covers subagents, title generation, compaction,
 * cache warming, usage probes, and any other request path that bypasses the
 * active chat model.
 *
 * Toggle with `/zdr on|off|toggle|status` or `Alt+Shift+Z`. The choice is
 * persisted in `zdr-state.json` next to the agent config. `CMD_ZDR=1` or
 * `CMD_ZDR=0` overrides the persisted value for one process.
 *
 * ZDR is not free: a model with no ZDR-capable upstream fails with HTTP 422
 * (`cmd_zdr_no_providers`) rather than falling back, and routing may change
 * cost. `OMP_ZDR_HOSTS` overrides the host match list for gateways.
 */
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { homedir } from "node:os";
import { join } from "node:path";

const HEADER = "x-cmd-zdr";
const DEFAULT_HOSTS = "commandcode.ai";
const WRAPPER = Symbol.for("omp.commandcode-zdr.fetch");
const AGENT_DIR = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".omp", "agent");
const STATE_FILE = join(AGENT_DIR, "zdr-state.json");

const state = { enabled: false };
const ZDR_HOSTS = (process.env.OMP_ZDR_HOSTS ?? DEFAULT_HOSTS)
	.split(",")
	.map(value => value.trim())
	.filter(Boolean);

function describe(enabled: boolean): string {
	if (!enabled) return "ZDR OFF — Command Code requests are not tagged.";
	return `ZDR ON — Command Code requests carry ${HEADER}: 1. Models without a ZDR upstream fail with 422 (cmd_zdr_no_providers).`;
}

function installFetchWrapper(): void {
	const global = globalThis as typeof globalThis & {
		[WRAPPER]?: { state: typeof state };
	};
	if (global[WRAPPER]) {
		global[WRAPPER].state = state;
		return;
	}

	const original = globalThis.fetch;
	const wrapper = ((input: RequestInfo | URL, init?: RequestInit) => {
		if (!state.enabled) return original(input, init);

		const url =
			typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
		if (!ZDR_HOSTS.some(host => url.includes(host))) return original(input, init);

		const baseHeaders = init?.headers ?? (input instanceof Request ? input.headers : undefined);
		const headers = new Headers(baseHeaders);
		headers.set(HEADER, "1");
		return original(input, { ...(init ?? {}), headers });
	}) as typeof fetch;

	(wrapper as unknown as Record<symbol, unknown>)[WRAPPER] = { state };
	globalThis.fetch = wrapper;
}

async function loadState(): Promise<void> {
	try {
		const saved = (await Bun.file(STATE_FILE).json()) as { enabled?: unknown };
		if (typeof saved.enabled === "boolean") state.enabled = saved.enabled;
	} catch {
		// No saved state yet.
	}
	if (process.env.CMD_ZDR === "1") state.enabled = true;
	else if (process.env.CMD_ZDR === "0") state.enabled = false;
}

async function persistState(): Promise<void> {
	try {
		await Bun.write(STATE_FILE, `${JSON.stringify({ enabled: state.enabled }, null, 2)}\n`);
	} catch {
		// The toggle still applies to this process when the state cannot be saved.
	}
}

export default async function commandcodeZdr(pi: ExtensionAPI): Promise<void> {
	await loadState();
	installFetchWrapper();

	const setEnabled = async (enabled: boolean, ctx?: ExtensionContext): Promise<void> => {
		state.enabled = enabled;
		await persistState();
		ctx?.ui.notify(describe(enabled), enabled ? "warning" : "info");
	};

	pi.registerCommand("zdr", {
		description: "Toggle strict ZDR headers on Command Code requests",
		handler: async (args, ctx) => {
			const argument = (args ?? "").trim().toLowerCase();
			switch (argument) {
				case "on":
					await setEnabled(true, ctx);
					return;
				case "off":
					await setEnabled(false, ctx);
					return;
				case "toggle":
					await setEnabled(!state.enabled, ctx);
					return;
				case "":
				case "status":
					ctx.ui.notify(describe(state.enabled), "info");
					return;
				default:
					ctx.ui.notify("Usage: /zdr [on|off|status|toggle]", "warning");
			}
		},
	});

	pi.registerShortcut("alt+shift+z", {
		description: "Toggle Command Code ZDR",
		handler: async ctx => setEnabled(!state.enabled, ctx),
	});
}
