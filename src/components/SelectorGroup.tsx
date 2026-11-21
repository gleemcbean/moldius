import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./SelectorGroup.module.scss";

interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

const PADDING = 6;
const CORNER = 6;
const REACH = PADDING + CORNER;
const SCROLLING = /(auto|scroll|overlay)/;
const SLIDE_MS = 260;
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

function clipBox(element: HTMLElement): Box {
	let left = -REACH;
	let top = -REACH;
	let right = window.innerWidth + REACH;
	let bottom = window.innerHeight + REACH;

	for (
		let parent = element.parentElement;
		parent && parent !== document.body;
		parent = parent.parentElement
	) {
		const style = getComputedStyle(parent);

		if (!SCROLLING.test(style.overflowX) && !SCROLLING.test(style.overflowY)) {
			continue;
		}

		const rect = parent.getBoundingClientRect();

		left = Math.max(left, rect.left - REACH);
		top = Math.max(top, rect.top - REACH);
		right = Math.min(right, rect.right + REACH);
		bottom = Math.min(bottom, rect.bottom + REACH);
	}

	return { x: left, y: top, width: right - left, height: bottom - top };
}

function uncovered(element: HTMLElement, box: Box): boolean {
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;

	if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
		return true;
	}

	const top = document.elementFromPoint(x, y);

	return !top || element.contains(top) || top.contains(element);
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

		const setVisible = (visible: boolean) => {
			outline.style.opacity = visible ? "1" : "0";
		};

		const paint = (box: Box, clip: Box) => {
			shown = box;

			const outer = {
				x: box.x - CORNER,
				y: box.y - CORNER,
				width: box.width + CORNER * 2,
				height: box.height + CORNER * 2,
			};

			const inset = [
				Math.max(0, clip.y - outer.y),
				Math.max(0, outer.x + outer.width - (clip.x + clip.width)),
				Math.max(0, outer.y + outer.height - (clip.y + clip.height)),
				Math.max(0, clip.x - outer.x),
			];

			outline.style.transform = `translate(${outer.x}px, ${outer.y}px)`;
			outline.style.width = `${outer.width}px`;
			outline.style.height = `${outer.height}px`;

			outline.style.clipPath = inset.some((value) => value > 0)
				? `inset(${inset.map((value) => `${value}px`).join(" ")})`
				: "none";
		};

		const measure = (element: HTMLElement): Box => {
			const target = frameOf(element, root).getBoundingClientRect();

			return {
				x: target.left - PADDING,
				y: target.top - PADDING,
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

			const framed = frameOf(element, root);
			const target = measure(element);
			let next = target;

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

			paint(next, clipBox(framed));
			setVisible(uncovered(framed, target));

			frame = requestAnimationFrame(tick);
		};

		const wake = () => {
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
		root.addEventListener("padmark", onOver);
		root.addEventListener("pointerleave", onLeave);
		root.addEventListener("click", wake);
		window.addEventListener("scroll", wake, true);
		window.addEventListener("resize", wake);

		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
			mutations.disconnect();
			root.removeEventListener("pointerover", onOver);
			root.removeEventListener("focusin", onOver);
			root.removeEventListener("padmark", onOver);
			root.removeEventListener("pointerleave", onLeave);
			root.removeEventListener("click", wake);
			window.removeEventListener("scroll", wake, true);
			window.removeEventListener("resize", wake);
		};
	}, []);

	return (
		<div ref={container} className={[styles.group, className ?? ""].join(" ")}>
			{createPortal(
				<div ref={selector} className={styles.selector} aria-hidden="true">
					<span className={styles.frame} />
					<span className={styles.cornerTopLeft} />
					<span className={styles.cornerTopRight} />
					<span className={styles.cornerBottomLeft} />
					<span className={styles.cornerBottomRight} />
				</div>,
				document.body,
			)}
			{children}
		</div>
	);
}
