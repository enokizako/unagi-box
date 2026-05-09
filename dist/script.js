// src/alarm.ts
var PomodoroAlarm = class {
  constructor(flash) {
    this.flash = flash;
  }
  flash;
  audioContext;
  titleTimerId;
  originalTitle;
  soundRunId = 0;
  async primeAudio() {
    if (this.audioContext) return;
    if (!("AudioContext" in window)) return;
    this.audioContext = new window.AudioContext();
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }
  async notify() {
    this.dismiss();
    this.startTitleBlink();
    this.flashScreen();
    await this.playAlarm(++this.soundRunId);
  }
  dismiss() {
    this.soundRunId++;
    if (this.titleTimerId !== void 0) {
      window.clearInterval(this.titleTimerId);
      this.titleTimerId = void 0;
    }
    if (this.originalTitle !== void 0) {
      document.title = this.originalTitle;
      this.originalTitle = void 0;
    }
  }
  startTitleBlink() {
    this.originalTitle = document.title;
    let visible = false;
    this.titleTimerId = window.setInterval(() => {
      visible = !visible;
      document.title = visible ? "Time's up - Unagi Box" : this.originalTitle ?? document.title;
    }, 700);
  }
  flashScreen() {
    this.flash.animate(
      [
        { opacity: "0" },
        { opacity: "1", offset: 0.15 },
        { opacity: "0.12", offset: 0.5 },
        { opacity: "1", offset: 0.78 },
        { opacity: "0" }
      ],
      {
        duration: 1500,
        easing: "ease-out"
      }
    );
  }
  async playAlarm(runId) {
    await this.primeAudio();
    if (!this.audioContext) return;
    const context = this.audioContext;
    if (context.state === "suspended") {
      await context.resume();
    }
    for (let repeat = 0; repeat < 4; repeat++) {
      if (runId !== this.soundRunId) return;
      this.playAlarmPhrase(context);
      await sleep(950);
    }
  }
  playAlarmPhrase(context) {
    const startAt = context.currentTime;
    const notes = [
      { time: 0, frequency: 880, duration: 0.2 },
      { time: 0.24, frequency: 1174, duration: 0.2 },
      { time: 0.48, frequency: 1568, duration: 0.42 }
    ];
    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(1e-4, startAt + note.time);
      gain.gain.exponentialRampToValueAtTime(0.35, startAt + note.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        1e-4,
        startAt + note.time + note.duration
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt + note.time);
      oscillator.stop(startAt + note.time + note.duration + 0.03);
    }
  }
};
function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

// src/cosense.ts
var CosenseWriter = class {
  get api() {
    return window.cosense?.Page;
  }
  isAvailable() {
    return Boolean(this.api);
  }
  requireApi() {
    const api = this.api;
    if (!api) {
      throw new Error("Cosense Page Edit API is not available.");
    }
    return api;
  }
  async appendLine(text) {
    const index = this.getCurrentLines().length;
    this.requireApi().insertLine(text, index);
    await this.requireApi().waitForSave();
  }
  async insertLine(index, text) {
    this.requireApi().insertLine(text, index);
    await this.requireApi().waitForSave();
  }
  async updateLine(index, text) {
    this.requireApi().updateLine(text, index);
    await this.requireApi().waitForSave();
  }
  async clearLine(index) {
    this.requireApi().updateLine("", index);
    await this.requireApi().waitForSave();
  }
  getCurrentLines() {
    return window.scrapbox?.Page?.lines ?? [];
  }
};

// src/tasks.ts
var TASK_PATTERN = /^\s*(?:(?<done>✅)|(?<doing>👣)|(?<crown>👑))?(?:\[(?<bracketTitle>.+?)\]|(?<plainTitle>.+?))\s+\| p:(?<priority>\d+)\s+\| e:(?<energy>[123])\s+\| v:(?<volume>\d+)\s+\| c:(?<created>\d{4}-\d{2}-\d{2})(?:\s+\| d:(?<due>\d{4}-\d{2}-\d{2}))?$/;
function parseTaskLine(text) {
  const match = TASK_PATTERN.exec(text);
  if (!match?.groups) return null;
  const status = match.groups.done === "\u2705" ? "done" : match.groups.doing === "\u{1F463}" ? "doing" : "todo";
  return {
    status,
    title: match.groups.bracketTitle ?? match.groups.plainTitle,
    priority: Number(match.groups.priority),
    energy: Number(match.groups.energy),
    volume: Number(match.groups.volume),
    created: match.groups.created,
    due: match.groups.due || void 0,
    bracketed: Boolean(match.groups.bracketTitle)
  };
}
function formatTaskLine(task, options = {}) {
  const statusToken = getStatusToken(task, options);
  const due = task.due ? ` | d:${task.due}` : "";
  const indent = options.indent ? " " : "";
  const title = task.bracketed ? `[${task.title}]` : task.title;
  return `${indent}${statusToken}${title} | p:${task.priority} | e:${task.energy} | v:${task.volume} | c:${task.created}${due}`;
}
function formatIndentedTaskLine(task) {
  return formatTaskLine(task, { indent: true });
}
function formatCrownedTaskLine(task) {
  return formatTaskLine(task, { crown: true, indent: true });
}
function todayString(now = /* @__PURE__ */ new Date()) {
  return now.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  const start = Date.parse(`${a}T00:00:00Z`);
  const end = Date.parse(`${b}T00:00:00Z`);
  return Math.round((end - start) / 864e5);
}
function scoreTask(task, userEnergy, today = todayString()) {
  const ageDays = Math.max(daysBetween(task.created, today), 0);
  const urgencyBonus = scoreUrgency(task.due, today);
  const energyPenalty = Math.abs(userEnergy - task.energy) * 5;
  const sizePenalty = Math.max(task.volume - 1, 0) * 2;
  return task.priority * (10 + urgencyBonus) + ageDays - energyPenalty - sizePenalty;
}
function scoreUrgency(due, today) {
  if (!due) return 0;
  const daysLeft = daysBetween(today, due);
  if (daysLeft < 0) return 60 + Math.abs(daysLeft) * 15;
  if (daysLeft === 0) return 60;
  if (daysLeft <= 7) return (7 - daysLeft) / 6 * 30;
  return 0;
}
function getStatusToken(task, options) {
  if (options.crown) return "\u{1F451}";
  if (task.status === "done") return "\u2705";
  if (task.status === "doing") return "\u{1F463}";
  return "";
}

// src/board.ts
var SECTION_FOCUS = "Focus";
var SECTION_INBOX = "Inbox";
var SECTION_ARCHIVE = "Archive";
var ENERGY_PREFIX = " Energy:";
var BoardController = class {
  constructor(writer = new CosenseWriter()) {
    this.writer = writer;
  }
  writer;
  isAvailable() {
    return this.writer.isAvailable();
  }
  async addTask(task, userEnergy) {
    const sections = this.requireSections();
    await this.writer.insertLine(sections.inbox + 1, formatIndentedTaskLine(task));
    await this.refreshInboxCrown(userEnergy);
    return task.title;
  }
  async createBoard(userEnergy) {
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
  async completeDoingTask(userEnergy) {
    const focusTask = this.getFocusTask();
    if (!focusTask || focusTask.status !== "doing") {
      throw new Error("doing task not found");
    }
    const sections = this.requireSections();
    const inboxDoingLineIndex = this.findInboxLineIndex(focusTask, "doing");
    await this.writer.insertLine(
      sections.archive + 1,
      formatIndentedTaskLine({ ...focusTask, status: "done" })
    );
    if (inboxDoingLineIndex >= 0) {
      const updatedSections = this.requireSections();
      await this.removeInboxLine(inboxDoingLineIndex, updatedSections.archive);
    }
    await this.setFocusTask(null);
    await this.refreshInboxCrown(userEnergy);
    return focusTask.title;
  }
  async promoteTaskToDoing(target, userEnergy) {
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
          formatIndentedTaskLine({ ...currentDoing, status: "todo" })
        );
      }
    }
    await this.writer.updateLine(
      target.lineIndex,
      formatIndentedTaskLine({ ...selected, status: "doing" })
    );
    await this.setFocusTask({ ...selected, status: "doing" });
    await this.refreshInboxCrown(userEnergy);
    return selected.title;
  }
  getCurrentDoingTask(userEnergy) {
    const task = this.getFocusTask();
    if (!task || task.status !== "doing") return null;
    return {
      lineIndex: this.getFocusTaskLineIndex(),
      task,
      score: scoreTask(task, userEnergy, todayString())
    };
  }
  getRankedTasks(userEnergy) {
    const today = todayString();
    return this.getInboxEntries().filter((entry) => entry.task.status === "todo").map((entry) => ({
      lineIndex: entry.lineIndex,
      task: entry.task,
      score: scoreTask(entry.task, userEnergy, today)
    })).sort((a, b) => b.score - a.score);
  }
  getSections() {
    const lines = this.writer.getCurrentLines();
    return {
      inbox: lines.findIndex((line) => line.text === SECTION_INBOX),
      focus: lines.findIndex((line) => line.text === SECTION_FOCUS),
      archive: lines.findIndex((line) => line.text === SECTION_ARCHIVE)
    };
  }
  hasBoard() {
    const sections = this.getSections();
    return sections.focus >= 0 && sections.inbox >= 0 && sections.archive >= 0;
  }
  loadEnergyFromBoard() {
    if (!this.hasBoard()) return null;
    const sections = this.requireSections();
    const line = this.writer.getCurrentLines()[sections.focus + 1]?.text ?? "";
    if (!line.startsWith(ENERGY_PREFIX)) return null;
    return this.parseEnergyLabel(line.slice(ENERGY_PREFIX.length));
  }
  async syncEnergyLine(userEnergy) {
    const sections = this.requireSections();
    const expected = `${ENERGY_PREFIX} ${this.getEnergyLabel(userEnergy)}`;
    if (this.writer.getCurrentLines()[sections.focus + 1]?.text !== expected) {
      await this.writer.updateLine(sections.focus + 1, expected);
    }
    await this.refreshInboxCrown(userEnergy);
  }
  async syncFocusSection(userEnergy) {
    await this.syncEnergyLine(userEnergy);
    const focusTask = this.getFocusTask();
    await this.setFocusTask(focusTask && focusTask.status === "doing" ? focusTask : null);
    await this.refreshInboxCrown(userEnergy);
  }
  getInboxEntries() {
    const sections = this.requireSections();
    const entries = [];
    const lines = this.writer.getCurrentLines();
    for (let lineIndex = sections.inbox + 1; lineIndex < sections.archive; lineIndex++) {
      const task = parseTaskLine(lines[lineIndex]?.text ?? "");
      if (!task) continue;
      entries.push({ lineIndex, task });
    }
    return entries;
  }
  getFocusTask() {
    const line = this.writer.getCurrentLines()[this.getFocusTaskLineIndex()]?.text ?? "";
    return parseTaskLine(line);
  }
  async setFocusTask(task) {
    const focusLineIndex = this.getFocusTaskLineIndex();
    const desired = task ? formatIndentedTaskLine(task) : " No doing task";
    if (this.writer.getCurrentLines()[focusLineIndex]?.text !== desired) {
      await this.writer.updateLine(focusLineIndex, desired);
    }
  }
  async removeInboxLine(lineIndex, archiveIndex) {
    const lines = this.writer.getCurrentLines();
    for (let index = lineIndex; index < archiveIndex - 1; index++) {
      await this.writer.updateLine(index, lines[index + 1]?.text ?? "");
    }
    await this.writer.updateLine(archiveIndex - 1, "");
  }
  findInboxLineIndex(task, status) {
    for (const entry of this.getInboxEntries()) {
      if (status && entry.task.status !== status) continue;
      if (this.isSameTask(entry.task, task)) {
        return entry.lineIndex;
      }
    }
    return -1;
  }
  async refreshInboxCrown(userEnergy) {
    const top = this.getRankedTasks(userEnergy)[0];
    const currentCrownLineIndex = this.findCurrentCrownLineIndex();
    if (!top) {
      if (currentCrownLineIndex >= 0) {
        const currentTask = parseTaskLine(
          this.writer.getCurrentLines()[currentCrownLineIndex]?.text ?? ""
        );
        if (currentTask) {
          await this.writer.updateLine(
            currentCrownLineIndex,
            formatIndentedTaskLine(currentTask)
          );
        }
      }
      return;
    }
    if (currentCrownLineIndex >= 0 && currentCrownLineIndex !== top.lineIndex) {
      const currentTask = parseTaskLine(
        this.writer.getCurrentLines()[currentCrownLineIndex]?.text ?? ""
      );
      if (currentTask) {
        await this.writer.updateLine(
          currentCrownLineIndex,
          formatIndentedTaskLine(currentTask)
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
  findCurrentCrownLineIndex() {
    const sections = this.requireSections();
    const lines = this.writer.getCurrentLines();
    for (let lineIndex = sections.inbox + 1; lineIndex < sections.archive; lineIndex++) {
      if ((lines[lineIndex]?.text ?? "").trimStart().startsWith("\u{1F451}")) {
        return lineIndex;
      }
    }
    return -1;
  }
  isSameTask(a, b) {
    return a.title === b.title && a.priority === b.priority && a.energy === b.energy && a.volume === b.volume && a.created === b.created && a.due === b.due;
  }
  getEnergyLabel(energy) {
    return energy === 1 ? "Low" : energy === 2 ? "Mid" : "High";
  }
  getFocusTaskLineIndex(sections = this.requireSections()) {
    const line = this.writer.getCurrentLines()[sections.focus + 1]?.text ?? "";
    return line.startsWith(ENERGY_PREFIX) ? sections.focus + 2 : sections.focus + 1;
  }
  parseEnergyLabel(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === "low") return 1;
    if (normalized === "high") return 3;
    return 2;
  }
  requireSections() {
    const sections = this.getSections();
    if (sections.focus < 0 || sections.inbox < 0 || sections.archive < 0) {
      throw new Error("Board not found. Run Create board first.");
    }
    return sections;
  }
};

// src/styles.ts
var STYLE_ID = "unagi-box-styles";
function injectPanelStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
#unagi-box-panel {
  position: fixed;
  left: calc(100vw - 436px);
  top: 16px;
  z-index: 9999;
  width: 420px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding: 18px;
  border-radius: 22px;
  background: linear-gradient(180deg, #f8f2e7 0%, #f1e7d6 100%);
  color: #2a2118;
  border: 1px solid #d9ccb6;
  box-shadow: 0 24px 60px rgba(65, 46, 24, 0.22);
  font-family: "Avenir Next", "Segoe UI", ui-sans-serif, sans-serif;
  display: none;
}
.ct-flash {
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(circle, rgba(255,245,200,0.92) 0%, rgba(255,210,90,0.56) 35%, rgba(255,255,255,0) 75%);
}
.ct-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  cursor: move;
}
.ct-title {
  font-weight: 800;
  font-size: 20px;
  letter-spacing: 0.02em;
}
.ct-close {
  border: none;
  border-radius: 999px;
  background: #e7ddcc;
  color: #58493a;
  cursor: pointer;
  padding: 8px 12px;
  font-weight: 700;
}
.ct-focus {
  margin-bottom: 12px;
  padding: 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, #fffaf2 0%, #f6ecd9 100%);
  border: 1px solid #e0d4bd;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
}
.ct-timer {
  margin-bottom: 12px;
  padding: 42px 18px;
  min-height: 180px;
  border-radius: 20px;
  color: #fffaf2;
  text-align: center;
  font-weight: 800;
  font-size: 104px;
  line-height: 0.95;
  letter-spacing: 0.01em;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ct-timer-work {
  background: linear-gradient(135deg, #163d38 0%, #24554f 100%);
  box-shadow: 0 14px 28px rgba(22,61,56,0.26);
}
.ct-timer-break {
  background: linear-gradient(135deg, #7a4d11 0%, #b87518 100%);
  box-shadow: 0 14px 28px rgba(122,77,17,0.26);
}
.ct-status {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #efe4d2;
  color: #6a563f;
  font-size: 13px;
  font-weight: 700;
}
.ct-energy,
.ct-primary-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.ct-primary-actions {
  gap: 10px;
}
.ct-details {
  margin-bottom: 6px;
  border-radius: 14px;
  background: #f3eadb;
  border: 1px solid #e0d3bf;
  padding: 0 8px 8px 8px;
}
.ct-summary {
  cursor: pointer;
  font-weight: 650;
  padding: 7px 0;
  user-select: none;
  color: #554635;
}
.ct-surface {
  margin-bottom: 4px;
  padding: 8px;
  border-radius: 14px;
  background: #fbf7ef;
  border: 1px solid #e4d7c3;
}
.ct-chooser {
  margin-bottom: 10px;
}
.ct-field {
  display: block;
  font-size: 12px;
  color: #7a644c;
  font-weight: 600;
}
.ct-field-label {
  margin-bottom: 2px;
}
.ct-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #d6c8b1;
  background: #fffdf8;
  color: #2a2118;
  box-sizing: border-box;
}
.ct-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.ct-title-row {
  margin-bottom: 6px;
}
.ct-due-field {
  display: flex;
  gap: 8px;
  align-items: end;
  position: relative;
}
.ct-hidden-date {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
}
.ct-date-button {
  width: 44px;
  min-width: 44px;
  padding: 10px 0;
  border-radius: 10px;
  border: 1px solid #d6c8b1;
  background: #efe4d2;
  color: #5f503f;
  cursor: pointer;
  font-weight: 600;
}
.ct-button {
  display: block;
  width: 100%;
  padding: 11px 12px;
  border: none;
  border-radius: 12px;
  background: var(--ct-button-bg);
  color: var(--ct-button-color);
  cursor: pointer;
  font-weight: var(--ct-button-weight);
  box-shadow: 0 10px 18px rgba(42,33,24,0.14);
}
.ct-energy-button {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 800;
  background: #f3e8d7;
  color: #6d5b46;
  box-shadow: inset 0 0 0 1px #dfd1ba;
}
.ct-energy-button-active {
  background: #24554f;
  color: #fffaf2;
  box-shadow: 0 10px 18px rgba(36,85,79,0.2);
}
.ct-focus-kicker {
  font-size: 12px;
  font-weight: 800;
  color: #8c7457;
  letter-spacing: 0.08em;
}
.ct-focus-title {
  margin-top: 6px;
  font-size: 20px;
  font-weight: 800;
}
.ct-focus-copy {
  margin-top: 6px;
  color: #78624b;
}
.ct-focus-action {
  margin-top: 12px;
}
.ct-focus-state {
  margin-top: 8px;
  font-size: 12px;
  font-weight: 800;
  color: #0f6d57;
}
.ct-focus-next {
  margin-top: 12px;
  font-size: 12px;
  font-weight: 800;
  color: #8c7457;
}
.ct-focus-task {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 800;
}
.ct-focus-next-task {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 800;
}
.ct-focus-meta {
  margin-top: 4px;
  color: #6b5946;
}
.ct-message {
  font-size: 12px;
}
.ct-list {
  display: grid;
  gap: 8px;
}
.ct-task-row {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: 1px solid #dcccb5;
  border-radius: 10px;
  background: #fffdf8;
  color: #2a2118;
  cursor: pointer;
  box-shadow: 0 8px 16px rgba(60,43,20,0.08);
}
.ct-more-button {
  margin-top: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: #e8dece;
  color: #5f503f;
  cursor: pointer;
  font-weight: 700;
}
`;
  document.head.append(style);
}

// src/ui.ts
function styleActionButton(button, background, color, fontWeight = "800") {
  button.classList.add("ct-button");
  button.style.setProperty("--ct-button-bg", background);
  button.style.setProperty("--ct-button-color", color);
  button.style.setProperty("--ct-button-weight", fontWeight);
}
function setupCollapsible(section, title) {
  section.open = false;
  section.className = "ct-details";
  const summary = document.createElement("summary");
  summary.textContent = title;
  summary.className = "ct-summary";
  section.append(summary);
}
function makeLabeledField(label, input) {
  const wrapper = document.createElement("label");
  wrapper.className = "ct-field";
  const text = document.createElement("div");
  text.textContent = label;
  text.className = "ct-field-label";
  wrapper.append(text, input);
  return wrapper;
}
function renderFocusSection(container, options) {
  container.innerHTML = "";
  if (!options.hasBoard) {
    const eyebrow = document.createElement("div");
    eyebrow.textContent = "FOCUS";
    eyebrow.className = "ct-focus-kicker";
    const title = document.createElement("div");
    title.textContent = "Create board to start";
    title.className = "ct-focus-title";
    const description = document.createElement("div");
    description.textContent = "Board \u3092\u4F5C\u308B\u3068\u3001\u3053\u3053\u306B\u300C\u4ECA\u3084\u308B\u3053\u3068\u300D\u3068\u6B21\u5019\u88DC\u304C\u51FA\u307E\u3059\u3002";
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
      `<div class="ct-focus-copy">Add Task \u304B\u3089\u8FFD\u52A0\u3059\u308B\u304B\u3001Archive \u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002</div>`
    ].join("");
    return;
  }
  const lines = [
    `<div class="ct-focus-kicker">FOCUS</div>`
  ];
  if (options.doing) {
    lines.push(
      `<div class="ct-focus-state">DOING</div>`,
      `<div class="ct-focus-task">${escapeHtml(options.doing.task.title)}</div>`,
      `<div class="ct-focus-meta">p:${options.doing.task.priority} e:${options.doing.task.energy} v:${options.doing.task.volume}${options.doing.task.due ? ` | due:${options.doing.task.due}` : ""}</div>`
    );
  }
  if (options.top) {
    lines.push(
      `<div class="ct-focus-next">\u{1F451} NEXT</div>`,
      `<div class="ct-focus-next-task">${escapeHtml(options.top.task.title)}</div>`,
      `<div class="ct-focus-meta">score:${options.top.score.toFixed(1)} p:${options.top.task.priority} e:${options.top.task.energy} v:${options.top.task.volume}${options.top.task.due ? ` | due:${options.top.task.due}` : ""}</div>`
    );
  }
  container.innerHTML = lines.join("");
}
function renderTaskChooserSection(container, options) {
  container.innerHTML = "";
  options.chooseButton.textContent = options.expanded ? "Refresh list" : "Show task list";
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
  const visibleItems = options.expanded ? options.ranked : options.ranked.slice(0, 3);
  for (const entry of visibleItems) {
    const row = document.createElement("button");
    row.className = "ct-task-row";
    row.onclick = () => options.onPick(entry);
    row.innerHTML = [
      `<strong>${escapeHtml(entry.task.title)}</strong>`,
      `score:${entry.score.toFixed(1)} p:${entry.task.priority} e:${entry.task.energy} v:${entry.task.volume}${entry.task.status === "doing" ? " | doing" : ""}`
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
function renderEnergyButtons(container, userEnergy) {
  for (const [index, button] of Array.from(
    container.querySelectorAll("button")
  ).entries()) {
    const level = index + 1;
    button.classList.add("ct-energy-button");
    button.classList.toggle("ct-energy-button-active", level === userEnergy);
  }
}
function appendMessage(container, message) {
  const node = document.createElement("div");
  node.textContent = message;
  node.className = "ct-message";
  container.append(node);
}
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// src/panel-view.ts
var PanelView = class {
  dragState;
  callbacks;
  flash = document.createElement("div");
  root = document.createElement("aside");
  timer = document.createElement("div");
  focus = document.createElement("div");
  status = document.createElement("div");
  energy = document.createElement("div");
  primaryActions = document.createElement("div");
  timerSection = document.createElement("details");
  form = document.createElement("section");
  formSection = document.createElement("details");
  chooser = document.createElement("section");
  chooserSection = document.createElement("details");
  titleInput = document.createElement("input");
  priorityInput = document.createElement("input");
  taskEnergyInput = document.createElement("select");
  volumeInput = document.createElement("input");
  dueInput = document.createElement("input");
  duePickerInput = document.createElement("input");
  duePickerButton = document.createElement("button");
  timerMinutesInput = document.createElement("input");
  breakMinutesInput = document.createElement("input");
  createBoardButton = document.createElement("button");
  addButton = document.createElement("button");
  chooseButton = document.createElement("button");
  startButton = document.createElement("button");
  pauseButton = document.createElement("button");
  completeButton = document.createElement("button");
  closeButton = document.createElement("button");
  mount(options) {
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
      this.status
    );
    this.primaryActions.append(
      this.startButton,
      this.pauseButton,
      this.completeButton
    );
    document.body.append(this.flash);
    document.body.append(this.root);
  }
  hide() {
    this.root.style.display = "none";
  }
  isHidden() {
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
  renderEnergy(userEnergy) {
    renderEnergyButtons(this.energy, userEnergy);
  }
  renderFocus(options) {
    renderFocusSection(this.focus, {
      ...options,
      createBoardButton: this.createBoardButton
    });
  }
  renderTaskChooser(options) {
    renderTaskChooserSection(this.chooser, {
      ...options,
      chooseButton: this.chooseButton,
      onPick: (entry) => this.callbacks?.onPickTask(entry),
      onExpand: () => this.callbacks?.onShowAllTasks()
    });
  }
  renderTimer(remainingMs, mode) {
    const minutes = Math.floor(remainingMs / 6e4).toString().padStart(2, "0");
    const seconds = Math.floor(remainingMs % 6e4 / 1e3).toString().padStart(2, "0");
    this.timer.textContent = `${minutes}:${seconds}`;
    this.timer.classList.toggle("ct-timer-work", mode === "work");
    this.timer.classList.toggle("ct-timer-break", mode === "break");
  }
  setInteractionLocked(disabled) {
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
      this.breakMinutesInput
    ]) {
      element.disabled = disabled;
    }
    for (const button of Array.from(
      this.energy.querySelectorAll("button")
    )) {
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
  updatePauseButton(options) {
    styleActionButton(
      this.pauseButton,
      options.running ? "#7a4d11" : options.enabled ? "#48637a" : "#d8d0c4",
      options.enabled ? "#fffaf2" : "#8d8172"
    );
    this.pauseButton.disabled = !options.enabled;
    this.pauseButton.style.cursor = options.enabled ? "pointer" : "not-allowed";
    this.pauseButton.style.boxShadow = options.enabled ? "0 10px 18px rgba(42,33,24,0.14)" : "none";
    this.pauseButton.style.opacity = "1";
  }
  updateRunState(options) {
    this.startButton.textContent = options.running ? "\u25A0" : "\u25B6";
    this.startButton.title = options.running ? "Stop" : options.mode === "work" ? "Start" : "Resume";
    this.pauseButton.textContent = options.running ? "\u23F8" : "\u21BA";
    this.pauseButton.title = options.running ? "Pause" : "Reset";
  }
  updateStartButton(options) {
    const background = options.running ? options.mode === "work" ? "#a5472c" : "#7a4d11" : "#163d38";
    styleActionButton(this.startButton, background, "#fffaf2");
  }
  applyButtonStyles() {
    styleActionButton(this.createBoardButton, "#2d7a68", "#fffaf2", "700");
    styleActionButton(this.addButton, "#2a62a7", "#fffaf2", "700");
    styleActionButton(this.chooseButton, "#48637a", "#fffaf2", "700");
    styleActionButton(this.completeButton, "#1f8a56", "#fffaf2");
  }
  buildEnergyButtons() {
    const energyLabels = {
      1: "Low",
      2: "Mid",
      3: "High"
    };
    for (const level of [1, 2, 3]) {
      const button = document.createElement("button");
      button.textContent = energyLabels[level];
      button.onclick = () => this.callbacks?.onEnergyChange(level);
      this.energy.append(button);
    }
  }
  buildHeader() {
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
  buildTaskChooser() {
    this.chooser.className = "ct-surface ct-chooser";
    this.chooserSection.append(this.chooser);
  }
  buildTaskForm() {
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
      { value: "3", label: "High" }
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
      this.dueInput
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
      makeLabeledField("Due", dueField)
    );
    this.form.append(titleRow, grid, this.addButton);
    this.formSection.append(this.form);
  }
  buildTimerSettings(workMinutes, breakMinutes) {
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
      makeLabeledField("Break", this.breakMinutesInput)
    );
    body.append(grid);
    this.timerSection.append(body);
  }
  enableDragging(handle) {
    handle.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (target.closest("button, input, select, summary")) return;
      const rect = this.root.getBoundingClientRect();
      this.dragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!this.dragState) return;
      const left = Math.min(
        Math.max(8, event.clientX - this.dragState.offsetX),
        window.innerWidth - this.root.offsetWidth - 8
      );
      const top = Math.min(
        Math.max(8, event.clientY - this.dragState.offsetY),
        window.innerHeight - this.root.offsetHeight - 8
      );
      this.root.style.left = `${left}px`;
      this.root.style.top = `${top}px`;
    });
    const stopDragging = () => {
      this.dragState = void 0;
    };
    handle.addEventListener("pointerup", stopDragging);
    handle.addEventListener("pointercancel", stopDragging);
  }
  setupBaseStyles(isPageEditAvailable) {
    this.flash.className = "ct-flash";
    this.focus.className = "ct-focus";
    this.timer.className = "ct-timer ct-timer-work";
    this.status.textContent = isPageEditAvailable ? "Ready" : "Page edit API unavailable";
    this.status.className = "ct-status";
    this.energy.className = "ct-energy";
    this.primaryActions.className = "ct-primary-actions";
  }
  setupButtons() {
    this.createBoardButton.textContent = "Create board";
    this.addButton.textContent = "Add";
    this.chooseButton.textContent = "Pick any task";
    this.startButton.textContent = "\u25B6";
    this.startButton.title = "Start";
    this.pauseButton.textContent = "\u23F8";
    this.pauseButton.title = "Pause";
    this.completeButton.textContent = "\u2713";
    this.completeButton.title = "Complete doing";
    this.createBoardButton.onclick = () => this.callbacks?.onCreateBoard();
    this.addButton.onclick = () => this.callbacks?.onAddTask();
    this.startButton.onclick = () => this.callbacks?.onStartToggle();
    this.pauseButton.onclick = () => this.callbacks?.onPauseToggle();
    this.chooseButton.onclick = () => this.callbacks?.onPickAnyTask();
    this.completeButton.onclick = () => this.callbacks?.onCompleteDoing();
  }
  setupDuePicker() {
    this.duePickerInput.type = "date";
    this.duePickerInput.tabIndex = -1;
    this.duePickerInput.value = "";
    this.duePickerInput.className = "ct-hidden-date";
    this.duePickerInput.addEventListener("input", () => {
      this.dueInput.value = this.duePickerInput.value;
    });
    this.duePickerButton.textContent = "\u{1F4C5}";
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
  styleInputs(inputs) {
    for (const input of inputs) {
      input.classList.add("ct-input");
    }
  }
};

// src/pomodoro.ts
var PomodoroController = class {
  constructor(hooks, workMinutes = 25, breakMinutes = 5) {
    this.hooks = hooks;
    this.workMinutes = workMinutes;
    this.breakMinutes = breakMinutes;
  }
  hooks;
  workMinutes;
  breakMinutes;
  mode = "work";
  timerId;
  startedAt;
  remainingMs;
  setDurations(workMinutes, breakMinutes) {
    this.workMinutes = workMinutes;
    this.breakMinutes = breakMinutes;
  }
  isRunning() {
    return Boolean(this.timerId);
  }
  getMode() {
    return this.mode;
  }
  getDisplayRemainingMs() {
    return this.remainingMs ?? this.getDurationMsForCurrentMode();
  }
  start() {
    if (this.timerId) return;
    const durationMs = this.getDurationMsForCurrentMode();
    const resumed = this.remainingMs !== void 0 && this.remainingMs !== durationMs;
    this.remainingMs ??= durationMs;
    this.startedAt = Date.now();
    this.hooks.onPhaseStart(this.mode, resumed);
    this.hooks.onTick(this.getCurrentRemainingMs(), this.mode);
    this.timerId = window.setInterval(() => this.tick(), 1e3);
    this.hooks.onRunStateChange(true, this.mode);
  }
  pause() {
    if (!this.timerId || !this.startedAt) return false;
    this.remainingMs = this.getCurrentRemainingMs();
    window.clearInterval(this.timerId);
    this.timerId = void 0;
    this.startedAt = void 0;
    this.hooks.onTick(this.remainingMs, this.mode);
    this.hooks.onRunStateChange(false, this.mode);
    return true;
  }
  stop() {
    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = void 0;
    }
    this.startedAt = void 0;
    this.remainingMs = void 0;
    this.mode = "work";
    this.hooks.onTick(this.getDurationMsForCurrentMode(), this.mode);
    this.hooks.onRunStateChange(false, this.mode);
  }
  tick() {
    const remaining = this.getCurrentRemainingMs();
    this.hooks.onTick(remaining, this.mode);
    if (remaining > 0) return;
    const finishedMode = this.mode;
    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = void 0;
    }
    this.startedAt = void 0;
    this.remainingMs = void 0;
    this.hooks.onPhaseComplete(finishedMode);
    if (finishedMode === "work") {
      this.mode = "break";
      this.start();
      return;
    }
    this.mode = "work";
    this.hooks.onTick(this.getDurationMsForCurrentMode(), this.mode);
    this.hooks.onRunStateChange(false, this.mode);
  }
  getCurrentRemainingMs() {
    if (!this.startedAt) {
      return this.remainingMs ?? this.getDurationMsForCurrentMode();
    }
    const elapsed = Date.now() - this.startedAt;
    return Math.max((this.remainingMs ?? this.getDurationMsForCurrentMode()) - elapsed, 0);
  }
  getDurationMsForCurrentMode() {
    return (this.mode === "work" ? this.workMinutes : this.breakMinutes) * 60 * 1e3;
  }
};

// src/main.ts
var DEFAULT_POMODORO_MINUTES = 25;
var DEFAULT_BREAK_MINUTES = 5;
var MENU_TITLE = "Unagi Box";
var MENU_IMAGE = "https://img.icons8.com/ios-filled/100/task.png";
var PomodoroPanel = class {
  board = new BoardController();
  userEnergy = 2;
  timerMinutes = DEFAULT_POMODORO_MINUTES;
  breakMinutes = DEFAULT_BREAK_MINUTES;
  isSyncing = false;
  view = new PanelView();
  alarm = new PomodoroAlarm(this.view.flash);
  pomodoro = new PomodoroController(
    {
      onPhaseStart: (mode, resumed) => this.onPhaseStart(mode, resumed),
      onPhaseComplete: (mode) => this.onPhaseComplete(mode),
      onRunStateChange: (running, mode) => this.onRunStateChange(running, mode),
      onTick: (remainingMs) => this.onTick(remainingMs)
    },
    DEFAULT_POMODORO_MINUTES,
    DEFAULT_BREAK_MINUTES
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
        onStartToggle: () => void this.togglePomodoro()
      },
      isPageEditAvailable: this.board.isAvailable(),
      workMinutes: this.timerMinutes
    });
    this.renderTimer();
    this.renderEnergy();
    this.refreshTimerButtons();
    this.mountPageMenu();
    this.loadEnergyFromBoard();
    this.refreshFocus();
    this.renderTaskChooser();
  }
  loadEnergyFromBoard() {
    const energy = this.board.loadEnergyFromBoard();
    this.userEnergy = energy ?? 2;
    this.renderEnergy();
  }
  mountPageMenu() {
    if (!window.scrapbox?.PageMenu?.addMenu) return;
    window.scrapbox.PageMenu.addMenu({
      title: MENU_TITLE,
      image: MENU_IMAGE,
      onClick: () => this.toggleVisible()
    });
  }
  toggleVisible() {
    if (this.view.isHidden()) {
      this.show();
      return;
    }
    this.hide();
  }
  show() {
    this.view.show();
    this.loadEnergyFromBoard();
    this.refreshFocus();
    this.renderTaskChooser();
  }
  hide() {
    this.view.hide();
  }
  changeEnergy(energy) {
    this.userEnergy = energy;
    this.renderEnergy();
    this.refreshFocus();
    this.renderTaskChooser(this.view.chooserSection.open);
    if (!this.board.hasBoard()) return;
    void this.runBoardMutation(
      () => this.board.syncEnergyLine(this.userEnergy)
    ).catch((error) => {
      this.view.status.textContent = toMessage(error);
    });
  }
  async addTask() {
    if (this.isSyncing) return;
    const title = this.view.titleInput.value.trim();
    if (!title) return;
    const priority = toInt(this.view.priorityInput.value, 3, 1, 5);
    const energy = toInt(this.view.taskEnergyInput.value, 2, 1, 3);
    const volume = toInt(this.view.volumeInput.value, 1, 1, 9);
    const dueInput = this.view.dueInput.value.trim();
    const task = {
      status: "todo",
      title,
      priority,
      energy,
      volume,
      created: todayString(),
      due: dueInput || void 0
    };
    try {
      const createdTitle = await this.runBoardMutation(
        () => this.board.addTask(task, this.userEnergy)
      );
      this.view.status.textContent = `added: ${createdTitle}`;
      this.view.resetTaskForm();
      this.refreshFocus();
      this.renderTaskChooser();
    } catch (error) {
      this.view.status.textContent = toMessage(error);
    }
  }
  async createBoard() {
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
  async togglePomodoro() {
    if (this.isSyncing) return;
    if (this.pomodoro.isRunning()) {
      this.stopPomodoro();
      return;
    }
    this.alarm.dismiss();
    if (this.pomodoro.getMode() === "work" && !this.board.getCurrentDoingTask(this.userEnergy)) {
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
      180
    );
    this.breakMinutes = toInt(
      this.view.breakMinutesInput.value,
      DEFAULT_BREAK_MINUTES,
      1,
      60
    );
    this.view.timerMinutesInput.value = String(this.timerMinutes);
    this.view.breakMinutesInput.value = String(this.breakMinutes);
    this.pomodoro.setDurations(this.timerMinutes, this.breakMinutes);
    this.pomodoro.start();
  }
  async pickAnyTask() {
    if (this.isSyncing) return;
    this.view.chooserSection.open = true;
    this.renderTaskChooser(true);
  }
  async completeDoingTask() {
    if (this.isSyncing) return;
    try {
      const completedTitle = await this.runBoardMutation(
        () => this.board.completeDoingTask(this.userEnergy)
      );
      this.view.status.textContent = `completed: ${completedTitle}`;
      this.refreshFocus();
      this.renderTaskChooser();
    } catch (error) {
      this.view.status.textContent = toMessage(error);
    }
  }
  async promoteTaskToDoing(target) {
    if (this.isSyncing) return;
    try {
      const pickedTitle = await this.runBoardMutation(
        () => this.board.promoteTaskToDoing(target, this.userEnergy)
      );
      this.view.status.textContent = `picked: ${pickedTitle}`;
      this.refreshFocus();
      this.renderTaskChooser();
    } catch (error) {
      this.view.status.textContent = toMessage(error);
    }
  }
  refreshFocus() {
    const hasBoard = this.board.hasBoard();
    this.view.renderFocus({
      hasBoard,
      doing: hasBoard ? this.board.getCurrentDoingTask(this.userEnergy) : null,
      top: hasBoard ? this.board.getRankedTasks(this.userEnergy)[0] : void 0
    });
  }
  renderEnergy() {
    this.view.renderEnergy(this.userEnergy);
  }
  renderTaskChooser(expanded = false) {
    const hasBoard = this.board.hasBoard();
    this.view.renderTaskChooser({
      hasBoard,
      expanded,
      ranked: hasBoard ? this.board.getRankedTasks(this.userEnergy).filter((entry) => entry.task.status !== "done") : []
    });
  }
  renderTimer(remaining) {
    this.view.renderTimer(
      remaining ?? this.pomodoro.getDisplayRemainingMs(),
      this.pomodoro.getMode()
    );
  }
  pausePomodoro() {
    if (this.isSyncing) return;
    if (!this.pomodoro.isRunning()) {
      this.resetPomodoro();
      return;
    }
    if (!this.pomodoro.pause()) return;
    this.view.updateRunState({
      mode: this.pomodoro.getMode(),
      running: this.pomodoro.isRunning()
    });
    this.refreshTimerButtons();
    this.view.status.textContent = this.pomodoro.getMode() === "work" ? "Work paused" : "Break paused";
  }
  stopPomodoro() {
    if (this.isSyncing) return;
    this.alarm.dismiss();
    this.pomodoro.stop();
    this.view.updateRunState({
      mode: this.pomodoro.getMode(),
      running: this.pomodoro.isRunning()
    });
    this.refreshTimerButtons();
    this.view.status.textContent = "Timer stopped";
  }
  resetPomodoro() {
    if (this.isSyncing) return;
    this.alarm.dismiss();
    this.pomodoro.stop();
    this.view.updateRunState({
      mode: this.pomodoro.getMode(),
      running: this.pomodoro.isRunning()
    });
    this.refreshTimerButtons();
    this.view.status.textContent = "Timer reset";
  }
  async runBoardMutation(action) {
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
  refreshInteractionLock() {
    this.view.setInteractionLocked(this.isSyncing);
    if (!this.isSyncing) {
      this.refreshTimerButtons();
    }
  }
  refreshTimerButtons() {
    const running = this.pomodoro.isRunning();
    const mode = this.pomodoro.getMode();
    this.view.updateStartButton({ mode, running });
    this.view.updatePauseButton({
      enabled: running || mode !== "work",
      running
    });
  }
  onTick(remainingMs) {
    this.renderTimer(remainingMs);
  }
  onRunStateChange(running, mode) {
    this.view.updateRunState({ mode, running });
    this.refreshTimerButtons();
  }
  onPhaseStart(mode, resumed) {
    this.view.status.textContent = resumed ? mode === "work" ? "Work resumed" : "Break resumed" : mode === "work" ? "Work started" : "Break started";
  }
  onPhaseComplete(mode) {
    void this.alarm.notify();
    if (mode === "break") {
      this.view.status.textContent = "Break complete";
    }
  }
};
function toMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function toInt(value, fallback, min, max) {
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
