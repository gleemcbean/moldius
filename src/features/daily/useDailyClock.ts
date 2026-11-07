import { dailyDateKey, msUntilNextDaily } from "@shared/dailyChallenge";
import { useEffect, useState } from "react";

export function useDailyClock(): { date: string; remainingMs: number } {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);
	return { date: dailyDateKey(now), remainingMs: msUntilNextDaily(now) };
}
