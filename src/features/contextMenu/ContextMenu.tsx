import {
	type KeyboardEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { appStore } from "../../app/appStore";
import { Icon } from "../../components/Icon";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import { accountStore } from "../account/accountStore";
import { friendsStore } from "../friends/friendsStore";
import { lobbyStore } from "../lobby/lobbyStore";
import { voicePrefsStore } from "../voice/voicePrefs";
import styles from "./ContextMenu.module.scss";
import {
	actionable,
	closeContextMenu,
	contextMenuStore,
	type MenuAction,
	type MenuHeading,
	type MenuRange,
	menuEntries,
	type OpenMenu,
} from "./contextMenuStore";

const MARGIN = 8;
const ITEM = "[data-menu-item]:not(:disabled)";

export function ContextMenu() {
	const menu = useStore(contextMenuStore, (state) => state.menu);

	return menu ? <MenuPanel key={menu.key} menu={menu} /> : null;
}

function MenuPanel({ menu }: { menu: OpenMenu }) {
	const t = useT();
	const panel = useRef<HTMLDivElement>(null);
	const [armed, setArmed] = useState<string | null>(null);

	useStore(lobbyStore, (state) => state.lobby);
	useStore(friendsStore, (state) => state);
	useStore(voicePrefsStore, (state) => state);
	useStore(accountStore, (state) => state.status);

	const sections = menuEntries(menu.build);
	const empty = !actionable(sections);

	useEffect(() => {
		if (empty) {
			closeContextMenu(false);
		}
	}, [empty]);

	useLayoutEffect(() => {
		const element = panel.current;

		if (!element) {
			return;
		}

		const rect = element.getBoundingClientRect();
		const right = window.innerWidth - MARGIN;
		const bottom = window.innerHeight - MARGIN;

		const start = menu.alignEnd ? menu.x - rect.width : menu.x;

		const left =
			start + rect.width > right
				? Math.max(MARGIN, menu.x - rect.width)
				: Math.max(MARGIN, start);

		const top =
			menu.y + rect.height > bottom
				? Math.max(MARGIN, bottom - rect.height)
				: menu.y;

		element.style.left = `${left}px`;
		element.style.top = `${top}px`;
		element.style.visibility = "visible";
	});

	useEffect(() => {
		const element = panel.current;

		if (!element) {
			return;
		}

		const first = menu.focusFirst
			? element.querySelector<HTMLElement>(ITEM)
			: null;

		(first ?? element).focus({ preventScroll: true });
	}, []);

	useEffect(() => {
		const inside = (target: EventTarget | null) =>
			target instanceof Node && Boolean(panel.current?.contains(target));

		const dismiss = () => closeContextMenu(false);

		const dismissOutside = (event: Event) => {
			if (!inside(event.target)) {
				dismiss();
			}
		};

		const onKey = (event: globalThis.KeyboardEvent) => {
			if (event.code === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				closeContextMenu();
			}
		};

		const stopApp = appStore.subscribe((state, previous) => {
			if (
				state.screen !== previous.screen ||
				state.overlay !== previous.overlay
			) {
				dismiss();
			}
		});

		window.addEventListener("pointerdown", dismissOutside, true);
		window.addEventListener("wheel", dismissOutside, { passive: true });
		window.addEventListener("scroll", dismissOutside, true);
		window.addEventListener("keydown", onKey, true);
		window.addEventListener("resize", dismiss);
		window.addEventListener("blur", dismiss);
		document.addEventListener("pointerlockchange", dismiss);

		return () => {
			stopApp();
			window.removeEventListener("pointerdown", dismissOutside, true);
			window.removeEventListener("wheel", dismissOutside);
			window.removeEventListener("scroll", dismissOutside, true);
			window.removeEventListener("keydown", onKey, true);
			window.removeEventListener("resize", dismiss);
			window.removeEventListener("blur", dismiss);
			document.removeEventListener("pointerlockchange", dismiss);
		};
	}, []);

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const items = [
			...(panel.current?.querySelectorAll<HTMLElement>(ITEM) ?? []),
		];

		const index = items.indexOf(document.activeElement as HTMLElement);

		const go = (next: number) => {
			event.preventDefault();
			items[(next + items.length) % items.length]?.focus();
		};

		if (event.key === "Tab") {
			event.preventDefault();
			closeContextMenu();

			return;
		}

		if (items.length === 0) {
			return;
		}

		if (event.key === "ArrowDown") {
			go(index + 1);
		} else if (event.key === "ArrowUp") {
			go(index < 0 ? items.length - 1 : index - 1);
		} else if (event.key === "Home") {
			go(0);
		} else if (event.key === "End") {
			go(items.length - 1);
		}
	};

	const activate = (item: MenuAction) => {
		if (item.confirm && armed !== item.id) {
			setArmed(item.id);

			return;
		}

		closeContextMenu();
		item.run();
	};

	const disarm = (id: string) => {
		if (armed !== null && armed !== id) {
			setArmed(null);
		}
	};

	return (
		<div
			ref={panel}
			className={styles.menu}
			role="menu"
			aria-label={t.contextMenu.label}
			tabIndex={-1}
			style={{ left: menu.x, top: menu.y, visibility: "hidden" }}
			onKeyDown={onKeyDown}
			onContextMenu={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
			data-pad-scope=""
			data-pad-priority=""
		>
			{sections.map((section) => (
				<div
					key={section.map((entry) => entry.id).join("|")}
					className={styles.section}
					role="group"
				>
					{section.map((entry) =>
						entry.kind === "heading" ? (
							<Heading key={entry.id} entry={entry} />
						) : entry.kind === "range" ? (
							<Range
								key={entry.id}
								entry={entry}
								onFocus={() => disarm(entry.id)}
							/>
						) : (
							<Action
								key={entry.id}
								entry={entry}
								armed={armed === entry.id}
								onActivate={() => activate(entry)}
								onFocus={() => disarm(entry.id)}
							/>
						),
					)}
				</div>
			))}
		</div>
	);
}

function Heading({ entry }: { entry: MenuHeading }) {
	return (
		<div className={styles.heading}>
			{entry.color !== undefined ? (
				<i
					className={styles.swatch}
					style={{ background: hexColor(entry.color) }}
					aria-hidden="true"
				/>
			) : null}
			<strong title={entry.label}>{entry.label}</strong>
			{entry.detail ? <span>{entry.detail}</span> : null}
		</div>
	);
}

function Action({
	entry,
	armed,
	onActivate,
	onFocus,
}: {
	entry: MenuAction;
	armed: boolean;
	onActivate: () => void;
	onFocus: () => void;
}) {
	const className = [
		styles.item,
		entry.danger ? styles.danger : "",
		armed ? styles.armed : "",
	].join(" ");

	const shared = {
		className,
		disabled: entry.disabled,
		onClick: onActivate,
		onPointerEnter: onFocus,
		onFocus,
		"data-menu-item": "",
		"data-sound": entry.danger ? "danger" : undefined,
	};

	const content = (
		<>
			{entry.icon ? (
				<Icon name={entry.icon} />
			) : (
				<span className={styles.blank} />
			)}
			<span className={styles.label}>
				{armed && entry.confirm ? entry.confirm : entry.label}
			</span>
			{entry.checked ? <Icon name="check" className={styles.check} /> : null}
		</>
	);

	if (entry.checked !== undefined) {
		return (
			<button
				type="button"
				role="menuitemcheckbox"
				aria-checked={entry.checked}
				{...shared}
			>
				{content}
			</button>
		);
	}

	return (
		<button type="button" role="menuitem" {...shared}>
			{content}
		</button>
	);
}

function Range({ entry, onFocus }: { entry: MenuRange; onFocus: () => void }) {
	const percent = ((entry.value - entry.min) / (entry.max - entry.min)) * 100;

	return (
		<label className={styles.range}>
			<span className={styles.rangeHead}>
				{entry.icon ? <Icon name={entry.icon} /> : null}
				<span className={styles.label}>{entry.label}</span>
				<output>{entry.format(entry.value)}</output>
			</span>
			<input
				type="range"
				className={styles.slider}
				min={entry.min}
				max={entry.max}
				step={entry.step}
				value={entry.value}
				onChange={(event) => entry.change(Number(event.target.value))}
				onKeyDown={(event) => {
					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault();
					}
				}}
				onFocus={onFocus}
				style={{ ["--fill" as string]: `${percent}%` }}
				data-menu-item=""
			/>
		</label>
	);
}
