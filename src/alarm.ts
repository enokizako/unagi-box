export class PomodoroAlarm {
	private audioContext?: AudioContext;
	private titleTimerId?: number;
	private originalTitle?: string;
	private soundRunId = 0;

	constructor(private readonly flash: HTMLElement) {}

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
		if (this.titleTimerId !== undefined) {
			window.clearInterval(this.titleTimerId);
			this.titleTimerId = undefined;
		}
		if (this.originalTitle !== undefined) {
			document.title = this.originalTitle;
			this.originalTitle = undefined;
		}
	}

	private startTitleBlink() {
		this.originalTitle = document.title;
		let visible = false;
		this.titleTimerId = window.setInterval(() => {
			visible = !visible;
			document.title = visible
				? "Time's up - Unagi Box"
				: (this.originalTitle ?? document.title);
		}, 700);
	}

	private flashScreen() {
		this.flash.animate(
			[
				{ opacity: "0" },
				{ opacity: "1", offset: 0.15 },
				{ opacity: "0.12", offset: 0.5 },
				{ opacity: "1", offset: 0.78 },
				{ opacity: "0" },
			],
			{
				duration: 1500,
				easing: "ease-out",
			},
		);
	}

	private async playAlarm(runId: number) {
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

	private playAlarmPhrase(context: AudioContext) {
		const startAt = context.currentTime;
		const notes = [
			{ time: 0, frequency: 880, duration: 0.2 },
			{ time: 0.24, frequency: 1174, duration: 0.2 },
			{ time: 0.48, frequency: 1568, duration: 0.42 },
		];

		for (const note of notes) {
			const oscillator = context.createOscillator();
			const gain = context.createGain();
			oscillator.type = "triangle";
			oscillator.frequency.value = note.frequency;
			gain.gain.setValueAtTime(0.0001, startAt + note.time);
			gain.gain.exponentialRampToValueAtTime(0.35, startAt + note.time + 0.02);
			gain.gain.exponentialRampToValueAtTime(
				0.0001,
				startAt + note.time + note.duration,
			);
			oscillator.connect(gain);
			gain.connect(context.destination);
			oscillator.start(startAt + note.time);
			oscillator.stop(startAt + note.time + note.duration + 0.03);
		}
	}
}

function sleep(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}
