/**
 * Yolo toggle
 *
 * `/yolo` flips `tools.approvalMode` to `yolo` — auto-approving every tool tier
 * — for the running process only. It is a *runtime setting override* on the
 * process-wide `Settings` singleton, not a persisted write: it outranks global
 * and project config, it is never saved to `config.yml`, and it disappears when
 * the process exits, matching how `--yolo` behaves for a single run.
 *
 * Tools re-read the approval mode per call, so the change takes effect on the
 * next tool call without a restart.
 *
 * Yolo is not a security bypass. `tools.approval` policy rules and
 * `tools.restrictedFolders` still apply, so a configured deny or a restricted
 * folder still prompts or blocks.
 *
 * `/yolo off` (and toggling off) clears the override, restoring whatever the
 * configured layers resolve to. When the configured value is itself `yolo`,
 * clearing would leave yolo in effect, so the override is re-pinned to `write`
 * instead — "off" always leaves yolo mode.
 */
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { lookup, type Setting } from "@oh-my-pi/pi-coding-agent/config/registry";

type ApprovalMode = "always-ask" | "always-ask-cached" | "write" | "yolo";

const SETTING_ID = "tools.approvalMode";
/** Configured-mode fallback when yolo is the persisted value, so "off" always leaves yolo. */
const OFF_FALLBACK: ApprovalMode = "write";

function describe(mode: ApprovalMode, provenance: string): string {
	return provenance === "runtime"
		? `Approval mode: ${mode} (runtime override)`
		: `Approval mode: ${mode} (settings: ${provenance})`;
}

function argumentCompletions(prefix: string) {
	const options = [
		{ value: "on", label: "on", description: "yolo for the rest of this process" },
		{ value: "off", label: "off", description: "clear the override" },
		{ value: "status", label: "status", description: "show the current approval mode" },
	];
	const query = prefix.trim().toLowerCase();
	const matches = options.filter(option => option.value.startsWith(query));
	return matches.length > 0 ? matches : null;
}

export default function yolo(pi: ExtensionAPI): void {
	pi.registerCommand("yolo", {
		description: "yolo approval mode for this process only",
		getArgumentCompletions: argumentCompletions,
		handler: (args, ctx) => {
			const setting = lookup(SETTING_ID) as Setting<ApprovalMode> | undefined;
			if (setting === undefined) {
				ctx.ui.notify("tools.approvalMode is not registered in this omp build", "error");
				return;
			}

			const scope = pi.pi.settings;
			const argument = args.trim().toLowerCase();

			const enable = (): void => {
				setting.override(scope, "yolo");
				ctx.ui.notify(describe(setting.get(scope), setting.provenance(scope)), "warning");
			};

			const disable = (): void => {
				setting.clearOverride(scope);
				if (setting.get(scope) === "yolo") setting.override(scope, OFF_FALLBACK);
				ctx.ui.notify(describe(setting.get(scope), setting.provenance(scope)), "info");
			};

			const report = (): void => {
				ctx.ui.notify(describe(setting.get(scope), setting.provenance(scope)), "info");
			};

			switch (argument) {
				case "":
					if (setting.get(scope) === "yolo") disable();
					else enable();
					return;
				case "on":
					enable();
					return;
				case "off":
					disable();
					return;
				case "status":
					report();
					return;
				default:
					ctx.ui.notify("Usage: /yolo [on|off|status]", "warning");
			}
		},
	});
}
