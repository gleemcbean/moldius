import { type ReactNode, useEffect, useRef } from "react";
import styles from "./SelectorGroup.module.scss";

interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

const PADDING = 6;
const SLIDE_MS = 260;
const SETTLE_FRAMES = 10;
const EMPTY: Box = { x: 0, y: 0, width: 0, height: 0 };

function frameOf(element: HTMLElement, root: HTMLElement): HTMLElement {
	if (element.dataset.selectable !== "row") {
		return element;
	}
	const row = element.parentElement?.closest<HTMLElement>(
		"[data-selector-row]",
	);
	return row && root.contains(row) ? row : element;
}

function easeOutQuint(progress: number): number {
	return 1 - (1 - progress) ** 5;
}

function blend(from: Box, to: Box, amount: number): Box {
	return {
		x: from.x + (to.x - from.x) * amount,
		y: from.y + (to.y - from.y) * amount,
		width: from.width + (to.width - from.width) * amount,
		height: from.height + (to.height - from.height) * amount,
	};
}

function sameBox(a: Box, b: Box): boolean {
	return (
		Math.abs(a.x - b.x) < 0.01 &&
		Math.abs(a.y - b.y) < 0.01 &&
		Math.abs(a.width - b.width) < 0.01 &&
		Math.abs(a.height - b.height) < 0.01
	);
}

export function SelectorGroup({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const container = useRef<HTMLDivElement>(null);
	const selector = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const root = container.current;
		const outline = selector.current;
		if (!root || !outline) {
			return;
		}
		let current: HTMLElement | null = null;
		let shown = EMPTY;
		let slideFrom: Box | null = null;
		let slideStart = 0;
		let frame = 0;
		let stillFrames = 0;

		const setVisible = (visible: boolean) => {
			outline.style.opacity = visible ? "1" : "0";
		};
		const paint = (box: Box) => {
			shown = box;
			outline.style.transform = `translate(${box.x}px, ${box.y}px)`;
			outline.style.width = `${box.width}px`;
			outline.style.height = `${box.height}px`;
		};
		const measure = (element: HTMLElement): Box => {
			const bounds = root.getBoundingClientRect();
			const target = frameOf(element, root).getBoundingClientRect();
			return {
				x: target.left - bounds.left - PADDING,
				y: target.top - bounds.top - PADDING,
				width: target.width + PADDING * 2,
				height: target.height + PADDING * 2,
			};
		};
		const tick = (now: number) => {
			frame = 0;
			const element = current;
			if (!element) {
				return;
			}
			if (!root.contains(element)) {
				current = null;
				setVisible(false);
				return;
			}
			if ((element as HTMLButtonElement).disabled) {
				setVisible(false);
				return;
			}
			let next = measure(element);
			if (slideFrom) {
				const progress = Math.min(
					1,
					Math.max(0, (now - slideStart) / SLIDE_MS),
				);
				next = blend(slideFrom, next, easeOutQuint(progress));
				if (progress >= 1) {
					slideFrom = null;
				}
			}
			stillFrames = sameBox(shown, next) ? stillFrames + 1 : 0;
			paint(next);
			setVisible(true);
			if (slideFrom || stillFrames < SETTLE_FRAMES) {
				frame = requestAnimationFrame(tick);
			}
		};
		const wake = () => {
			stillFrames = 0;
			if (!frame) {
				frame = requestAnimationFrame(tick);
			}
		};

		const resize = new ResizeObserver(wake);
		resize.observe(root);
		const mutations = new MutationObserver(wake);
		mutations.observe(root, {
			subtree: true,
			childList: true,
			characterData: true,
			attributes: true,
			attributeFilter: ["class", "disabled", "aria-checked", "aria-pressed"],
		});
		const findSelectable = (target: EventTarget | null) =>
			target instanceof Element
				? target.closest<HTMLElement>("[data-selectable]")
				: null;
		const onOver = (event: Event) => {
			const element = findSelectable(event.target);
			if (!element || !root.contains(element)) {
				return;
			}
			if (element !== current) {
				if (current) {
					resize.unobserve(frameOf(current, root));
				}
				current = element;
				resize.observe(frameOf(element, root));
				slideFrom = shown;
				slideStart = performance.now();
			}
			wake();
		};
		const onLeave = () => {
			if (current) {
				resize.unobserve(frameOf(current, root));
			}
			current = null;
			setVisible(false);
		};
		root.addEventListener("pointerover", onOver);
		root.addEventListener("focusin", onOver);
		root.addEventListener("pointerleave", onLeave);
		root.addEventListener("click", wake);
		root.addEventListener("scroll", wake, true);
		window.addEventListener("resize", wake);
		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
			mutations.disconnect();
			root.removeEventListener("pointerover", onOver);
			root.removeEventListener("focusin", onOver);
			root.removeEventListener("pointerleave", onLeave);
			root.removeEventListener("click", wake);
			root.removeEventListener("scroll", wake, true);
			window.removeEventListener("resize", wake);
		};
	}, []);

	return (
		<div ref={container} className={[styles.group, className ?? ""].join(" ")}>
			<div ref={selector} className={styles.selector} aria-hidden="true">
				<span className={styles.cornerTopLeft} />
				<span className={styles.cornerTopRight} />
				<span className={styles.cornerBottomLeft} />
				<span className={styles.cornerBottomRight} />
			</div>
			{children}
		</div>
	);
}
