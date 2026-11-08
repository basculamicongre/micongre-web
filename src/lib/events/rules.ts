// Reglas puras de los eventos de la congregación (módulo «Eventos»; con pruebas en __tests__/events.test.ts).
// Un evento afecta la semana (lunes a domingo) de su fecha de inicio. Cada reunión se configura por separado: sin cambio, cancelarla
// o moverla a otro día y hora de esa semana.
import type { CongregationEvent, EventKind, EventMeetingAction } from "@/db/schema";
import type { MeetingSchedules } from "@/lib/attendance/summary";
import { addDays, mondayOf, parseISODate, toISODate } from "@/lib/mwb/dates";

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
	memorial: "Conmemoración",
	circuit_assembly: "Asamblea de circuito",
	regional_convention: "Asamblea regional",
	co_visit: "Visita del superintendente de circuito",
	other: "Evento",
};

export const MEETING_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export type MeetingType = "midweek" | "weekend";
export const MEETING_LABEL: Record<MeetingType, string> = { midweek: "entre semana", weekend: "fin de semana" };

/** Lo que importa de un evento para estas reglas (así las pruebas no necesitan una fila completa). */
export type EventLike = Pick<
	CongregationEvent,
	| "kind"
	| "title"
	| "startDate"
	| "endDate"
	| "message"
	| "notifyDaysBefore"
	| "notifiedAt"
	| "midweekAction"
	| "midweekDay"
	| "midweekTime"
	| "weekendAction"
	| "weekendDay"
	| "weekendTime"
>;

/** Nombre que se muestra: el título si lo tiene; si no, el tipo («Asamblea de circuito»). */
export function eventName(e: Pick<EventLike, "kind" | "title">): string {
	return e.title?.trim() || EVENT_KIND_LABEL[e.kind];
}

/** Lunes (AAAA-MM-DD) de la semana que afecta el evento: la de su fecha de inicio. */
export function eventWeek(e: Pick<EventLike, "startDate">): string {
	return toISODate(mondayOf(parseISODate(e.startDate)));
}

/** Lunes de la semana de una reunión guardada (entre semana se guarda el lunes; fin de semana, el sábado). */
export function meetingWeek(storedDate: string): string {
	return toISODate(mondayOf(parseISODate(storedDate)));
}

export interface MeetingEffect {
	action: EventMeetingAction;
	day: string | null;
	time: string | null;
}

export function effectOf(e: EventLike, type: MeetingType): MeetingEffect {
	return type === "midweek"
		? { action: e.midweekAction, day: e.midweekDay, time: e.midweekTime }
		: { action: e.weekendAction, day: e.weekendDay, time: e.weekendTime };
}

/** Cambios de una sola semana («mover») de estos eventos, para `MeetingSchedules.overrides`. */
export function buildOverrides(events: EventLike[]): NonNullable<MeetingSchedules["overrides"]> {
	const out: NonNullable<MeetingSchedules["overrides"]> = {};
	for (const e of events) {
		const week = eventWeek(e);
		for (const type of ["midweek", "weekend"] as const) {
			const fx = effectOf(e, type);
			if (fx.action !== "move" || (!fx.day && !fx.time)) continue;
			out[week] = { ...out[week], [type]: { day: fx.day, time: fx.time } };
		}
	}
	return out;
}

/** El evento de esa semana que afecta esa reunión (cancelarla o moverla), si hay; si hay varios, el que cancela gana. */
export function eventForMeeting<T extends EventLike>(events: T[], storedDate: string, type: MeetingType): T | null {
	const week = meetingWeek(storedDate);
	const mine = events.filter((e) => eventWeek(e) === week && effectOf(e, type).action !== "none");
	return mine.find((e) => effectOf(e, type).action === "cancel") ?? mine[0] ?? null;
}

/** La visita del superintendente de esa semana (cambia el programa aunque no mueva ni cancele nada). */
export function coVisitForWeek<T extends EventLike>(events: T[], storedDate: string): T | null {
	const week = meetingWeek(storedDate);
	return events.find((e) => e.kind === "co_visit" && eventWeek(e) === week) ?? null;
}

/** Estado de una reunión cancelada por el evento (la columna `status` solo admite estos valores). */
export function cancelledStatus(kind: EventKind, type: MeetingType): "cancelled" | "cancelled_memorial" | "cancelled_assembly" {
	if (type === "weekend") return "cancelled";
	return kind === "memorial" ? "cancelled_memorial" : "cancelled_assembly";
}

/** Día en que se avisa: `notifyDaysBefore` días antes del inicio. */
export function notifyOn(e: Pick<EventLike, "startDate" | "notifyDaysBefore">): string {
	return toISODate(addDays(parseISODate(e.startDate), -Math.max(0, e.notifyDaysBefore)));
}

/** ¿Toca avisar hoy? Aún no se avisó, ya llegó el día del aviso y el evento no ha terminado. */
export function isNoticeDue(e: Pick<EventLike, "startDate" | "endDate" | "notifyDaysBefore" | "notifiedAt">, today: string): boolean {
	return !e.notifiedAt && today >= notifyOn(e) && today <= e.endDate;
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function longDate(iso: string): string {
	const d = parseISODate(iso);
	return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}

/** «7:00 p. m.» desde «19:00». */
export function time12(t: string | null | undefined): string | null {
	const m = t?.match(/^(\d{1,2}):(\d{2})/);
	if (!m) return null;
	const h = Number(m[1]);
	return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "a. m." : "p. m."}`;
}

/** «del viernes 12 de junio al domingo 14 de junio» o «el martes 31 de marzo». */
export function eventDates(e: Pick<EventLike, "startDate" | "endDate">): string {
	if (e.startDate === e.endDate) return `el ${longDate(e.startDate)}`;
	return `del ${longDate(e.startDate)} al ${longDate(e.endDate)}`;
}

/** Qué pasa con cada reunión, en una frase («La reunión de entre semana se cancela.»), o null sin cambios. */
export function meetingChange(e: EventLike, type: MeetingType): string | null {
	const fx = effectOf(e, type);
	if (fx.action === "cancel") return `La reunión de ${MEETING_LABEL[type]} se cancela.`;
	if (fx.action === "move") {
		const t = time12(fx.time);
		const when = [fx.day ? `al ${fx.day.toLowerCase()}` : null, t ? `a las ${t}` : null].filter(Boolean).join(" ");
		return when ? `La reunión de ${MEETING_LABEL[type]} pasa ${when}${when.endsWith(".") ? "" : "."}` : null;
	}
	return null;
}

/** Largo máximo del mensaje del evento dentro del aviso (el texto completo se ve en «Próximos eventos» de Mi Panel). */
export const NOTICE_MESSAGE_MAX = 140;

/** Recorta un texto a `max` caracteres sin partir palabras, en una sola línea, con «…». */
export function shortText(text: string | null | undefined, max = NOTICE_MESSAGE_MAX): string | null {
	const clean = text?.replace(/\s+/g, " ").trim();
	if (!clean) return null;
	if (clean.length <= max) return clean;
	const cut = clean.slice(0, max);
	const space = cut.lastIndexOf(" ");
	return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:]+$/, "")}…`;
}

/** Texto del aviso a la congregación: qué, cuándo, qué pasa con las reuniones y el mensaje opcional (recortado). */
export function noticeText(e: EventLike): string {
	const parts = [`${eventName(e)}: ${eventDates(e)}.`, meetingChange(e, "midweek"), meetingChange(e, "weekend"), shortText(e.message)];
	return parts.filter(Boolean).join("\n");
}

/** ¿Se muestra en «Próximos eventos» de Mi Panel? Desde el día del aviso (`notifyDaysBefore` días antes) hasta que termina. */
export function isUpcomingVisible(e: Pick<EventLike, "startDate" | "endDate" | "notifyDaysBefore">, today: string): boolean {
	return today >= notifyOn(e) && today <= e.endDate;
}

/** Problema al guardar, o null. */
export function validateEvent(e: EventLike): string | null {
	if (e.endDate < e.startDate) return "end_before_start";
	if (meetingWeek(e.endDate) !== eventWeek(e) && (e.midweekAction !== "none" || e.weekendAction !== "none")) return "spans_weeks";
	if (e.kind === "other" && !e.title?.trim()) return "title_required";
	for (const type of ["midweek", "weekend"] as const) {
		const fx = effectOf(e, type);
		if (fx.action === "move" && (!fx.day || !fx.time)) return "move_needs_day_and_time";
		if (fx.day && !MEETING_DAYS.includes(fx.day as (typeof MEETING_DAYS)[number])) return "invalid_day";
		if (fx.time && !/^\d{2}:\d{2}$/.test(fx.time)) return "invalid_time";
	}
	return null;
}
