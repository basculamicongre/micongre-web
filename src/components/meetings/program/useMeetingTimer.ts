"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
	begin as beginRun,
	finish as finishRun,
	parseRun,
	phase,
	runningKey,
	startRun,
	TIMER_KEEP_MS,
	undo as undoRun,
	type TimedItem,
	type TimerRun,
} from "@/lib/meetings/timer";

const PREFIX = "mc.meetingTimer.";

export type TimerMode = "bar" | "min" | "full";

export interface MeetingTimer {
	/** Visible solo para quien puede usarlo y con un programa armado. */
	active: boolean;
	plan: TimedItem[];
	run: TimerRun | null;
	now: number;
	mode: TimerMode;
	setMode: (mode: TimerMode) => void;
	start: () => void;
	finish: () => void;
	begin: () => void;
	undo: () => void;
	reset: () => void;
	/** La parte que se está cronometrando ahora (null en un cambio, al terminar o sin cronómetro). */
	runningKey: string | null;
}

function read(key: string): string | null {
	try {
		return window.localStorage.getItem(PREFIX + key);
	} catch {
		return null;
	}
}

function write(key: string, value: TimerRun | null) {
	try {
		if (value) window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
		else window.localStorage.removeItem(PREFIX + key);
	} catch {
		// sin almacenamiento: el cronómetro sigue, solo no se recuerda
	}
}

/** Limpieza: lo guardado de reuniones de hace más de dos semanas (o que no se entiende). */
function cleanup(current: string, now: number) {
	try {
		const store = window.localStorage;
		const stale: string[] = [];
		for (let i = 0; i < store.length; i++) {
			const k = store.key(i);
			if (!k || !k.startsWith(PREFIX) || k === PREFIX + current) continue;
			const run = parseRun(store.getItem(k));
			if (!run || now - run.startedAt > TIMER_KEEP_MS) stale.push(k);
		}
		stale.forEach((k) => store.removeItem(k));
	} catch {
		// ignorar
	}
}

/**
 * Estado del cronómetro de la reunión que se ve. Los tiempos se guardan solo en este navegador (por reunión), así no se pierden si se
 * cierra la página a media reunión; se borran solos a las dos semanas. Mientras corre, intenta mantener la pantalla encendida.
 */
export function useMeetingTimer(storageKey: string | null, plan: TimedItem[], allowed: boolean): MeetingTimer {
	const [run, setRun] = useState<TimerRun | null>(null);
	const [now, setNow] = useState(() => Date.now());
	const [mode, setMode] = useState<TimerMode>("bar");

	useEffect(() => {
		setRun(storageKey ? parseRun(read(storageKey)) : null);
		setMode("bar");
		setNow(Date.now());
	}, [storageKey]);

	const save = useCallback(
		(value: TimerRun | null) => {
			setRun(value);
			if (storageKey) write(storageKey, value);
		},
		[storageKey],
	);

	const active = allowed && plan.length > 0;
	const running = active && !!run && phase(run, plan).kind !== "finished";

	// Un tic por segundo mientras corre.
	useEffect(() => {
		if (!running) return;
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [running]);

	// Pantalla encendida (Wake Lock) mientras corre; se vuelve a pedir al regresar a la pestaña. Los errores se ignoran.
	useEffect(() => {
		if (!running) return;
		type Sentinel = { release: () => Promise<void> };
		const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };
		if (!nav.wakeLock) return;
		let sentinel: Sentinel | null = null;
		let stopped = false;
		const request = () => {
			nav.wakeLock
				?.request("screen")
				.then((s) => {
					if (stopped) s.release().catch(() => {});
					else sentinel = s;
				})
				.catch(() => {});
		};
		const onVisible = () => {
			if (document.visibilityState === "visible") request();
		};
		request();
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			stopped = true;
			document.removeEventListener("visibilitychange", onVisible);
			sentinel?.release().catch(() => {});
		};
	}, [running]);

	const start = () => {
		const t = Date.now();
		setNow(t);
		save(startRun(plan, t));
		if (storageKey) cleanup(storageKey, t);
	};
	const finish = () => {
		if (!run) return;
		const t = Date.now();
		setNow(t);
		save(finishRun(run, plan, t));
	};
	const begin = () => {
		if (!run) return;
		const t = Date.now();
		setNow(t);
		save(beginRun(run, plan, t));
	};
	const undo = () => {
		if (!run) return;
		const back = undoRun(run);
		save(back);
		if (!back) setMode("bar");
	};
	const reset = () => {
		setMode("bar");
		save(null);
	};

	return {
		active,
		plan,
		run: active ? run : null,
		now,
		mode,
		setMode,
		start,
		finish,
		begin,
		undo,
		reset,
		runningKey: active ? runningKey(run, plan) : null,
	};
}

const INACTIVE: MeetingTimer = {
	active: false,
	plan: [],
	run: null,
	now: 0,
	mode: "bar",
	setMode: () => {},
	start: () => {},
	finish: () => {},
	begin: () => {},
	undo: () => {},
	reset: () => {},
	runningKey: null,
};

export const MeetingTimerContext = createContext<MeetingTimer>(INACTIVE);
export const useTimer = () => useContext(MeetingTimerContext);
