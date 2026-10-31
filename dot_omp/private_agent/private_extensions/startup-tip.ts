import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { WelcomeComponent } from "@oh-my-pi/pi-tui/prompt/welcome";

interface PatchableWelcome {
	render(termWidth: number): readonly string[];
	__ompTipOnly?: boolean;
}

export default function startupTip(_pi: ExtensionAPI): void {
	const proto = WelcomeComponent.prototype as unknown as PatchableWelcome;
	if (proto.__ompTipOnly) return;

	const render = proto.render;
	proto.render = function (this: unknown, termWidth: number) {
		const lines = render.call(this, termWidth);
		// The banner is logo rows, a blank line, then the centered tip. Keep only
		// the tip so the start screen drops the logo without losing the tip.
		const tipAt = lines.findIndex(line => line.includes("Tip: "));
		return tipAt === -1 ? [] : lines.slice(tipAt);
	};
	proto.__ompTipOnly = true;
}
