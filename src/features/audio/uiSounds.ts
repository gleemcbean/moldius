import { audioEngine } from "./audioEngine";

const HOVER_GAP_MS = 45;
const HOVERABLE =
	'button, a[href], select, summary, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [data-selectable]';

let lastHover = 0;

export function playHoverTick(pitch = 1): void {
	const now = performance.now();
	if (now - lastHover < HOVER_GAP_MS || !audioEngine.running) {
		return;
	}
	lastHover = now;
	const context = audioEngine.ctx;
	const start = context.currentTime;
	const tone = context.createOscillator();
	tone.type = "triangle";
	tone.frequency.setValueAtTime(1400 * pitch, start);
	tone.frequency.exponentialRampToValueAtTime(900 * pitch, start + 0.05);
	const tone2 = context.createOscillator();
	tone2.type = "sine";
	tone2.frequency.setValueAtTime(2800 * pitch, start);
	const shimmer = context.createGain();
	shimmer.gain.value = 0.25;
	const filter = context.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.value = 3200;
	const envelope = context.createGain();
	envelope.gain.setValueAtTime(0.0001, start);
	envelope.gain.exponentialRampToValueAtTime(0.08, start + 0.004);
	envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.075);
	tone.connect(filter);
	tone2.connect(shimmer).connect(filter);
	filter.connect(envelope).connect(audioEngine.bus("ui"));
	tone.start(start);
	tone2.start(start);
	tone.stop(start + 0.09);
	tone2.stop(start + 0.09);
	tone.onended = () => envelope.disconnect();
}

function hoverable(target: EventTarget | null): Element | null {
	if (!(target instanceof Element)) {
		return null;
	}
	const element = target.closest(HOVERABLE);
	if (!element || element.matches(':disabled, [aria-disabled="true"]')) {
		return null;
	}
	return element;
}

export function installHoverSounds(): () => void {
	const onOver = (event: PointerEvent) => {
		if (event.pointerType === "touch") {
			return;
		}
		const element = hoverable(event.target);
		if (
			!element ||
			(event.relatedTarget instanceof Node &&
				element.contains(event.relatedTarget))
		) {
			return;
		}
		playHoverTick();
	};
	const onFocus = (event: FocusEvent) => {
		const element = hoverable(event.target);
		if (element?.matches(":focus-visible")) {
			playHoverTick();
		}
	};
	document.addEventListener("pointerover", onOver);
	document.addEventListener("focusin", onFocus);
	return () => {
		document.removeEventListener("pointerover", onOver);
		document.removeEventListener("focusin", onFocus);
	};
}
