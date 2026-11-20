import { useEffect, useRef } from "react";
import { matchStore } from "../game/matchStore";
import { beginApproach, markArrived } from "./approachArrival";
import styles from "./LoadingScreen.module.scss";
import { type ApproachWalker, ManorApproachScene } from "./ManorApproachScene";

function loadingFraction(): number {
	const { loadingSteps } = matchStore.get();

	return loadingSteps.length === 0
		? 0
		: loadingSteps.reduce((sum, step) => sum + step.progress, 0) /
				loadingSteps.length;
}

export function LoadingBackdrop({ walkers }: { walkers: ApproachWalker[] }) {
	const host = useRef<HTMLDivElement>(null);
	const walkersRef = useRef(walkers);

	useEffect(() => {
		const element = host.current;

		if (!element) {
			return;
		}

		beginApproach();

		let cancelled = false;
		let scene: ManorApproachScene | null = null;
		let stop: (() => void) | null = null;

		ManorApproachScene.create(element, walkersRef.current)
			.then((created) => {
				if (cancelled) {
					created.dispose();

					return;
				}

				scene = created;

				const sync = () =>
					created.setProgress(loadingFraction(), matchStore.get().loaded);

				sync();

				stop = matchStore.subscribe(sync);
				created.onFirstFrame = () => element.setAttribute("data-ready", "");
				created.onArrived = markArrived;
			})
			.catch(() => {
				scene = null;

				markArrived();
			});

		return () => {
			cancelled = true;

			stop?.();
			scene?.dispose();
			markArrived();
		};
	}, []);

	return <div ref={host} className={styles.backdrop} aria-hidden="true" />;
}
