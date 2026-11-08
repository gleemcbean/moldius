import type {
	AdminDayStat,
	AdminHourStat,
	AdminOverview,
} from "../../shared/protocol/admin.js";

export const ADMIN_TIME_ZONE = "Europe/Paris";
export const ADMIN_WINDOW_DAYS = 30;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PARTS = new Intl.DateTimeFormat("en-GB", {
	timeZone: ADMIN_TIME_ZONE,
	weekday: "short",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	hourCycle: "h23",
});

export function localParts(at: Date): {
	weekday: number;
	hour: number;
	date: string;
} {
	const parts = Object.fromEntries(
		PARTS.formatToParts(at).map((part) => [part.type, part.value]),
	);
	return {
		weekday: WEEKDAYS.indexOf(parts.weekday),
		hour: Number(parts.hour),
		date: `${parts.year}-${parts.month}-${parts.day}`,
	};
}

export interface PresenceSample {
	at: Date;
	connected: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function summarizePresence(
	samples: PresenceSample[],
	days = ADMIN_WINDOW_DAYS,
): AdminOverview["presence"] {
	const hours = Array.from({ length: 24 }, () => ({
		total: 0,
		count: 0,
		peak: 0,
	}));
	const cells = Array.from({ length: 7 }, () =>
		Array.from({ length: 24 }, () => ({ total: 0, count: 0 })),
	);
	let peak: AdminOverview["presence"]["peak"] = null;
	for (const sample of samples) {
		const { weekday, hour } = localParts(sample.at);
		const bucket = hours[hour];
		bucket.total += sample.connected;
		bucket.count += 1;
		bucket.peak = Math.max(bucket.peak, sample.connected);
		cells[weekday][hour].total += sample.connected;
		cells[weekday][hour].count += 1;
		if (!peak || sample.connected > peak.connected) {
			peak = { at: sample.at.toISOString(), connected: sample.connected };
		}
	}
	const byHour: AdminHourStat[] = hours.map((bucket, hour) => ({
		hour,
		average: bucket.count > 0 ? round(bucket.total / bucket.count) : 0,
		peak: bucket.peak,
	}));
	const heatmap = cells.map((row) =>
		row.map((cell) => (cell.count > 0 ? round(cell.total / cell.count) : null)),
	);
	let bestSlot: AdminOverview["presence"]["bestSlot"] = null;
	heatmap.forEach((row, weekday) => {
		row.forEach((average, hour) => {
			if (average !== null && average > (bestSlot?.average ?? 0)) {
				bestSlot = { weekday, hour, average };
			}
		});
	});
	return { days, samples: samples.length, byHour, heatmap, peak, bestSlot };
}

export function summarizeDays(
	now: Date,
	matches: { matchId: string; at: Date }[],
	registrations: Date[],
	days = ADMIN_WINDOW_DAYS,
): AdminDayStat[] {
	const result = new Map<
		string,
		{ matches: Set<string>; registrations: number }
	>();
	// Compter en jours du calendrier : avec un changement d'heure, 24 h ne font pas un jour.
	const today = Date.parse(`${localParts(now).date}T12:00:00Z`);
	for (let offset = days - 1; offset >= 0; offset -= 1) {
		const date = new Date(today - offset * 86_400_000)
			.toISOString()
			.slice(0, 10);
		result.set(date, { matches: new Set(), registrations: 0 });
	}
	for (const match of matches) {
		result.get(localParts(match.at).date)?.matches.add(match.matchId);
	}
	for (const at of registrations) {
		const entry = result.get(localParts(at).date);
		if (entry) {
			entry.registrations += 1;
		}
	}
	return [...result].map(([date, entry]) => ({
		date,
		matches: entry.matches.size,
		registrations: entry.registrations,
	}));
}
