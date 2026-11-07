// Consolidado S-88 del Paquete S-61 (puro, con pruebas): por mes y tipo de reunión, cuántas reuniones hubo, de cuántas se registró
// la asistencia, presencial, Zoom, total y el promedio por reunión registrada.

export interface AttendanceMonth {
	periodYear: number | null;
	periodMonth: number | null;
	meetingType: string | null;
	meetingsRecorded: number | null;
	totalInPerson: number | null;
	totalZoom: number | null;
}

export interface MeetingsHeld {
	periodYear: number;
	periodMonth: number;
	meetingType: string;
	count: number;
}

export interface S88Row {
	periodYear: number;
	periodMonth: number;
	meetingType: string;
	/** Reuniones de ese tipo que se celebraron en el mes (sin las canceladas). */
	held: number;
	/** Reuniones con asistencia registrada. */
	recorded: number;
	inPerson: number;
	zoom: number;
	/** Presencial + Zoom. */
	total: number;
	/** Total ÷ reuniones registradas, redondeado (null si no se registró ninguna). */
	average: number | null;
}

const key = (y: number, m: number, t: string) => `${y}-${m}-${t}`;

/** Une la asistencia registrada con las reuniones celebradas; un mes con reuniones pero sin registros también aparece (en cero). */
export function buildS88Rows(attendance: AttendanceMonth[], held: MeetingsHeld[]): S88Row[] {
	const rows = new Map<string, S88Row>();
	for (const a of attendance) {
		if (a.periodYear == null || a.periodMonth == null || !a.meetingType) continue;
		const inPerson = a.totalInPerson ?? 0;
		const zoom = a.totalZoom ?? 0;
		const recorded = a.meetingsRecorded ?? 0;
		rows.set(key(a.periodYear, a.periodMonth, a.meetingType), {
			periodYear: a.periodYear,
			periodMonth: a.periodMonth,
			meetingType: a.meetingType,
			held: 0,
			recorded,
			inPerson,
			zoom,
			total: inPerson + zoom,
			average: recorded > 0 ? Math.round((inPerson + zoom) / recorded) : null,
		});
	}
	for (const h of held) {
		const k = key(h.periodYear, h.periodMonth, h.meetingType);
		const row = rows.get(k);
		if (row) row.held = h.count;
		else
			rows.set(k, {
				periodYear: h.periodYear,
				periodMonth: h.periodMonth,
				meetingType: h.meetingType,
				held: h.count,
				recorded: 0,
				inPerson: 0,
				zoom: 0,
				total: 0,
				average: null,
			});
	}
	// Más reciente primero; en el mismo mes, entre semana antes que fin de semana.
	return [...rows.values()].sort(
		(a, b) => b.periodYear - a.periodYear || b.periodMonth - a.periodMonth || (a.meetingType === "midweek" ? -1 : 1) - (b.meetingType === "midweek" ? -1 : 1),
	);
}
