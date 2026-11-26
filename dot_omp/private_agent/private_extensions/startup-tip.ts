import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import type { UiNode } from "@oh-my-pi/pi-tui";
import { type Block, defineRolePainter, EMPTY_BLOCK, type PaintContext, roleOf } from "@oh-my-pi/pi-tui/term/paint";
import { spaces, visibleWidth } from "@oh-my-pi/pi-tui/text/width";

/** Paint the tip row inside the welcome card, dropping the logo lockup and version. */
function paintTipOnly(node: UiNode, cx: PaintContext): Block {
	const rows: string[] = [];
	for (const child of node.children()) {
		if (roleOf(child) === "omp.welcome") {
			const tip = child.children().find(grandchild => roleOf(grandchild) !== "omp.welcome.lockup");
			if (tip === undefined) continue;
			const block = cx.paint(tip, Math.min(cx.width, 74));
			const widest = block.rows.reduce((max, row) => Math.max(max, visibleWidth(row)), 0);
			const indent = widest < cx.width ? Math.floor((cx.width - widest) / 2) : 0;
			rows.push(...(indent > 0 ? block.rows.map(row => spaces(indent) + row) : block.rows));
			continue;
		}
		rows.push(...cx.paint(child, cx.width).rows);
	}
	return rows.length > 0 ? { rows } : EMPTY_BLOCK;
}

export default function startupTip(_pi: ExtensionAPI): void {
	// The card role is owned by the built-in welcome style, but this wrapper
	// role is not, so registering here cannot lose a load-order race.
	defineRolePainter("col", "omp.welcome.block", paintTipOnly);
}
