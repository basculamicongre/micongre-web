// Reglas puras (con pruebas) para cambiar el punto de salida de una salida de predicación.

/** El punto se puede cambiar antes de la salida y hasta 2 horas después de su hora de inicio (lo que dura la predicación). */
export const DEPARTURE_CHANGE_WINDOW_MIN = 120;

const toMinutes = (date: string, minutes: number) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 60_000 + minutes;

/** `now` en hora de Nicaragua (`nicaraguaNow()`): fecha AAAA-MM-DD y minutos desde medianoche. */
export function canChangeDepartureAt(date: string, time: string, now: { date: string; minutes: number }): boolean {
	const [h, m] = time.split(":").map(Number);
	return toMinutes(now.date, now.minutes) <= toMinutes(date, h * 60 + m + DEPARTURE_CHANGE_WINDOW_MIN);
}
