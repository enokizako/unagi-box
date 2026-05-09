export type PomodoroMode = "work" | "break";

export interface PomodoroHooks {
  onPhaseStart: (mode: PomodoroMode, resumed: boolean) => void;
  onPhaseComplete: (mode: PomodoroMode) => void;
  onRunStateChange: (running: boolean, mode: PomodoroMode) => void;
  onTick: (remainingMs: number, mode: PomodoroMode) => void;
}

export class PomodoroController {
  private mode: PomodoroMode = "work";
  private timerId?: number;
  private startedAt?: number;
  private remainingMs?: number;

  constructor(
    private readonly hooks: PomodoroHooks,
    private workMinutes = 25,
    private breakMinutes = 5,
  ) {}

  setDurations(workMinutes: number, breakMinutes: number) {
    this.workMinutes = workMinutes;
    this.breakMinutes = breakMinutes;
  }

  isRunning(): boolean {
    return Boolean(this.timerId);
  }

  getMode(): PomodoroMode {
    return this.mode;
  }

  getDisplayRemainingMs(): number {
    return this.remainingMs ?? this.getDurationMsForCurrentMode();
  }

  start() {
    if (this.timerId) return;
    const durationMs = this.getDurationMsForCurrentMode();
    const resumed = this.remainingMs !== undefined && this.remainingMs !== durationMs;
    this.remainingMs ??= durationMs;
    this.startedAt = Date.now();
    this.hooks.onPhaseStart(this.mode, resumed);
    this.hooks.onTick(this.getCurrentRemainingMs(), this.mode);
    this.timerId = window.setInterval(() => this.tick(), 1000);
    this.hooks.onRunStateChange(true, this.mode);
  }

  pause() {
    if (!this.timerId || !this.startedAt) return false;
    this.remainingMs = this.getCurrentRemainingMs();
    window.clearInterval(this.timerId);
    this.timerId = undefined;
    this.startedAt = undefined;
    this.hooks.onTick(this.remainingMs, this.mode);
    this.hooks.onRunStateChange(false, this.mode);
    return true;
  }

  stop() {
    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = undefined;
    }
    this.startedAt = undefined;
    this.remainingMs = undefined;
    this.mode = "work";
    this.hooks.onTick(this.getDurationMsForCurrentMode(), this.mode);
    this.hooks.onRunStateChange(false, this.mode);
  }

  private tick() {
    const remaining = this.getCurrentRemainingMs();
    this.hooks.onTick(remaining, this.mode);
    if (remaining > 0) return;

    const finishedMode = this.mode;
    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = undefined;
    }
    this.startedAt = undefined;
    this.remainingMs = undefined;
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

  private getCurrentRemainingMs(): number {
    if (!this.startedAt) {
      return this.remainingMs ?? this.getDurationMsForCurrentMode();
    }
    const elapsed = Date.now() - this.startedAt;
    return Math.max((this.remainingMs ?? this.getDurationMsForCurrentMode()) - elapsed, 0);
  }

  private getDurationMsForCurrentMode(): number {
    return (this.mode === "work" ? this.workMinutes : this.breakMinutes) * 60 * 1000;
  }
}
