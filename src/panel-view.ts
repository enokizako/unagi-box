import type { PomodoroMode } from "./pomodoro.js";
import { injectPanelStyles } from "./styles.js";
import type { Energy, RankedTask } from "./types/task.js";
import {
	makeLabeledField,
	renderEnergyButtons,
	renderFocusSection,
	renderTaskChooserSection,
	styleActionButton,
	setupCollapsible,
} from "./ui.js";

interface PanelViewCallbacks {
	onAddTask: () => void;
	onClose: () => void;
	onCompleteDoing: () => void;
	onCreateBoard: () => void;
	onEnergyChange: (energy: Energy) => void;
	onPickAnyTask: () => void;
	onPickTask: (task: RankedTask) => void;
	onStartToggle: () => void;
	onPauseToggle: () => void;
	onShowAllTasks: () => void;
}

interface RenderFocusOptions {
	hasBoard: boolean;
	doing: RankedTask | null;
	top?: RankedTask;
}

interface RenderTaskChooserOptions {
	hasBoard: boolean;
	expanded: boolean;
	ranked: RankedTask[];
}

export class PanelView {
	private dragState?: { offsetX: number; offsetY: number };
	private callbacks?: PanelViewCallbacks;

	readonly flash = document.createElement("div");
	readonly root = document.createElement("aside");
	readonly timer = document.createElement("div");
	readonly focus = document.createElement("div");
	readonly status = document.createElement("div");
	readonly energy = document.createElement("div");
	readonly primaryActions = document.createElement("div");
	readonly timerSection = document.createElement("details");
	readonly form = document.createElement("section");
	readonly formSection = document.createElement("details");
	readonly chooser = document.createElement("section");
	readonly chooserSection = document.createElement("details");
	readonly titleInput = document.createElement("input");
	readonly priorityInput = document.createElement("input");
	readonly taskEnergyInput = document.createElement("select");
	readonly volumeInput = document.createElement("input");
	readonly dueInput = document.createElement("input");
	readonly duePickerInput = document.createElement("input");
	readonly duePickerButton = document.createElement("button");
	readonly timerMinutesInput = document.createElement("input");
	readonly breakMinutesInput = document.createElement("input");
	readonly createBoardButton = document.createElement("button");
	readonly addButton = document.createElement("button");
	readonly chooseButton = document.createElement("button");
	readonly startButton = document.createElement("button");
	readonly pauseButton = document.createElement("button");
	readonly completeButton = document.createElement("button");
	readonly closeButton = document.createElement("button");

	mount(options: {
		breakMinutes: number;
		callbacks: PanelViewCallbacks;
		isPageEditAvailable: boolean;
		workMinutes: number;
	}) {
		this.callbacks = options.callbacks;
		injectPanelStyles();
		this.root.id = "unagi-box-panel";
		this.root.innerHTML = "";
		this.setupBaseStyles(options.isPageEditAvailable);

		const header = this.buildHeader();
		setupCollapsible(this.timerSection, "Timer Settings");
		setupCollapsible(this.formSection, "Add Task");
		setupCollapsible(this.chooserSection, "Pick Any Task");

		this.buildEnergyButtons();
		this.buildTimerSettings(options.workMinutes, options.breakMinutes);
		this.buildTaskForm();
		this.buildTaskChooser();
		this.setupButtons();
		this.applyButtonStyles();

		this.root.append(
			header,
			this.timer,
			this.primaryActions,
			this.timerSection,
			this.focus,
			this.energy,
			this.formSection,
			this.chooserSection,
			this.status,
		);
		this.primaryActions.append(
			this.startButton,
			this.pauseButton,
			this.completeButton,
		);
		document.body.append(this.flash);
		document.body.append(this.root);
	}

	hide() {
		this.root.style.display = "none";
	}

	isHidden(): boolean {
		return this.root.style.display === "none";
	}

	resetTaskForm() {
		this.titleInput.value = "";
		this.priorityInput.value = "3";
		this.taskEnergyInput.value = "2";
		this.volumeInput.value = "1";
		this.dueInput.value = "";
		this.titleInput.focus();
	}

	renderEnergy(userEnergy: Energy) {
		renderEnergyButtons(this.energy, userEnergy);
	}

	renderFocus(options: RenderFocusOptions) {
		renderFocusSection(this.focus, {
			...options,
			createBoardButton: this.createBoardButton,
		});
	}

	renderTaskChooser(options: RenderTaskChooserOptions) {
		renderTaskChooserSection(this.chooser, {
			...options,
			chooseButton: this.chooseButton,
			onPick: (entry) => this.callbacks?.onPickTask(entry),
			onExpand: () => this.callbacks?.onShowAllTasks(),
		});
	}

	renderTimer(remainingMs: number, mode: PomodoroMode) {
		const minutes = Math.floor(remainingMs / 60000)
			.toString()
			.padStart(2, "0");
		const seconds = Math.floor((remainingMs % 60000) / 1000)
			.toString()
			.padStart(2, "0");
		this.timer.textContent = `${minutes}:${seconds}`;
		this.timer.classList.toggle("ct-timer-work", mode === "work");
		this.timer.classList.toggle("ct-timer-break", mode === "break");
	}

	setInteractionLocked(disabled: boolean) {
		for (const element of [
			this.createBoardButton,
			this.addButton,
			this.chooseButton,
			this.startButton,
			this.completeButton,
			this.titleInput,
			this.priorityInput,
			this.taskEnergyInput,
			this.volumeInput,
			this.dueInput,
			this.duePickerButton,
			this.timerMinutesInput,
			this.breakMinutesInput,
		] as Array<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>) {
			element.disabled = disabled;
		}

		for (const button of Array.from(
			this.energy.querySelectorAll("button"),
		) as HTMLButtonElement[]) {
			button.disabled = disabled;
			button.style.cursor = disabled ? "wait" : "pointer";
			button.style.opacity = disabled ? "0.6" : "1";
		}

		this.pauseButton.disabled = disabled || this.pauseButton.disabled;
		if (disabled) {
			this.pauseButton.style.cursor = "wait";
			this.pauseButton.style.opacity = "0.6";
		}
	}

	show() {
		this.root.style.display = "block";
	}

	updatePauseButton(options: { enabled: boolean; running: boolean }) {
		styleActionButton(
			this.pauseButton,
			options.running ? "#7a4d11" : options.enabled ? "#48637a" : "#d8d0c4",
			options.enabled ? "#fffaf2" : "#8d8172",
		);
		this.pauseButton.disabled = !options.enabled;
		this.pauseButton.style.cursor = options.enabled ? "pointer" : "not-allowed";
		this.pauseButton.style.boxShadow = options.enabled
			? "0 10px 18px rgba(42,33,24,0.14)"
			: "none";
		this.pauseButton.style.opacity = "1";
	}

	updateRunState(options: { mode: PomodoroMode; running: boolean }) {
		this.startButton.textContent = options.running ? "■" : "▶";
		this.startButton.title = options.running
			? "Stop"
			: options.mode === "work"
				? "Start"
				: "Resume";
		this.pauseButton.textContent = options.running ? "⏸" : "↺";
		this.pauseButton.title = options.running ? "Pause" : "Reset";
	}

	updateStartButton(options: { mode: PomodoroMode; running: boolean }) {
		const background = options.running
			? options.mode === "work"
				? "#a5472c"
				: "#7a4d11"
			: "#163d38";
		styleActionButton(this.startButton, background, "#fffaf2");
	}

	private applyButtonStyles() {
		styleActionButton(this.createBoardButton, "#2d7a68", "#fffaf2", "700");
		styleActionButton(this.addButton, "#2a62a7", "#fffaf2", "700");
		styleActionButton(this.chooseButton, "#48637a", "#fffaf2", "700");
		styleActionButton(this.completeButton, "#1f8a56", "#fffaf2");
	}

	private buildEnergyButtons() {
		const energyLabels: Record<Energy, string> = {
			1: "Low",
			2: "Mid",
			3: "High",
		};

		for (const level of [1, 2, 3] as const) {
			const button = document.createElement("button");
			button.textContent = energyLabels[level];
			button.onclick = () => this.callbacks?.onEnergyChange(level);
			this.energy.append(button);
		}
	}

	private buildHeader(): HTMLElement {
		const header = document.createElement("div");
		header.className = "ct-header";

		const title = document.createElement("div");
		title.textContent = "Unagi Box";
		title.className = "ct-title";

		this.closeButton.textContent = "Close";
		this.closeButton.className = "ct-close";
		this.closeButton.onclick = () => this.callbacks?.onClose();
		header.append(title, this.closeButton);
		this.enableDragging(header);
		return header;
	}

	private buildTaskChooser() {
		this.chooser.className = "ct-surface ct-chooser";
		this.chooserSection.append(this.chooser);
	}

	private buildTaskForm() {
		this.form.className = "ct-surface";

		this.titleInput.placeholder = "Task title";
		this.titleInput.type = "text";
		this.priorityInput.type = "number";
		this.priorityInput.min = "1";
		this.priorityInput.max = "5";
		this.priorityInput.value = "3";

		for (const option of [
			{ value: "1", label: "Low" },
			{ value: "2", label: "Mid" },
			{ value: "3", label: "High" },
		]) {
			const element = document.createElement("option");
			element.value = option.value;
			element.textContent = option.label;
			this.taskEnergyInput.append(element);
		}
		this.taskEnergyInput.value = "2";

		this.volumeInput.type = "number";
		this.volumeInput.min = "1";
		this.volumeInput.max = "9";
		this.volumeInput.value = "1";
		this.dueInput.type = "text";
		this.dueInput.placeholder = "YYYY-MM-DD";
		this.dueInput.inputMode = "numeric";

		this.setupDuePicker();
		this.styleInputs([
			this.titleInput,
			this.priorityInput,
			this.taskEnergyInput,
			this.volumeInput,
			this.dueInput,
		]);

		const dueField = document.createElement("div");
		dueField.className = "ct-due-field";
		dueField.append(this.dueInput, this.duePickerButton, this.duePickerInput);

		const titleRow = document.createElement("div");
		titleRow.className = "ct-title-row";
		titleRow.append(makeLabeledField("Title", this.titleInput));

		const grid = document.createElement("div");
		grid.className = "ct-grid-2";
		grid.append(
			makeLabeledField("Priority", this.priorityInput),
			makeLabeledField("Energy", this.taskEnergyInput),
			makeLabeledField("Volume", this.volumeInput),
			makeLabeledField("Due", dueField),
		);

		this.form.append(titleRow, grid, this.addButton);
		this.formSection.append(this.form);
	}

	private buildTimerSettings(workMinutes: number, breakMinutes: number) {
		const body = document.createElement("section");
		body.className = "ct-surface";

		this.timerMinutesInput.type = "number";
		this.timerMinutesInput.min = "1";
		this.timerMinutesInput.max = "180";
		this.timerMinutesInput.value = String(workMinutes);
		this.breakMinutesInput.type = "number";
		this.breakMinutesInput.min = "1";
		this.breakMinutesInput.max = "60";
		this.breakMinutesInput.value = String(breakMinutes);
		this.styleInputs([this.timerMinutesInput, this.breakMinutesInput]);

		const grid = document.createElement("div");
		grid.className = "ct-grid-2";
		grid.append(
			makeLabeledField("Work", this.timerMinutesInput),
			makeLabeledField("Break", this.breakMinutesInput),
		);
		body.append(grid);
		this.timerSection.append(body);
	}

	private enableDragging(handle: HTMLElement) {
		handle.addEventListener("pointerdown", (event) => {
			const target = event.target as HTMLElement;
			if (target.closest("button, input, select, summary")) return;
			const rect = this.root.getBoundingClientRect();
			this.dragState = {
				offsetX: event.clientX - rect.left,
				offsetY: event.clientY - rect.top,
			};
			handle.setPointerCapture(event.pointerId);
		});

		handle.addEventListener("pointermove", (event) => {
			if (!this.dragState) return;
			const left = Math.min(
				Math.max(8, event.clientX - this.dragState.offsetX),
				window.innerWidth - this.root.offsetWidth - 8,
			);
			const top = Math.min(
				Math.max(8, event.clientY - this.dragState.offsetY),
				window.innerHeight - this.root.offsetHeight - 8,
			);
			this.root.style.left = `${left}px`;
			this.root.style.top = `${top}px`;
		});

		const stopDragging = () => {
			this.dragState = undefined;
		};
		handle.addEventListener("pointerup", stopDragging);
		handle.addEventListener("pointercancel", stopDragging);
	}

	private setupBaseStyles(isPageEditAvailable: boolean) {
		this.flash.className = "ct-flash";
		this.focus.className = "ct-focus";
		this.timer.className = "ct-timer ct-timer-work";
		this.status.textContent = isPageEditAvailable
			? "Ready"
			: "Page edit API unavailable";
		this.status.className = "ct-status";
		this.energy.className = "ct-energy";
		this.primaryActions.className = "ct-primary-actions";
	}

	private setupButtons() {
		this.createBoardButton.textContent = "Create board";
		this.addButton.textContent = "Add";
		this.chooseButton.textContent = "Pick any task";
		this.startButton.textContent = "▶";
		this.startButton.title = "Start";
		this.pauseButton.textContent = "⏸";
		this.pauseButton.title = "Pause";
		this.completeButton.textContent = "✓";
		this.completeButton.title = "Complete doing";
		this.createBoardButton.onclick = () => this.callbacks?.onCreateBoard();
		this.addButton.onclick = () => this.callbacks?.onAddTask();
		this.startButton.onclick = () => this.callbacks?.onStartToggle();
		this.pauseButton.onclick = () => this.callbacks?.onPauseToggle();
		this.chooseButton.onclick = () => this.callbacks?.onPickAnyTask();
		this.completeButton.onclick = () => this.callbacks?.onCompleteDoing();
	}

	private setupDuePicker() {
		this.duePickerInput.type = "date";
		this.duePickerInput.tabIndex = -1;
		this.duePickerInput.value = "";
		this.duePickerInput.className = "ct-hidden-date";
		this.duePickerInput.addEventListener("input", () => {
			this.dueInput.value = this.duePickerInput.value;
		});

		this.duePickerButton.textContent = "📅";
		this.duePickerButton.type = "button";
		this.duePickerButton.title = "Open calendar";
		this.duePickerButton.className = "ct-date-button";
		this.duePickerButton.onclick = () => {
			this.duePickerInput.value = this.dueInput.value;
			if ("showPicker" in this.duePickerInput) {
				this.duePickerInput.showPicker();
			} else {
				this.dueInput.focus();
			}
		};
	}

	private styleInputs(inputs: HTMLElement[]) {
		for (const input of inputs) {
			input.classList.add("ct-input");
		}
	}
}
