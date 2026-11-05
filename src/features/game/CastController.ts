import { transcriptMatchesFormula } from "@shared/anomalies/formulas";
import { CAST_INTERRUPT_MS } from "@shared/config/index";
import type { CastFailureReason, CastResult } from "@shared/protocol/game";
import { currentMessages } from "../../i18n";
import { soundBank } from "../audio/soundBank";
import { hudStore, pushFeedback } from "../hud/hudStore";
import {
	IncantationListener,
	prepareSpeechRecognition,
	speechRecognitionAvailable,
} from "../voice/speechRecognizer";

export interface CastTransport {
	begin(): void;
	cancel(): void;
	cast(transcripts: string[]): void;
}

const EXPLAINED_FAILURES: ReadonlySet<CastFailureReason> = new Set([
	"hidden",
	"dead",
	"cooldown",
	"missing-occult",
]);
const RESTART_DELAY_MS = 250;
const ERROR_RETRY_MS = 3000;

export interface FormulaBook {
	entries(): { id: number; label: string; words: readonly string[] }[];
}

export class CastController {
	private readonly listener = new IncantationListener();
	private phase: "idle" | "listening" | "sent" = "idle";
	private enabled = false;
	private resumeAt = 0;
	private sentAt = 0;
	private lastError = "";
	private warnedUnavailable = false;
	private devCounter = 0;

	constructor(
		private readonly transport: CastTransport,
		private readonly book: FormulaBook,
		private readonly dev: boolean,
		private readonly explainAll = false,
	) {
		prepareSpeechRecognition();
		hudStore.set({
			devMode: dev,
			devLive: { text: "", matches: false },
			devCasts: [],
		});
	}

	update(enabled: boolean): void {
		const now = performance.now();
		if (this.phase === "sent" && now - this.sentAt > 4000) {
			this.reset();
		}
		if (!enabled) {
			if (this.enabled) {
				this.enabled = false;
				this.cancel();
			}
			return;
		}
		this.enabled = true;
		if (this.listener.active || this.phase === "sent" || now < this.resumeAt) {
			return;
		}
		if (!speechRecognitionAvailable()) {
			if (!this.warnedUnavailable) {
				this.warnedUnavailable = true;
				pushFeedback(currentMessages().game.cast.noSpeech, "warning");
			}
			return;
		}
		this.listen();
	}

	private listen(): void {
		const started = this.listener.start({
			onInterim: (text) => {
				if (text.trim().length > 0 && this.phase === "idle") {
					this.phase = "listening";
					this.transport.begin();
				}
				this.updateDevLive(text);
			},
			onFinal: (alternatives) => this.submit(alternatives),
			onError: (message) => {
				this.resumeAt = performance.now() + ERROR_RETRY_MS;
				if (message !== this.lastError) {
					this.lastError = message;
					pushFeedback(message, "error");
				}
			},
			onEnd: () => {
				this.resumeAt = Math.max(
					this.resumeAt,
					performance.now() + RESTART_DELAY_MS,
				);
				if (this.phase === "listening") {
					this.phase = "idle";
					this.transport.cancel();
				}
				if (this.dev) {
					hudStore.set({ devLive: { text: "", matches: false } });
				}
			},
		});
		if (!started) {
			this.resumeAt = performance.now() + ERROR_RETRY_MS;
		}
	}

	cancel(): void {
		this.listener.stop();
		if (this.phase !== "idle") {
			this.transport.cancel();
		}
		this.reset();
	}

	interrupted(): void {
		this.listener.stop();
		this.resumeAt = performance.now() + CAST_INTERRUPT_MS;
		this.reset();
	}

	private submit(transcripts: string[]): void {
		const sent = transcripts
			.filter((entry) => entry.trim().length > 0)
			.slice(0, 5);
		const spoken = sent.some((text) =>
			this.book
				.entries()
				.some((entry) => transcriptMatchesFormula(text, entry.words)),
		);
		this.recordDev(sent, spoken);
		if (!spoken) {
			if (this.phase === "listening") {
				this.transport.cancel();
			}
			this.phase = "idle";
			return;
		}
		if (this.phase === "idle") {
			this.transport.begin();
		}
		this.lastError = "";
		this.transport.cast(sent);
		this.phase = "sent";
		this.sentAt = performance.now();
		hudStore.set({ castPhase: "sent" });
	}

	private updateDevLive(text: string): void {
		if (!this.dev) {
			return;
		}
		hudStore.set({
			devLive: {
				text,
				matches: this.book
					.entries()
					.some((entry) => transcriptMatchesFormula(text, entry.words)),
			},
		});
	}

	private recordDev(transcripts: string[], spoken: boolean): void {
		if (!this.dev || transcripts.length === 0) {
			return;
		}
		const matched = this.book
			.entries()
			.find((entry) =>
				transcripts.some((text) => transcriptMatchesFormula(text, entry.words)),
			);
		this.devCounter += 1;
		const entry = {
			id: this.devCounter,
			transcripts,
			matchedLabel: matched?.label ?? null,
			expected: matched?.words ?? [],
			result: spoken ? ("pending" as const) : ("ignored" as const),
		};
		hudStore.set((state) => ({
			devLive: { text: "", matches: false },
			devCasts: [entry, ...state.devCasts].slice(0, 4),
		}));
	}

	handleResult(
		result: CastResult,
		labelFor: (anomalyId: number) => string,
	): void {
		if (this.dev) {
			hudStore.set((state) => {
				const pending = state.devCasts.findIndex(
					(entry) => entry.result === "pending",
				);
				if (pending < 0) {
					return {};
				}
				const devCasts = [...state.devCasts];
				devCasts[pending] = {
					...devCasts[pending],
					result: result.ok ? "ok" : (result.reason ?? "wrong-words"),
				};
				return { devCasts };
			});
		}
		this.reset();
		const labels = currentMessages().game.cast;
		if (result.ok) {
			soundBank.play("capture", { volume: 0.9 });
			pushFeedback(
				labels.captured(labelFor(result.anomalyId), result.points),
				"success",
			);
			return;
		}
		soundBank.play("capture-fail", { volume: 0.6 });
		pushFeedback(
			result.reason &&
				(this.explainAll || EXPLAINED_FAILURES.has(result.reason))
				? labels.reasons[result.reason]
				: labels.failed[Math.floor(Math.random() * labels.failed.length)],
			"error",
		);
	}

	private reset(): void {
		this.phase = "idle";
		hudStore.set({ castPhase: "idle" });
	}

	dispose(): void {
		this.listener.stop();
	}
}
