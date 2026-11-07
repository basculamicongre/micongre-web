import { and, gte, lte } from "drizzle-orm";
import type { Database } from "@/db/client";
import { midweekMeetings, weekendMeetings } from "@/db/schema";
import { readMeetingSchedules } from "@/lib/assignments/stats";
import { effectiveMeetingDate, effectiveMeetingTime } from "@/lib/attendance/summary";
import { isMeetingCancelled } from "@/lib/cleaning/meetings";
import { eventName } from "@/lib/events/rules";
import { listEvents } from "@/lib/events/service";
import { addDays, parseISODate, toISODate } from "@/lib/mwb/dates";
import { getUserAssignments } from "@/lib/queries/panel";
import { buildCalendarItems, monthRange, type CalendarItem } from "./build";

/** Todo lo que no es predicación y tiene fecha en el mes, para una persona: eventos de la congregación, reuniones y sus asignaciones. */
export async function calendarItems(db: Database, userId: string, month: string): Promise<CalendarItem[]> {
	const { from, to } = monthRange(month);
	// Las reuniones se guardan con el lunes o el sábado de su semana: se buscan desde 6 días antes para no perder la primera semana.
	const storedFrom = toISODate(addDays(parseISODate(from), -6));
	const [schedules, assignments, events, midweek, weekend] = await Promise.all([
		readMeetingSchedules(db),
		getUserAssignments(db, userId),
		listEvents(db, from),
		db
			.select({ date: midweekMeetings.meetingDate, status: midweekMeetings.status })
			.from(midweekMeetings)
			.where(and(gte(midweekMeetings.meetingDate, storedFrom), lte(midweekMeetings.meetingDate, to))),
		db
			.select({ date: weekendMeetings.meetingDate, status: weekendMeetings.status })
			.from(weekendMeetings)
			.where(and(gte(weekendMeetings.meetingDate, storedFrom), lte(weekendMeetings.meetingDate, to))),
	]);

	// Las reuniones canceladas no salen (el evento que las cancela sí).
	const meetings = [
		...midweek.filter((m) => !isMeetingCancelled(m.status)).map((m) => ({ stored: m.date, type: "midweek" as const })),
		...weekend.filter((m) => !isMeetingCancelled(m.status)).map((m) => ({ stored: m.date, type: "weekend" as const })),
	].map((m) => ({ date: effectiveMeetingDate(m.stored, m.type, schedules), time: effectiveMeetingTime(m.stored, m.type, schedules) ?? null, type: m.type }));

	// Las partes y los acomodadores llevan la hora de su reunión.
	const withTime = assignments.map((a) =>
		!a.time && (a.meetingType === "midweek" || a.meetingType === "weekend")
			? { ...a, time: effectiveMeetingTime(a.date, a.meetingType, schedules) }
			: a.meetingType === "operational" && !a.time && a.bucket?.startsWith("meeting:")
				? { ...a, time: effectiveMeetingTime(a.date, a.bucket.slice(8) as "midweek" | "weekend", schedules) }
				: a,
	);

	return buildCalendarItems(month, {
		assignments: withTime,
		events: events.filter((e) => e.startDate <= to).map((e) => ({ title: eventName(e), startDate: e.startDate, endDate: e.endDate, detail: e.message?.trim() || null })),
		meetings,
	});
}
