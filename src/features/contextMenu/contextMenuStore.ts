import { showToast } from "../../app/appStore";
import type { IconName } from "../../components/Icon";
import { createStore } from "../../utils/store";
import { inputDeviceStore } from "../gamepad/gamepad";

export interface MenuAction {
	kind: "action";
	id: string;
	label: string;
	icon?: IconName;
	danger?: boolean;
	disabled?: boolean;
	checked?: boolean;
	confirm?: string;
	run: () => void;
}

export interface MenuRange {
	kind: "range";
	id: string;
	label: string;
	icon?: IconName;
	value: number;
	min: number;
	max: number;
	step: number;
	format: (value: number) => string;
	change: (value: number) => void;
}

export interface MenuHeading {
	kind: "heading";
	id: string;
	label: string;
	detail?: string;
	color?: number;
}

export type MenuEntry = MenuAction | MenuRange | MenuHeading;
export type MenuSlot = MenuEntry | false | null | undefined;
export type MenuBuilder = () => MenuSlot[][];

export interface OpenMenu {
	key: number;
	x: number;
	y: number;
	build: MenuBuilder;
	alignEnd: boolean;
	focusFirst: boolean;
	origin: Element | null;
	returnFocus: HTMLElement | null;
}

interface MenuEvent {
	clientX: number;
	clientY: number;
	currentTarget: EventTarget | null;
	preventDefault(): void;
	stopPropagation(): void;
}

export const contextMenuStore = createStore<{ menu: OpenMenu | null }>({
	menu: null,
});

const REOPEN_GUARD_MS = 400;
let counter = 0;
let lastClosed: { origin: Element | null; at: number } | null = null;

function activeElement(): HTMLElement | null {
	const active = document.activeElement;

	return active instanceof HTMLElement && active !== document.body
		? active
		: null;
}

function show(
	x: number,
	y: number,
	build: MenuBuilder,
	focusFirst: boolean,
	origin: Element | null,
	alignEnd = false,
): void {
	counter += 1;

	contextMenuStore.set({
		menu: {
			key: counter,
			x,
			y,
			build,
			alignEnd,
			focusFirst: focusFirst || inputDeviceStore.get().device === "pad",
			origin,
			returnFocus: activeElement(),
		},
	});
}

export function openContextMenu(event: MenuEvent, build: MenuBuilder): void {
	event.preventDefault();
	event.stopPropagation();

	const origin =
		event.currentTarget instanceof Element ? event.currentTarget : null;

	const fromKeyboard = event.clientX === 0 && event.clientY === 0;

	if (fromKeyboard && origin) {
		const rect = origin.getBoundingClientRect();

		show(rect.left + 12, rect.bottom, build, true, origin);

		return;
	}

	show(event.clientX, event.clientY, build, fromKeyboard, origin);
}

export function toggleMenuBelow(
	element: Element,
	build: MenuBuilder,
	fromKeyboard: boolean,
): void {
	const justClosed =
		lastClosed?.origin === element &&
		performance.now() - lastClosed.at < REOPEN_GUARD_MS;

	if (justClosed) {
		lastClosed = null;

		return;
	}

	const rect = element.getBoundingClientRect();

	show(rect.right, rect.bottom + 4, build, fromKeyboard, element, true);
}

export function showMenuAt(x: number, y: number, build: MenuBuilder): void {
	show(x, y, build, false, null);
}

export function contextMenuOpen(): boolean {
	return contextMenuStore.get().menu !== null;
}

export function closeContextMenu(restoreFocus = true): void {
	const menu = contextMenuStore.get().menu;

	if (!menu) {
		return;
	}

	lastClosed = { origin: menu.origin, at: performance.now() };

	contextMenuStore.set({ menu: null });

	if (restoreFocus && menu.returnFocus?.isConnected) {
		menu.returnFocus.focus({ preventScroll: true });
	}
}

export function menuEntries(build: MenuBuilder): MenuEntry[][] {
	return build()
		.map((section) =>
			section.filter((slot): slot is MenuEntry => Boolean(slot)),
		)
		.filter((section) => section.length > 0);
}

export function actionable(sections: MenuEntry[][]): boolean {
	return sections.some((section) =>
		section.some((entry) => entry.kind !== "heading"),
	);
}

export async function copyText(text: string, done: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		showToast(done, "success", 2200);
	} catch {
		return;
	}
}
