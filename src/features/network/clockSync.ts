import { getSocket } from "./socket";

interface Sample {
	offset: number;
	roundTrip: number;
}

class ClockSync {
	private samples: Sample[] = [];
	private offset = 0;
	private smoothedOffset = 0;
	private timer: number | null = null;
	roundTrip = 80;
	jitter = 10;

	start(): void {
		if (this.timer !== null) {
			return;
		}
		const socket = getSocket();
		socket.on("time:pong", ({ clientTime, serverTime }) => {
			const now = performance.now();
			const roundTrip = now - clientTime;
			if (roundTrip < 0 || roundTrip > 5000) {
				return;
			}
			this.samples.push({
				offset: serverTime + roundTrip / 2 - now,
				roundTrip,
			});
			if (this.samples.length > 9) {
				this.samples.shift();
			}
			const sorted = [...this.samples].sort(
				(a, b) => a.roundTrip - b.roundTrip,
			);
			const best = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
			this.offset =
				best.reduce((sum, sample) => sum + sample.offset, 0) / best.length;
			const trips = this.samples.map((sample) => sample.roundTrip);
			this.roundTrip =
				trips.reduce((sum, value) => sum + value, 0) / trips.length;
			this.jitter = Math.sqrt(
				trips.reduce((sum, value) => sum + (value - this.roundTrip) ** 2, 0) /
					trips.length,
			);
			if (this.samples.length === 1) {
				this.smoothedOffset = this.offset;
			}
		});
		const ping = () =>
			socket.emit("time:ping", { clientTime: performance.now() });
		let burst = 0;
		const tick = () => {
			ping();
			burst += 1;
			this.timer = window.setTimeout(tick, burst < 6 ? 250 : 2000);
		};
		tick();
	}

	serverNow(): number {
		const target = this.offset;
		this.smoothedOffset += (target - this.smoothedOffset) * 0.05;
		if (Math.abs(target - this.smoothedOffset) > 250) {
			this.smoothedOffset = target;
		}
		return performance.now() + this.smoothedOffset;
	}

	rawServerNow(): number {
		return performance.now() + this.offset;
	}
}

export const clockSync = new ClockSync();
