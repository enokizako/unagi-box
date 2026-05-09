import { PomodoroAlarm } from "./alarm.js";
import { BoardController } from "./board.js";
import { PanelView } from "./panel-view.js";
import { PomodoroController, type PomodoroMode } from "./pomodoro.js";
import { todayString } from "./tasks.js";
import type { Energy, RankedTask, Task } from "./types/task.js";

const DEFAULT_POMODORO_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const MENU_TITLE = "Unagi Box";
const MENU_IMAGE = "https://img.icons8.com/ios-filled/100/task.png";

class PomodoroPanel {
	private readonly board = new BoardController();
	private userEnergy: Energy = 2;
	private timerMinutes = DEFAULT_POMODORO_MINUTES;
	private breakMinutes = DEFAULT_BREAK_MINUTES;
	private isSyncing = false;
	private readonly view = new PanelView();
	private readonly alarm = new PomodoroAlarm(this.view.flash);
	private readonly pomodoro = new PomodoroController(
		{
			onPhaseStart: (mode, resumed) => this.onPhaseStart(mode, resumed),
			onPhaseComplete: (mode) => this.onPhaseComplete(mode),
			onRunStateChange: (running, mode) => this.onRunStateChange(running, mode),
			onTick: (remainingMs) => this.onTick(remainingMs),
		},
		DEFAULT_POMODORO_MINUTES,
		DEFAULT_BREAK_MINUTES,
	);
	mount() {
		this.view.mount({
			breakMinutes: this.breakMinutes,
			callbacks: {
				onAddTask: () => void this.addTask(),
				onClose: () => this.hide(),
				onCompleteDoing: () => void this.completeDoingTask(),
				onCreateBoard: () => void this.createBoard(),
				onEnergyChange: (energy) => this.changeEnergy(energy),
				onPickAnyTask: () => void this.pickAnyTask(),
				onPickTask: (task) => void this.promoteTaskToDoing(task),
				onPauseToggle: () => this.pausePomodoro(),
				onShowAllTasks: () => this.renderTaskChooser(true),
				onStartToggle: () => void this.togglePomodoro(),
			},
			isPageEditAvailable: this.board.isAvailable(),
			workMinutes: this.timerMinutes,
		});
		this.renderTimer();
		this.renderEnergy();
		this.refreshTimerButtons();
		this.mountPageMenu();
		this.loadEnergyFromBoard();
		this.refreshFocus();
		this.renderTaskChooser();
	}

	private loadEnergyFromBoard() {
		const energy = this.board.loadEnergyFromBoard();
		this.userEnergy = energy ?? 2;
		this.renderEnergy();
	}

	private mountPageMenu() {
		if (!window.scrapbox?.PageMenu?.addMenu) return;
		window.scrapbox.PageMenu.addMenu({
			title: MENU_TITLE,
			image: MENU_IMAGE,
			onClick: () => this.toggleVisible(),
		});
	}

	private toggleVisible() {
		if (this.view.isHidden()) {
			this.show();
			return;
		}
		this.hide();
	}

	private show() {
		this.view.show();
		this.loadEnergyFromBoard();
		this.refreshFocus();
		this.renderTaskChooser();
	}

	private hide() {
		this.view.hide();
	}

	private changeEnergy(energy: Energy) {
		this.userEnergy = energy;
		this.renderEnergy();
		this.refreshFocus();
		this.renderTaskChooser(this.view.chooserSection.open);
		if (!this.board.hasBoard()) return;
		void this.runBoardMutation(() =>
			this.board.syncEnergyLine(this.userEnergy),
		).catch((error) => {
			this.view.status.textContent = toMessage(error);
		});
	}

	private async addTask() {
		if (this.isSyncing) return;
		const title = this.view.titleInput.value.trim();
		if (!title) return;
		const priority = toInt(this.view.priorityInput.value, 3, 1, 5);
		const energy = toInt(this.view.taskEnergyInput.value, 2, 1, 3) as Energy;
		const volume = toInt(this.view.volumeInput.value, 1, 1, 9);
		const dueInput = this.view.dueInput.value.trim();

		const task: Task = {
			status: "todo",
			title,
			priority,
			energy,
			volume,
			created: todayString(),
			due: dueInput || undefined,
		};

		try {
			const createdTitle = await this.runBoardMutation(() =>
				this.board.addTask(task, this.userEnergy),
			);
			this.view.status.textContent = `added: ${createdTitle}`;
			this.view.resetTaskForm();
			this.refreshFocus();
			this.renderTaskChooser();
		} catch (error) {
			this.view.status.textContent = toMessage(error);
		}
	}

	private async createBoard() {
		if (this.isSyncing) return;
		try {
			await this.runBoardMutation(() => this.board.createBoard(this.userEnergy));
			this.view.status.textContent = "board created";
			this.refreshFocus();
			this.renderTaskChooser();
		} catch (error) {
			this.view.status.textContent = toMessage(error);
		}
	}

	private async togglePomodoro() {
		if (this.isSyncing) return;
		if (this.pomodoro.isRunning()) {
			this.stopPomodoro();
			return;
		}

		this.alarm.dismiss();
		if (
			this.pomodoro.getMode() === "work" &&
			!this.board.getCurrentDoingTask(this.userEnergy)
		) {
			const top = this.board.getRankedTasks(this.userEnergy)[0];
			if (!top) {
				this.view.status.textContent = "No next task";
				return;
			}
			await this.promoteTaskToDoing(top);
		}

		void this.alarm.primeAudio();
		this.timerMinutes = toInt(
			this.view.timerMinutesInput.value,
			DEFAULT_POMODORO_MINUTES,
			1,
			180,
		);
		this.breakMinutes = toInt(
			this.view.breakMinutesInput.value,
			DEFAULT_BREAK_MINUTES,
			1,
			60,
		);
		this.view.timerMinutesInput.value = String(this.timerMinutes);
		this.view.breakMinutesInput.value = String(this.breakMinutes);
		this.pomodoro.setDurations(this.timerMinutes, this.breakMinutes);
		this.pomodoro.start();
	}

	private async pickAnyTask() {
		if (this.isSyncing) return;
		this.view.chooserSection.open = true;
		this.renderTaskChooser(true);
	}

	private async completeDoingTask() {
		if (this.isSyncing) return;
		try {
			const completedTitle = await this.runBoardMutation(() =>
				this.board.completeDoingTask(this.userEnergy),
			);
			this.view.status.textContent = `completed: ${completedTitle}`;
			this.refreshFocus();
			this.renderTaskChooser();
		} catch (error) {
			this.view.status.textContent = toMessage(error);
		}
	}

	private async promoteTaskToDoing(target: RankedTask) {
		if (this.isSyncing) return;
		try {
			const pickedTitle = await this.runBoardMutation(() =>
				this.board.promoteTaskToDoing(target, this.userEnergy),
			);
			this.view.status.textContent = `picked: ${pickedTitle}`;
			this.refreshFocus();
			this.renderTaskChooser();
		} catch (error) {
			this.view.status.textContent = toMessage(error);
		}
	}

	private refreshFocus() {
		const hasBoard = this.board.hasBoard();
		this.view.renderFocus({
			hasBoard,
			doing: hasBoard ? this.board.getCurrentDoingTask(this.userEnergy) : null,
			top: hasBoard ? this.board.getRankedTasks(this.userEnergy)[0] : undefined,
		});
	}

	private renderEnergy() {
		this.view.renderEnergy(this.userEnergy);
	}

	private renderTaskChooser(expanded = false) {
		const hasBoard = this.board.hasBoard();
		this.view.renderTaskChooser({
			hasBoard,
			expanded,
			ranked: hasBoard
				? this.board
						.getRankedTasks(this.userEnergy)
						.filter((entry) => entry.task.status !== "done")
				: [],
		});
	}

	private renderTimer(remaining?: number) {
		this.view.renderTimer(
			remaining ?? this.pomodoro.getDisplayRemainingMs(),
			this.pomodoro.getMode(),
		);
	}

	private pausePomodoro() {
		if (this.isSyncing) return;
		if (!this.pomodoro.isRunning()) {
			this.resetPomodoro();
			return;
		}
		if (!this.pomodoro.pause()) return;
		this.view.updateRunState({
			mode: this.pomodoro.getMode(),
			running: this.pomodoro.isRunning(),
		});
		this.refreshTimerButtons();
		this.view.status.textContent =
			this.pomodoro.getMode() === "work" ? "Work paused" : "Break paused";
	}

	private stopPomodoro() {
		if (this.isSyncing) return;
		this.alarm.dismiss();
		this.pomodoro.stop();
		this.view.updateRunState({
			mode: this.pomodoro.getMode(),
			running: this.pomodoro.isRunning(),
		});
		this.refreshTimerButtons();
		this.view.status.textContent = "Timer stopped";
	}

	private resetPomodoro() {
		if (this.isSyncing) return;
		this.alarm.dismiss();
		this.pomodoro.stop();
		this.view.updateRunState({
			mode: this.pomodoro.getMode(),
			running: this.pomodoro.isRunning(),
		});
		this.refreshTimerButtons();
		this.view.status.textContent = "Timer reset";
	}

	private async runBoardMutation<T>(action: () => Promise<T>): Promise<T> {
		const previous = this.view.status.textContent;
		this.isSyncing = true;
		this.refreshInteractionLock();
		this.view.status.textContent = "Syncing with Cosense...";
		try {
			return await action();
		} finally {
			this.isSyncing = false;
			this.refreshInteractionLock();
			if (this.view.status.textContent === "Syncing with Cosense...") {
				this.view.status.textContent = previous;
			}
		}
	}

	private refreshInteractionLock() {
		this.view.setInteractionLocked(this.isSyncing);
		if (!this.isSyncing) {
			this.refreshTimerButtons();
		}
	}

	private refreshTimerButtons() {
		const running = this.pomodoro.isRunning();
		const mode = this.pomodoro.getMode();
		this.view.updateStartButton({ mode, running });
		this.view.updatePauseButton({
			enabled: running || mode !== "work",
			running,
		});
	}

	private onTick(remainingMs: number) {
		this.renderTimer(remainingMs);
	}

	private onRunStateChange(running: boolean, mode: PomodoroMode) {
		this.view.updateRunState({ mode, running });
		this.refreshTimerButtons();
	}

	private onPhaseStart(mode: PomodoroMode, resumed: boolean) {
		this.view.status.textContent = resumed
			? mode === "work"
				? "Work resumed"
				: "Break resumed"
			: mode === "work"
				? "Work started"
				: "Break started";
	}

	private onPhaseComplete(mode: PomodoroMode) {
		void this.alarm.notify();
		if (mode === "break") {
			this.view.status.textContent = "Break complete";
		}
	}
}

function toMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function toInt(
	value: string | null,
	fallback: number,
	min: number,
	max: number,
): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(max, Math.max(min, Math.round(parsed)));
}

function boot() {
	if (document.getElementById("unagi-box-panel")) return;
	new PomodoroPanel().mount();
}

boot();
window.scrapbox?.on?.("page:changed", boot);
