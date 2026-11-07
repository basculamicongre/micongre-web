// Eventos de la congregación: guardar, aplicarlos a las reuniones de su semana y avisar a la congregación (ver lib/events/rules.ts).
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
	congregationEvents,
	coVisitSchedules,
	midweekAssignments,
	midweekMeetings,
	notifications,
	operationalSchedules,
	users,
	weekendMeetings,
	type CongregationEvent,
} from "@/db/schema";
import { addDays, parseISODate, toISODate } from "@/lib/mwb/dates";
import { notifyUsers } from "@/lib/push/dispatch";
import { notHiddenAdmin } from "@/lib/rbac/visibility";
import { effectiveMeetingDate, effectiveMeetingTime } from "@/lib/attendance/summary";
import { readMeetingSchedules } from "@/lib/assignments/stats";
import {
	cancelledStatus,
	coVisitForWeek,
	eventForMeeting,
	eventName,
	eventWeek,
	eventDates,
	isNoticeDue,
	isUpcomingVisible,
	meetingChange,
	meetingWeek as meetingWeekOf,
	noticeText,
	validateEvent,
	type EventLike,
	type MeetingType,
} from "./rules";

export class EventFailure extends Error {
	constructor(public code: string, public status = 400) {
		super(code);
	}
}

export type EventInput = Omit<EventLike, "notifiedAt">;

export async function listEvents(db: Database, fromDate?: string): Promise<CongregationEvent[]> {
	const q = db.select().from(congregationEvents);
	return fromDate
		? q.where(gte(congregationEvents.endDate, fromDate)).orderBy(asc(congregationEvents.startDate))
		: q.orderBy(asc(congregationEvents.startDate));
}

export interface UpcomingEventView {
	id: string;
	kind: CongregationEvent["kind"];
	title: string;
	startDate: string;
	endDate: string;
	/** «del viernes 12 de junio al domingo 14 de junio». */
	dates: string;
	message: string | null;
	/** Qué pasa con cada reunión («La reunión de entre semana se cancela.»), null sin cambios. */
	midweek: string | null;
	weekend: string | null;
}

/** «Próximos eventos» de Mi Panel: los que ya entraron en sus días de aviso y no han terminado, del más cercano al más lejano. */
export async function upcomingEvents(db: Database, today: string): Promise<UpcomingEventView[]> {
	const rows = await listEvents(db, today);
	return rows
		.filter((e) => isUpcomingVisible(e, today))
		.map((e) => ({
			id: e.id,
			kind: e.kind,
			title: eventName(e),
			startDate: e.startDate,
			endDate: e.endDate,
			dates: eventDates(e),
			message: e.message?.trim() || null,
			midweek: meetingChange(e, "midweek"),
			weekend: meetingChange(e, "weekend"),
		}));
}

/** Eventos cuya semana cae entre estas fechas (AAAA-MM-DD): los que pueden afectar esas reuniones. */
export async function eventsBetween(db: Database, from: string, to: string): Promise<CongregationEvent[]> {
	return db
		.select()
		.from(congregationEvents)
		.where(and(gte(congregationEvents.startDate, from), lte(congregationEvents.startDate, toISODate(addDays(parseISODate(to), 6)))));
}

export async function createEvent(db: Database, input: EventInput, userId: string, coVisitId?: string): Promise<CongregationEvent> {
	const problem = validateEvent({ ...input, notifiedAt: null });
	if (problem) throw new EventFailure(problem);
	const [row] = await db
		.insert(congregationEvents)
		.values({ ...input, coVisitId: coVisitId ?? null, createdByUserId: userId })
		.returning();
	await applyToMeetings(db, row);
	await notifyIfDue(db, row, todayLocal());
	return row;
}

export async function updateEvent(db: Database, id: string, patch: Partial<EventInput>, userId: string): Promise<CongregationEvent> {
	const [current] = await db.select().from(congregationEvents).where(eq(congregationEvents.id, id)).limit(1);
	if (!current) throw new EventFailure("not_found", 404);
	// La visita del superintendente: el tipo y las fechas los manda la visita.
	if (current.coVisitId) {
		delete patch.kind;
		delete patch.startDate;
		delete patch.endDate;
	}
	const next = { ...current, ...patch };
	const problem = validateEvent(next);
	if (problem) throw new EventFailure(problem);
	const changed = (Object.keys(patch) as (keyof EventInput)[]).some((k) => patch[k] !== current[k]);
	const [row] = await db
		.update(congregationEvents)
		.set({ ...patch, updatedAt: new Date(), ...(changed && current.notifiedAt ? { notifiedAt: null } : {}) })
		.where(eq(congregationEvents.id, id))
		.returning();
	await applyToMeetings(db, row, current);
	// Si cambió algo de un evento ya avisado, se reemplaza el aviso (cuando toque, que puede ser ya).
	if (changed && current.notificationId) await retractNotice(db, current.notificationId);
	await notifyIfDue(db, row, todayLocal(), userId);
	return row;
}

export async function deleteEvent(db: Database, id: string, opts: { fromCoVisit?: boolean } = {}): Promise<void> {
	const [current] = await db.select().from(congregationEvents).where(eq(congregationEvents.id, id)).limit(1);
	if (!current) return;
	if (current.coVisitId && !opts.fromCoVisit) throw new EventFailure("co_visit_event", 409);
	await revertMeetings(db, current);
	if (current.notificationId) await retractNotice(db, current.notificationId);
	await db.delete(congregationEvents).where(eq(congregationEvents.id, id));
}

/** Fechas (lunes a domingo) de la semana del evento. */
function weekRange(e: Pick<EventLike, "startDate">): { from: string; to: string } {
	const from = eventWeek(e);
	return { from, to: toISODate(addDays(parseISODate(from), 6)) };
}

/** Deshace lo que el evento hizo en sus reuniones: las canceladas por él vuelven a «programada» (sin las asignaciones que se quitaron). */
async function revertMeetings(db: Database, e: CongregationEvent): Promise<void> {
	await db.update(midweekMeetings).set({ status: "scheduled", eventId: null }).where(eq(midweekMeetings.eventId, e.id));
	await db.update(weekendMeetings).set({ status: "scheduled", eventId: null }).where(eq(weekendMeetings.eventId, e.id));
	if (e.kind === "co_visit") {
		const { from, to } = weekRange(e);
		await db
			.update(midweekMeetings)
			.set({ status: "scheduled" })
			.where(and(eq(midweekMeetings.status, "adjusted_co_visit"), gte(midweekMeetings.meetingDate, from), lte(midweekMeetings.meetingDate, to)));
	}
}

/**
 * Aplica el evento a las reuniones de su semana: las que cancela quedan canceladas, ligadas al evento y SIN asignaciones (partes,
 * presidente, oraciones, orador, conductor, lector y acomodadores). Con `previous`, primero deshace lo de la versión anterior. La de entre
 * semana de la visita del superintendente queda «Ajustada (visita SC)». Si la reunión aún no existe, el job diario lo aplica al crearla.
 */
export async function applyToMeetings(db: Database, e: CongregationEvent, previous?: CongregationEvent): Promise<void> {
	await revertMeetings(db, previous ?? e);
	const { from, to } = weekRange(e);
	for (const type of ["midweek", "weekend"] as const) {
		const action = type === "midweek" ? e.midweekAction : e.weekendAction;
		const table = type === "midweek" ? midweekMeetings : weekendMeetings;
		const meetings = await db
			.select({ id: table.id })
			.from(table)
			.where(and(gte(table.meetingDate, from), lte(table.meetingDate, to)));
		for (const m of meetings) {
			if (action === "cancel") await cancelMeeting(db, type, m.id, e);
			else if (type === "midweek" && e.kind === "co_visit") {
				await db.update(midweekMeetings).set({ status: "adjusted_co_visit" }).where(eq(midweekMeetings.id, m.id));
			}
		}
	}
}

async function cancelMeeting(db: Database, type: MeetingType, meetingId: string, e: CongregationEvent): Promise<void> {
	const status = cancelledStatus(e.kind, type);
	if (type === "midweek") {
		await db
			.update(midweekMeetings)
			.set({ status: status as "cancelled_memorial" | "cancelled_assembly", eventId: e.id, chairmanUserId: null, openingPrayerUserId: null })
			.where(eq(midweekMeetings.id, meetingId));
		await db.update(midweekAssignments).set({ mainAssigneeId: null, assistantAssigneeId: null }).where(eq(midweekAssignments.meetingId, meetingId));
	} else {
		await db
			.update(weekendMeetings)
			.set({
				status: "cancelled",
				eventId: e.id,
				chairmanUserId: null,
				speakerId: null,
				talkOutlineId: null,
				watchtowerConductorId: null,
				watchtowerReaderId: null,
				prayerUserId: null,
			})
			.where(eq(weekendMeetings.id, meetingId));
	}
	await db
		.update(operationalSchedules)
		.set({ assignedUserId: null })
		.where(and(eq(operationalSchedules.meetingType, type), eq(operationalSchedules.meetingId, meetingId)));
}

/** Vuelve a aplicar los eventos que aún no terminan (o terminaron hace poco): el job diario, para las reuniones creadas después del evento. */
export async function applyUpcomingEvents(db: Database, today: string): Promise<number> {
	const rows = await listEvents(db, toISODate(addDays(parseISODate(today), -7)));
	for (const e of rows) await applyToMeetings(db, e);
	return rows.length;
}

/** Avisa los eventos a los que ya les toca (job diario). */
export async function notifyDueEvents(db: Database, today: string): Promise<number> {
	const rows = await listEvents(db, today);
	let sent = 0;
	for (const e of rows) if (await notifyIfDue(db, e, today)) sent++;
	return sent;
}

async function notifyIfDue(db: Database, e: CongregationEvent, today: string, senderUserId?: string): Promise<boolean> {
	if (!isNoticeDue(e, today)) return false;
	const sender = senderUserId ?? e.createdByUserId ?? (await anyAdmin(db));
	if (!sender) return false;
	const message = noticeText(e);
	const [notice] = await db
		.insert(notifications)
		.values({ senderUserId: sender, scope: "congregation", groupId: null, message, expiresAt: e.endDate })
		.returning({ id: notifications.id });
	await db.update(congregationEvents).set({ notificationId: notice.id, notifiedAt: new Date() }).where(eq(congregationEvents.id, e.id));
	const recipients = await db.select({ id: users.id }).from(users).where(and(eq(users.accountStatus, "active"), notHiddenAdmin));
	await notifyUsers(
		db,
		recipients.map((r) => r.id),
		{ title: eventName(e), body: message, url: "/panel" },
	);
	return true;
}

async function retractNotice(db: Database, notificationId: string): Promise<void> {
	await db.update(congregationEvents).set({ notificationId: null }).where(eq(congregationEvents.notificationId, notificationId));
	await db.delete(notifications).where(inArray(notifications.id, [notificationId]));
}

async function anyAdmin(db: Database): Promise<string | null> {
	const [row] = await db.select({ id: users.id }).from(users).where(eq(users.systemRole, "admin")).limit(1);
	return row?.id ?? null;
}

/** Hoy en Nicaragua (UTC−6), AAAA-MM-DD. */
export function todayLocal(now = new Date()): string {
	return new Date(now.getTime() - 6 * 3_600_000).toISOString().slice(0, 10);
}

// --- Visita del superintendente: su evento se crea, cambia y se borra con la visita. ---

export async function syncCoVisitEvent(db: Database, visit: { id: string; startDate: string; endDate: string }, userId: string): Promise<void> {
	const [current] = await db.select().from(congregationEvents).where(eq(congregationEvents.coVisitId, visit.id)).limit(1);
	if (!current) {
		await createEvent(
			db,
			{
				kind: "co_visit",
				title: null,
				startDate: visit.startDate,
				endDate: visit.endDate,
				message: null,
				notifyDaysBefore: 15,
				midweekAction: "none",
				midweekDay: null,
				midweekTime: null,
				weekendAction: "none",
				weekendDay: null,
				weekendTime: null,
			},
			userId,
			visit.id,
		);
		return;
	}
	if (current.startDate === visit.startDate && current.endDate === visit.endDate) return;
	// Cambiaron las fechas: se mueve el evento (y su efecto en las reuniones) a la nueva semana.
	const [row] = await db
		.update(congregationEvents)
		.set({ startDate: visit.startDate, endDate: visit.endDate, updatedAt: new Date(), notifiedAt: null })
		.where(eq(congregationEvents.id, current.id))
		.returning();
	await applyToMeetings(db, row, current);
	if (current.notificationId) await retractNotice(db, current.notificationId);
	await notifyIfDue(db, row, todayLocal(), userId);
}

// --- Lo que ve cada reunión de su semana (planificadores, app Android, S-140). ---

export interface MeetingEventInfo {
	id: string;
	kind: CongregationEvent["kind"];
	name: string;
	startDate: string;
	endDate: string;
	/** "cancel" = la reunión no se celebra (en su lugar se muestra el evento); "move" = cambia de día y hora solo esa semana. */
	action: "cancel" | "move";
	day: string | null;
	time: string | null;
	message: string | null;
}

export interface CoVisitInfo {
	overseerName: string;
	midweekTalk: { title: string | null; song: number | null };
	publicTalk: { title: string | null; song: number | null };
	finalTalk: { title: string | null; song: number | null };
}

/** El evento que cancela o mueve esta reunión, la visita del superintendente de esa semana y la fecha y hora en que de verdad se celebra. */
export async function meetingContext(
	db: Database,
	storedDate: string,
	type: MeetingType,
): Promise<{ event: MeetingEventInfo | null; coVisit: CoVisitInfo | null; date: string; time: string | null }> {
	const week = meetingWeekOf(storedDate);
	const [rows, schedules] = await Promise.all([eventsBetween(db, week, week), readMeetingSchedules(db)]);
	const ev = eventForMeeting(rows, storedDate, type);
	const fx = ev ? (type === "midweek" ? { action: ev.midweekAction, day: ev.midweekDay, time: ev.midweekTime } : { action: ev.weekendAction, day: ev.weekendDay, time: ev.weekendTime }) : null;
	const visitEvent = coVisitForWeek(rows, storedDate);
	let coVisit: CoVisitInfo | null = null;
	if (visitEvent?.coVisitId) {
		const [v] = await db.select().from(coVisitSchedules).where(eq(coVisitSchedules.id, visitEvent.coVisitId)).limit(1);
		if (v) {
			coVisit = {
				overseerName: v.circuitOverseerName,
				midweekTalk: { title: v.midweekTalkTitle, song: v.midweekTalkSong },
				publicTalk: { title: v.publicTalkTitle, song: v.publicTalkSong },
				finalTalk: { title: v.finalTalkTitle, song: v.finalTalkSong },
			};
		}
	}
	return {
		event:
			ev && fx && fx.action !== "none"
				? { id: ev.id, kind: ev.kind, name: eventName(ev), startDate: ev.startDate, endDate: ev.endDate, action: fx.action, day: fx.day, time: fx.time, message: ev.message }
				: null,
		coVisit,
		date: effectiveMeetingDate(storedDate, type, schedules),
		time: effectiveMeetingTime(storedDate, type, schedules) ?? null,
	};
}
