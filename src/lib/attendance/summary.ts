import { addDays, mondayOf, parseISODate, toISODate } from "@/lib/mwb/dates";

/** Lunes = 0 … domingo = 6 (la semana de las reuniones empieza el lunes). */
const DAY_OFFSET: Record<string, number> = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };

export interface MeetingSchedules {
	midweek?: { day?: string; time?: string } | null;
	weekend?: { day?: string; time?: string } | null;
	/**
	 * Cambios de una sola semana hechos por un evento (Eventos → «mover la reunión»), por lunes de la semana (AAAA-MM-DD). Los llena
	 * `readMeetingSchedules`; así todo lo que calcula la fecha real de una reunión (Mi Panel, recordatorios, S-140…) respeta el cambio.
	 */
	overrides?: Record<string, { midweek?: { day?: string | null; time?: string | null }; weekend?: { day?: string | null; time?: string | null } }>;
}

export interface AttendanceRow {
	meetingType: "midweek" | "weekend";
	meetingDate: string;
	inPersonCount: number;
	zoomCount: number;
}

export interface MonthStat {
	meetings: number;
	/** Presentes en el salón + conectados por Zoom, sumados, de todas las reuniones del mes. */
	total: number;
	/** Promedio por reunión (presencial + Zoom). */
	average: number;
	averageInPerson: number;
	averageZoom: number;
}

export interface MonthSummary {
	/** AAAA-MM */
	month: string;
	midweek: MonthStat | null;
	weekend: MonthStat | null;
}

function offsetOf(day: string | undefined | null, fallback: number): number {
	if (!day) return fallback;
	const key = day.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
	return DAY_OFFSET[key] ?? fallback;
}

/** Fecha en que de verdad se celebra la reunión: el lunes de la semana guardada más el día de reunión de la congregación (la
 * guardada de entre semana es el lunes y la de fin de semana el sábado, que pueden caer en otro mes que el día de reunión). Si el
 * día no se pudo leer, se queda con la fecha guardada. */
export function effectiveMeetingDate(stored: string, type: "midweek" | "weekend", schedules: MeetingSchedules | null): string {
	const storedDate = parseISODate(stored);
	const monday = mondayOf(storedDate);
	const moved = schedules?.overrides?.[toISODate(monday)]?.[type]?.day;
	const day = moved || (type === "midweek" ? schedules?.midweek?.day : schedules?.weekend?.day);
	const fallback = (storedDate.getUTCDay() + 6) % 7; // posición de la fecha guardada dentro de su semana
	return toISODate(addDays(monday, offsetOf(day, fallback)));
}

/** Hora (texto de Congregación, p. ej. «19:00») en que se celebra la reunión de esa semana: la del evento que la movió o la de siempre. */
export function effectiveMeetingTime(stored: string, type: "midweek" | "weekend", schedules: MeetingSchedules | null): string | undefined {
	const week = toISODate(mondayOf(parseISODate(stored)));
	const moved = schedules?.overrides?.[week]?.[type]?.time;
	return (moved || (type === "midweek" ? schedules?.midweek?.time : schedules?.weekend?.time)) ?? undefined;
}

/** Promedios por mes y por tipo de reunión: cada reunión con asistencia registrada cuenta en el mes en que se celebra. */
export function summarizeAttendance(rows: AttendanceRow[], schedules: MeetingSchedules | null, fromISO?: string): MonthSummary[] {
	const acc = new Map<string, { midweek: number[][]; weekend: number[][] }>();
	for (const r of rows) {
		const date = effectiveMeetingDate(r.meetingDate, r.meetingType, schedules);
		if (fromISO && date < fromISO) continue;
		const month = date.slice(0, 7);
		const bucket = acc.get(month) ?? { midweek: [], weekend: [] };
		bucket[r.meetingType].push([r.inPersonCount, r.zoomCount]);
		acc.set(month, bucket);
	}
	const stat = (list: number[][]): MonthStat | null => {
		if (list.length === 0) return null;
		const inPerson = list.reduce((s, [a]) => s + a, 0);
		const zoom = list.reduce((s, [, b]) => s + b, 0);
		const round = (n: number) => Math.round((n / list.length) * 10) / 10;
		return { meetings: list.length, total: inPerson + zoom, average: round(inPerson + zoom), averageInPerson: round(inPerson), averageZoom: round(zoom) };
	};
	return [...acc.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, b]) => ({ month, midweek: stat(b.midweek), weekend: stat(b.weekend) }));
}
