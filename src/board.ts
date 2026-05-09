import { CosenseWriter } from "./cosense.js";
import {
  formatCrownedTaskLine,
  formatIndentedTaskLine,
  parseTaskLine,
  scoreTask,
  todayString,
} from "./tasks.js";
import type { Energy, RankedTask, Task, TaskEntry } from "./types/task.js";

export const SECTION_FOCUS = "Focus";
export const SECTION_INBOX = "Inbox";
export const SECTION_ARCHIVE = "Archive";
export const ENERGY_PREFIX = " Energy:";

export interface Sections {
  inbox: number;
  focus: number;
  archive: number;
}

export class BoardController {
  constructor(private readonly writer = new CosenseWriter()) {}

  isAvailable(): boolean {
    return this.writer.isAvailable();
  }

  async addTask(task: Task, userEnergy: Energy): Promise<string> {
    const sections = this.requireSections();
    await this.writer.insertLine(sections.inbox + 1, formatIndentedTaskLine(task));
    await this.refreshInboxCrown(userEnergy);
    return task.title;
  }

  async createBoard(userEnergy: Energy): Promise<void> {
    const sections = this.getSections();
    if (sections.focus >= 0 || sections.inbox >= 0 || sections.archive >= 0) {
      throw new Error("board already exists");
    }

    const index = this.writer.getCurrentLines().length;
    await this.writer.insertLine(index, SECTION_FOCUS);
    await this.writer.insertLine(index + 1, `${ENERGY_PREFIX} ${this.getEnergyLabel(userEnergy)}`);
    await this.writer.insertLine(index + 2, " No doing task");
    await this.writer.insertLine(index + 3, SECTION_INBOX);
    await this.writer.insertLine(index + 4, SECTION_ARCHIVE);
  }

  async completeDoingTask(userEnergy: Energy): Promise<string> {
    const focusTask = this.getFocusTask();
    if (!focusTask || focusTask.status !== "doing") {
      throw new Error("doing task not found");
    }

    const sections = this.requireSections();
    const inboxDoingLineIndex = this.findInboxLineIndex(focusTask, "doing");
    await this.writer.insertLine(
      sections.archive + 1,
      formatIndentedTaskLine({ ...focusTask, status: "done" }),
    );
    if (inboxDoingLineIndex >= 0) {
      const updatedSections = this.requireSections();
      await this.removeInboxLine(inboxDoingLineIndex, updatedSections.archive);
    }
    await this.setFocusTask(null);
    await this.refreshInboxCrown(userEnergy);
    return focusTask.title;
  }

  async promoteTaskToDoing(target: RankedTask, userEnergy: Energy): Promise<string> {
    const selected = parseTaskLine(this.writer.getCurrentLines()[target.lineIndex]?.text ?? "");
    if (!selected) {
      throw new Error("target task not found");
    }

    const currentDoing = this.getFocusTask();
    if (currentDoing?.status === "doing") {
      const currentDoingLineIndex = this.findInboxLineIndex(currentDoing, "doing");
      if (currentDoingLineIndex >= 0) {
        await this.writer.updateLine(
          currentDoingLineIndex,
          formatIndentedTaskLine({ ...currentDoing, status: "todo" }),
        );
      }
    }

    await this.writer.updateLine(
      target.lineIndex,
      formatIndentedTaskLine({ ...selected, status: "doing" }),
    );
    await this.setFocusTask({ ...selected, status: "doing" });
    await this.refreshInboxCrown(userEnergy);
    return selected.title;
  }

  getCurrentDoingTask(userEnergy: Energy): RankedTask | null {
    const task = this.getFocusTask();
    if (!task || task.status !== "doing") return null;
    return {
      lineIndex: this.getFocusTaskLineIndex(),
      task,
      score: scoreTask(task, userEnergy, todayString()),
    };
  }

  getRankedTasks(userEnergy: Energy): RankedTask[] {
    const today = todayString();
    return this.getInboxEntries()
      .filter((entry) => entry.task.status === "todo")
      .map((entry) => ({
        lineIndex: entry.lineIndex,
        task: entry.task,
        score: scoreTask(entry.task, userEnergy, today),
      }))
      .sort((a, b) => b.score - a.score);
  }

  getSections(): Sections {
    const lines = this.writer.getCurrentLines();
    return {
      inbox: lines.findIndex((line) => line.text === SECTION_INBOX),
      focus: lines.findIndex((line) => line.text === SECTION_FOCUS),
      archive: lines.findIndex((line) => line.text === SECTION_ARCHIVE),
    };
  }

  hasBoard(): boolean {
    const sections = this.getSections();
    return sections.focus >= 0 && sections.inbox >= 0 && sections.archive >= 0;
  }

  loadEnergyFromBoard(): Energy | null {
    if (!this.hasBoard()) return null;
    const sections = this.requireSections();
    const line = this.writer.getCurrentLines()[sections.focus + 1]?.text ?? "";
    if (!line.startsWith(ENERGY_PREFIX)) return null;
    return this.parseEnergyLabel(line.slice(ENERGY_PREFIX.length));
  }

  async syncEnergyLine(userEnergy: Energy): Promise<void> {
    const sections = this.requireSections();
    const expected = `${ENERGY_PREFIX} ${this.getEnergyLabel(userEnergy)}`;
    if (this.writer.getCurrentLines()[sections.focus + 1]?.text !== expected) {
      await this.writer.updateLine(sections.focus + 1, expected);
    }
    await this.refreshInboxCrown(userEnergy);
  }

  async syncFocusSection(userEnergy: Energy): Promise<void> {
    await this.syncEnergyLine(userEnergy);
    const focusTask = this.getFocusTask();
    await this.setFocusTask(focusTask && focusTask.status === "doing" ? focusTask : null);
    await this.refreshInboxCrown(userEnergy);
  }

  private getInboxEntries(): TaskEntry[] {
    const sections = this.requireSections();
    const entries: TaskEntry[] = [];
    const lines = this.writer.getCurrentLines();
    for (let lineIndex = sections.inbox + 1; lineIndex < sections.archive; lineIndex++) {
      const task = parseTaskLine(lines[lineIndex]?.text ?? "");
      if (!task) continue;
      entries.push({ lineIndex, task });
    }
    return entries;
  }

  private getFocusTask(): Task | null {
    const line = this.writer.getCurrentLines()[this.getFocusTaskLineIndex()]?.text ?? "";
    return parseTaskLine(line);
  }

  private async setFocusTask(task: Task | null): Promise<void> {
    const focusLineIndex = this.getFocusTaskLineIndex();
    const desired = task ? formatIndentedTaskLine(task) : " No doing task";
    if (this.writer.getCurrentLines()[focusLineIndex]?.text !== desired) {
      await this.writer.updateLine(focusLineIndex, desired);
    }
  }

  private async removeInboxLine(lineIndex: number, archiveIndex: number): Promise<void> {
    const lines = this.writer.getCurrentLines();
    for (let index = lineIndex; index < archiveIndex - 1; index++) {
      await this.writer.updateLine(index, lines[index + 1]?.text ?? "");
    }
    await this.writer.updateLine(archiveIndex - 1, "");
  }

  private findInboxLineIndex(task: Task, status?: Task["status"]): number {
    for (const entry of this.getInboxEntries()) {
      if (status && entry.task.status !== status) continue;
      if (this.isSameTask(entry.task, task)) {
        return entry.lineIndex;
      }
    }
    return -1;
  }

  private async refreshInboxCrown(userEnergy: Energy): Promise<void> {
    const top = this.getRankedTasks(userEnergy)[0];
    const currentCrownLineIndex = this.findCurrentCrownLineIndex();

    if (!top) {
      if (currentCrownLineIndex >= 0) {
        const currentTask = parseTaskLine(
          this.writer.getCurrentLines()[currentCrownLineIndex]?.text ?? "",
        );
        if (currentTask) {
          await this.writer.updateLine(
            currentCrownLineIndex,
            formatIndentedTaskLine(currentTask),
          );
        }
      }
      return;
    }

    if (currentCrownLineIndex >= 0 && currentCrownLineIndex !== top.lineIndex) {
      const currentTask = parseTaskLine(
        this.writer.getCurrentLines()[currentCrownLineIndex]?.text ?? "",
      );
      if (currentTask) {
        await this.writer.updateLine(
          currentCrownLineIndex,
          formatIndentedTaskLine(currentTask),
        );
      }
    }

    const topTask = parseTaskLine(this.writer.getCurrentLines()[top.lineIndex]?.text ?? "");
    if (!topTask) return;
    const crowned = formatCrownedTaskLine(topTask);
    if (this.writer.getCurrentLines()[top.lineIndex]?.text !== crowned) {
      await this.writer.updateLine(top.lineIndex, crowned);
    }
  }

  private findCurrentCrownLineIndex(): number {
    const sections = this.requireSections();
    const lines = this.writer.getCurrentLines();
    for (let lineIndex = sections.inbox + 1; lineIndex < sections.archive; lineIndex++) {
      if ((lines[lineIndex]?.text ?? "").trimStart().startsWith("👑")) {
        return lineIndex;
      }
    }
    return -1;
  }

  private isSameTask(a: Task, b: Task): boolean {
    return (
      a.title === b.title &&
      a.priority === b.priority &&
      a.energy === b.energy &&
      a.volume === b.volume &&
      a.created === b.created &&
      a.due === b.due
    );
  }

  private getEnergyLabel(energy: Energy): string {
    return energy === 1 ? "Low" : energy === 2 ? "Mid" : "High";
  }

  private getFocusTaskLineIndex(sections = this.requireSections()): number {
    const line = this.writer.getCurrentLines()[sections.focus + 1]?.text ?? "";
    return line.startsWith(ENERGY_PREFIX) ? sections.focus + 2 : sections.focus + 1;
  }

  private parseEnergyLabel(value: string): Energy {
    const normalized = value.trim().toLowerCase();
    if (normalized === "low") return 1;
    if (normalized === "high") return 3;
    return 2;
  }

  private requireSections(): Sections {
    const sections = this.getSections();
    if (sections.focus < 0 || sections.inbox < 0 || sections.archive < 0) {
      throw new Error("Board not found. Run Create board first.");
    }
    return sections;
  }
}
