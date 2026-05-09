import type { Energy, Task } from "./types/task.js";

export interface TaskLineFormatOptions {
  crown?: boolean;
  indent?: boolean;
}

const TASK_PATTERN =
  /^\s*(?:(?<done>✅)|(?<doing>👣)|(?<crown>👑))?(?:\[(?<bracketTitle>.+?)\]|(?<plainTitle>.+?))\s+\| p:(?<priority>\d+)\s+\| e:(?<energy>[123])\s+\| v:(?<volume>\d+)\s+\| c:(?<created>\d{4}-\d{2}-\d{2})(?:\s+\| d:(?<due>\d{4}-\d{2}-\d{2}))?$/;

export function parseTaskLine(text: string): Task | null {
  const match = TASK_PATTERN.exec(text);
  if (!match?.groups) return null;
  const status =
    match.groups.done === "✅"
      ? "done"
      : match.groups.doing === "👣"
        ? "doing"
        : "todo";

  return {
    status,
    title: match.groups.bracketTitle ?? match.groups.plainTitle,
    priority: Number(match.groups.priority),
    energy: Number(match.groups.energy) as Energy,
    volume: Number(match.groups.volume),
    created: match.groups.created,
    due: match.groups.due || undefined,
    bracketed: Boolean(match.groups.bracketTitle),
  };
}

export function formatTaskLine(task: Task, options: TaskLineFormatOptions = {}): string {
  const statusToken = getStatusToken(task, options);
  const due = task.due ? ` | d:${task.due}` : "";
  const indent = options.indent ? " " : "";
  const title = task.bracketed ? `[${task.title}]` : task.title;
  return `${indent}${statusToken}${title} | p:${task.priority} | e:${task.energy} | v:${task.volume} | c:${task.created}${due}`;
}

export function formatIndentedTaskLine(task: Task): string {
  return formatTaskLine(task, { indent: true });
}

export function formatCrownedTaskLine(task: Task): string {
  return formatTaskLine(task, { crown: true, indent: true });
}

export function todayString(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const start = Date.parse(`${a}T00:00:00Z`);
  const end = Date.parse(`${b}T00:00:00Z`);
  return Math.round((end - start) / 86400000);
}

export function scoreTask(task: Task, userEnergy: Energy, today = todayString()): number {
  const ageDays = Math.max(daysBetween(task.created, today), 0);
  const urgencyBonus = scoreUrgency(task.due, today);
  const energyPenalty = Math.abs(userEnergy - task.energy) * 5;
  const sizePenalty = Math.max(task.volume - 1, 0) * 2;
  return task.priority * (10 + urgencyBonus) + ageDays - energyPenalty - sizePenalty;
}

function scoreUrgency(due: string | undefined, today: string): number {
  if (!due) return 0;
  const daysLeft = daysBetween(today, due);
  if (daysLeft < 0) return 60 + Math.abs(daysLeft) * 15;
  if (daysLeft === 0) return 60;
  if (daysLeft <= 7) return ((7 - daysLeft) / 6) * 30;
  return 0;
}

function getStatusToken(task: Task, options: TaskLineFormatOptions): string {
  if (options.crown) return "👑";
  if (task.status === "done") return "✅";
  if (task.status === "doing") return "👣";
  return "";
}
