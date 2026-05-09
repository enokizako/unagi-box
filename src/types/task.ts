export type TaskStatus = "todo" | "doing" | "done";
export type Energy = 1 | 2 | 3;

export interface Task {
	status: TaskStatus;
	title: string;
	priority: number;
	energy: Energy;
	volume: number;
	created: string;
	due?: string;
	bracketed?: boolean;
}

export interface RankedTask {
	lineIndex: number;
	task: Task;
	score: number;
}

export interface TaskEntry {
	lineIndex: number;
	task: Task;
}
