// Calendario (módulo «Calendario», web y app): reglas puras para armar lo que se ve en un mes (con pruebas en __tests__/calendar.test.ts).
// Las salidas de predicación van aparte (con todo su detalle, igual que el calendario de predicación); aquí va todo lo demás que tiene fecha.

export type CalendarKind = "meeting" | "assignment" | "cleaning" | "talk" | "pastoral" | "event";

/** Orden dentro de un mismo día (después de la hora): eventos primero, luego reuniones y asignaciones. */
const KIND_ORDER: CalendarKind[] = ["event", "meeting", "assignment", "talk", "cleaning", "pastoral"];

export const CALENDAR_KIND_LABEL: Record<CalendarKind | "preaching", string> = {
	event: "Eventos",
	meeting: "Reuniones",
	assignment: "Mis asignaciones",
	talk: "Discursos fuera",
	cleaning: "Limpieza",
	pastoral: "Pastoreo",
	preaching: "Predicación",
};

export interface CalendarItem {
	/** AAAA-MM-DD. */
	date: string;
	/** Último día, si dura varios (eventos, limpieza profunda). */
	dateEnd?: string | null;
	kind: CalendarKind;
	title: string;
	detail?: string | null;
	/** HH:MM. */
	time?: string | null;
	mapUrl?: string | null;
}

/** Primer y último día de un mes «AAAA-MM». */
export function monthRange(month: string): { from: string; to: string } {
	const [y, m] = month.split("-").map(Number);
	const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** ¿Toca algún día del rango? */
export function overlaps(item: { date: string; dateEnd?: string | null }, from: string, to: string): boolean {
	return item.date <= to && (item.dateEnd ?? item.date) >= from;
}

/** De qué tipo es cada asignación de Mi Panel en el calendario (null = no va: predicación va aparte; territorios y solicitudes no son de un día). */
export function assignmentKind(meetingType: string): CalendarKind | null {
	switch (meetingType) {
		case "midweek":
		case "weekend":
		case "operational":
			return "assignment";
		case "cleaning":
			return "cleaning";
		case "outgoing_talk":
			return "talk";
		case "pastoral_visit":
			return "pastoral";
		default:
			return null;
	}
}

const MEETING_TITLE = { midweek: "Reunión de entre semana", weekend: "Reunión de fin de semana" } as const;

export function buildCalendarItems(
	month: string,
	input: {
		assignments: { date: string; dateEnd?: string; meetingType: string; label: string; detail?: string; time?: string; mapUrl?: string }[];
		events: { title: string; startDate: string; endDate: string; detail?: string | null }[];
		meetings: { date: string; time?: string | null; type: "midweek" | "weekend" }[];
	},
): CalendarItem[] {
	const { from, to } = monthRange(month);
	const out: CalendarItem[] = [];
	for (const e of input.events) {
		out.push({ date: e.startDate, dateEnd: e.endDate !== e.startDate ? e.endDate : null, kind: "event", title: e.title, detail: e.detail ?? null });
	}
	for (const m of input.meetings) out.push({ date: m.date, kind: "meeting", title: MEETING_TITLE[m.type], time: m.time ?? null });
	for (const a of input.assignments) {
		const kind = assignmentKind(a.meetingType);
		if (!kind) continue;
		out.push({ date: a.date, dateEnd: a.dateEnd && a.dateEnd !== a.date ? a.dateEnd : null, kind, title: a.label, detail: a.detail ?? null, time: a.time ?? null, mapUrl: a.mapUrl ?? null });
	}
	return out
		.filter((i) => overlaps(i, from, to))
		.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}
