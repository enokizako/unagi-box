import type { Energy, RankedTask } from "./types/task.js";

export function styleActionButton(
	button: HTMLButtonElement,
	background: string,
	color: string,
	fontWeight = "800",
) {
	button.classList.add("ct-button");
	button.style.setProperty("--ct-button-bg", background);
	button.style.setProperty("--ct-button-color", color);
	button.style.setProperty("--ct-button-weight", fontWeight);
}

export function setupCollapsible(section: HTMLDetailsElement, title: string) {
	section.open = false;
	section.className = "ct-details";
	const summary = document.createElement("summary");
	summary.textContent = title;
	summary.className = "ct-summary";
	section.append(summary);
}

export function makeLabeledField(label: string, input: HTMLElement): HTMLElement {
	const wrapper = document.createElement("label");
	wrapper.className = "ct-field";
	const text = document.createElement("div");
	text.textContent = label;
	text.className = "ct-field-label";
	wrapper.append(text, input);
	return wrapper;
}

export function renderFocusSection(
	container: HTMLElement,
	options: {
		hasBoard: boolean;
		doing: RankedTask | null;
		top?: RankedTask;
		createBoardButton: HTMLButtonElement;
	},
) {
	container.innerHTML = "";
	if (!options.hasBoard) {
		const eyebrow = document.createElement("div");
		eyebrow.textContent = "FOCUS";
		eyebrow.className = "ct-focus-kicker";

		const title = document.createElement("div");
		title.textContent = "Create board to start";
		title.className = "ct-focus-title";

		const description = document.createElement("div");
		description.textContent =
			"Board を作ると、ここに「今やること」と次候補が出ます。";
		description.className = "ct-focus-copy";

		const action = document.createElement("div");
		action.className = "ct-focus-action";
		action.append(options.createBoardButton);

		container.append(eyebrow, title, description, action);
		return;
	}

	if (!options.doing && !options.top) {
		container.innerHTML = [
			`<div class="ct-focus-kicker">FOCUS</div>`,
			`<div class="ct-focus-title">No open tasks</div>`,
			`<div class="ct-focus-copy">Add Task から追加するか、Archive を確認してください。</div>`,
		].join("");
		return;
	}

	const lines = [
		`<div class="ct-focus-kicker">FOCUS</div>`,
	];
	if (options.doing) {
		lines.push(
			`<div class="ct-focus-state">DOING</div>`,
			`<div class="ct-focus-task">${escapeHtml(options.doing.task.title)}</div>`,
			`<div class="ct-focus-meta">p:${options.doing.task.priority} e:${options.doing.task.energy} v:${options.doing.task.volume}${options.doing.task.due ? ` | due:${options.doing.task.due}` : ""}</div>`,
		);
	}
	if (options.top) {
		lines.push(
			`<div class="ct-focus-next">👑 NEXT</div>`,
			`<div class="ct-focus-next-task">${escapeHtml(options.top.task.title)}</div>`,
			`<div class="ct-focus-meta">score:${options.top.score.toFixed(1)} p:${options.top.task.priority} e:${options.top.task.energy} v:${options.top.task.volume}${options.top.task.due ? ` | due:${options.top.task.due}` : ""}</div>`,
		);
	}
	container.innerHTML = lines.join("");
}

export function renderTaskChooserSection(
	container: HTMLElement,
	options: {
		hasBoard: boolean;
		expanded: boolean;
		ranked: RankedTask[];
		chooseButton: HTMLButtonElement;
		onPick: (task: RankedTask) => void;
		onExpand: () => void;
	},
) {
	container.innerHTML = "";
	options.chooseButton.textContent = options.expanded
		? "Refresh list"
		: "Show task list";
	container.append(options.chooseButton);

	if (!options.hasBoard) {
		appendMessage(container, "Create board to list tasks");
		return;
	}

	if (options.ranked.length === 0) {
		appendMessage(container, "No open tasks");
		return;
	}

	const list = document.createElement("div");
	list.className = "ct-list";

	const visibleItems = options.expanded
		? options.ranked
		: options.ranked.slice(0, 3);
	for (const entry of visibleItems) {
		const row = document.createElement("button");
		row.className = "ct-task-row";
		row.onclick = () => options.onPick(entry);
		row.innerHTML = [
			`<strong>${escapeHtml(entry.task.title)}</strong>`,
			`score:${entry.score.toFixed(1)} p:${entry.task.priority} e:${entry.task.energy} v:${entry.task.volume}${entry.task.status === "doing" ? " | doing" : ""}`,
		].join("<br>");
		list.append(row);
	}

	container.append(list);

	if (!options.expanded && options.ranked.length > 3) {
		const more = document.createElement("button");
		more.textContent = `Show all (${options.ranked.length})`;
		more.className = "ct-more-button";
		more.onclick = options.onExpand;
		container.append(more);
	}
}

export function renderEnergyButtons(container: HTMLElement, userEnergy: Energy) {
	for (const [index, button] of Array.from(
		container.querySelectorAll("button"),
	).entries()) {
		const level = (index + 1) as Energy;
		button.classList.add("ct-energy-button");
		button.classList.toggle("ct-energy-button-active", level === userEnergy);
	}
}

function appendMessage(container: HTMLElement, message: string) {
	const node = document.createElement("div");
	node.textContent = message;
	node.className = "ct-message";
	container.append(node);
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}
