import { createStore } from "../../utils/store";

export type TextTarget = HTMLInputElement | HTMLTextAreaElement;

const TEXT_TYPES = new Set([
	"text",
	"email",
	"password",
	"search",
	"tel",
	"url",
]);

export const padKeyboardStore = createStore<{ target: TextTarget | null }>({
	target: null,
});

export function isTextTarget(element: Element | null): element is TextTarget {
	if (element instanceof HTMLTextAreaElement) {
		return !element.disabled && !element.readOnly;
	}
	return (
		element instanceof HTMLInputElement &&
		TEXT_TYPES.has(element.type) &&
		!element.disabled &&
		!element.readOnly
	);
}

export function padKeyboardOpen(): boolean {
	return padKeyboardStore.get().target !== null;
}

export function openPadKeyboard(target: TextTarget): void {
	padKeyboardStore.set({ target });
}

export function closePadKeyboard(): void {
	const { target } = padKeyboardStore.get();
	padKeyboardStore.set({ target: null });
	if (target?.isConnected) {
		target.focus({ preventScroll: true });
	}
}

function writeValue(target: TextTarget, value: string): void {
	const prototype =
		target instanceof HTMLTextAreaElement
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
	if (setter) {
		setter.call(target, value);
	} else {
		target.value = value;
	}
	target.dispatchEvent(new Event("input", { bubbles: true }));
}

function selection(target: TextTarget): { start: number; end: number } {
	const length = target.value.length;
	try {
		const start = target.selectionStart;
		const end = target.selectionEnd;
		if (start !== null && end !== null) {
			return { start, end };
		}
	} catch {
		return { start: length, end: length };
	}
	return { start: length, end: length };
}

function placeCaret(target: TextTarget, position: number): void {
	try {
		target.setSelectionRange(position, position);
	} catch {
		return;
	}
}

export function typeText(text: string): void {
	const { target } = padKeyboardStore.get();
	if (!target) {
		return;
	}
	const value = target.value;
	const { start, end } = selection(target);
	const limit = target.maxLength > 0 ? target.maxLength : Infinity;
	const room = limit - (value.length - (end - start));
	if (room <= 0) {
		return;
	}
	const piece = text.slice(0, room);
	writeValue(target, value.slice(0, start) + piece + value.slice(end));
	placeCaret(target, Math.min(target.value.length, start + piece.length));
}

export function eraseText(): void {
	const { target } = padKeyboardStore.get();
	if (!target) {
		return;
	}
	const value = target.value;
	const { start, end } = selection(target);
	if (start === end && start === 0) {
		return;
	}
	const from = start === end ? start - 1 : start;
	writeValue(target, value.slice(0, from) + value.slice(end));
	placeCaret(target, Math.min(target.value.length, from));
}
