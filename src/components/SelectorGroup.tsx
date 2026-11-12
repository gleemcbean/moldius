import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import styles from "./SelectorGroup.module.scss";

interface SelectorRect {
	x: number;
	y: number;
	width: number;
	height: number;
	visible: boolean;
}

const PADDING = 6;

function frameOf(element: HTMLElement, root: HTMLElement): HTMLElement {
	if (element.dataset.selectable !== "row") {
		return element;
	}
	const row = element.parentElement?.closest<HTMLElement>(
		"[data-selector-row]",
	);
	return row && root.contains(row) ? row : element;
}

export function SelectorGroup({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const container = useRef<HTMLDivElement>(null);
	const current = useRef<HTMLElement | null>(null);
	const [rect, setRect] = useState<SelectorRect>({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		visible: false,
	});

	const measure = useCallback((element: HTMLElement | null) => {
		const root = container.current;
		if (!root || !element || (element as HTMLButtonElement).disabled) {
			setRect((previous) => ({ ...previous, visible: false }));
			return;
		}
		const bounds = root.getBoundingClientRect();
		const target = frameOf(element, root).getBoundingClientRect();
		setRect({
			x: target.left - bounds.left - PADDING,
			y: target.top - bounds.top - PADDING,
			width: target.width + PADDING * 2,
			height: target.height + PADDING * 2,
			visible: true,
		});
	}, []);

	useEffect(() => {
		const root = container.current;
		if (!root) {
			return;
		}
		let frame = 0;
		const hide = () => setRect((previous) => ({ ...previous, visible: false }));
		const refresh = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const element = current.current;
				if (!element) {
					return;
				}
				if (!root.contains(element)) {
					current.current = null;
					hide();
					return;
				}
				measure(element);
			});
		};
		const resize = new ResizeObserver(refresh);
		resize.observe(root);
		const mutations = new MutationObserver(refresh);
		mutations.observe(root, {
			subtree: true,
			childList: true,
			characterData: true,
			attributes: true,
			attributeFilter: ["class", "disabled", "aria-checked", "aria-pressed"],
		});
		const findSelectable = (target: EventTarget | null) =>
			target instanceof HTMLElement
				? (target.closest("[data-selectable]") as HTMLElement | null)
				: null;
		const onOver = (event: Event) => {
			const element = findSelectable(event.target);
			if (element && root.contains(element)) {
				if (current.current && current.current !== element) {
					resize.unobserve(frameOf(current.current, root));
				}
				current.current = element;
				resize.observe(frameOf(element, root));
				measure(element);
			}
		};
		const onLeave = () => {
			if (current.current) {
				resize.unobserve(frameOf(current.current, root));
			}
			current.current = null;
			hide();
		};
		root.addEventListener("pointerover", onOver);
		root.addEventListener("focusin", onOver);
		root.addEventListener("pointerleave", onLeave);
		root.addEventListener("click", refresh);
		root.addEventListener("scroll", refresh, true);
		window.addEventListener("resize", refresh);
		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
			mutations.disconnect();
			root.removeEventListener("pointerover", onOver);
			root.removeEventListener("focusin", onOver);
			root.removeEventListener("pointerleave", onLeave);
			root.removeEventListener("click", refresh);
			root.removeEventListener("scroll", refresh, true);
			window.removeEventListener("resize", refresh);
		};
	}, [measure]);

	return (
		<div ref={container} className={[styles.group, className ?? ""].join(" ")}>
			<div
				className={styles.selector}
				aria-hidden="true"
				style={{
					transform: `translate(${rect.x}px, ${rect.y}px)`,
					width: rect.width,
					height: rect.height,
					opacity: rect.visible ? 1 : 0,
				}}
			>
				<span className={styles.cornerTopLeft} />
				<span className={styles.cornerTopRight} />
				<span className={styles.cornerBottomLeft} />
				<span className={styles.cornerBottomRight} />
			</div>
			{children}
		</div>
	);
}
