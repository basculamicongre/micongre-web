import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { publicTalkOutlines, speakerCongregations, speakers, talkArrangements, weekendMeetings } from "@/db/schema";
import { readMeetingSchedules } from "@/lib/assignments/stats";
import { effectiveMeetingDate, effectiveMeetingTime } from "@/lib/attendance/summary";
import { assertCanAccessWeekendModule } from "@/lib/rbac/guards";
import type { BuilderContext } from "../registry";
import type { ReportDoc } from "../types";
import { dayLabel, parseRange, time12 } from "./meetingDates";

/** «Invitados de A y B», o «Oradores invitados» si ese mes no hay arreglo de discursos. */
export function incomingTitle(congregations: string[]): string {
	const names = [...new Set(congregations.map((c) => c.trim()).filter(Boolean))];
	if (names.length === 0) return "Oradores invitados";
	const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
	return `Invitados de ${list}`;
}

/** «Reunión: sábado, 4:00 p.m.» con el día y la hora de Congregación; vacío si no están configurados. */
export function weekendScheduleLabel(day: string | null | undefined, time: string | null | undefined): string {
	const parts = [day?.trim().toLowerCase(), time12(time)].filter((p): p is string => !!p);
	return parts.length ? `Reunión: ${parts.join(", ")}` : "";
}

/** Invitados (mes): los oradores visitantes de las reuniones de fin de semana del mes (cada semana en el mes de su lunes), con su
 * congregación y la fecha de cada discurso. El título lleva las congregaciones con las que hay arreglo de discursos ese mes. */
export async function buildIncoming({ db, session, params }: BuilderContext): Promise<ReportDoc> {
	assertCanAccessWeekendModule(session);
	const range = parseRange(params, "month");
	const [year, month] = range.slug.split("-").map(Number);

	const [rows, arranged, schedules] = await Promise.all([
		db
			.select({
				date: weekendMeetings.meetingDate,
				number: publicTalkOutlines.number,
				title: publicTalkOutlines.title,
				speaker: speakers.fullName,
				congregation: speakerCongregations.name,
			})
			.from(weekendMeetings)
			.innerJoin(speakers, eq(speakers.id, weekendMeetings.speakerId))
			.leftJoin(speakerCongregations, eq(speakerCongregations.id, speakers.congregationId))
			.leftJoin(publicTalkOutlines, eq(publicTalkOutlines.id, weekendMeetings.talkOutlineId))
			.where(and(gte(weekendMeetings.meetingDate, range.from), lte(weekendMeetings.meetingDate, range.to), eq(speakers.kind, "visiting"), ne(weekendMeetings.status, "cancelled")))
			.orderBy(asc(weekendMeetings.meetingDate)),
		range.scope === "month"
			? db
					.select({ name: speakerCongregations.name })
					.from(talkArrangements)
					.innerJoin(speakerCongregations, eq(speakerCongregations.id, talkArrangements.congregationId))
					.where(and(eq(talkArrangements.year, year), eq(talkArrangements.month, month), inArray(talkArrangements.status, ["planned", "pending", "accepted"])))
					.orderBy(asc(speakerCongregations.name))
			: Promise.resolve([] as { name: string }[]),
		readMeetingSchedules(db),
	]);

	const schedule = weekendScheduleLabel(schedules?.weekend?.day, schedules?.weekend?.time);

	return {
		title: incomingTitle(arranged.map((a) => a.name)),
		subtitle: [range.label, schedule].filter(Boolean).join(" · "),
		fileName: `invitados-${range.slug}`,
		blocks: rows.length
			? [
					{
						type: "table",
						table: {
							sheetName: "Invitados",
							columns: [
								{ label: "Fecha", width: 2.2 },
								{ label: "N.º", width: 0.6, align: "center" },
								{ label: "Título del bosquejo", width: 3.4 },
								{ label: "Orador", width: 2 },
								{ label: "Congregación", width: 2.2 },
							],
							rows: rows.map((r) => {
								// La fecha real (día de reunión de Congregación, o el que fijó un evento), con la hora si cambió.
								const date = effectiveMeetingDate(r.date, "weekend", schedules);
								const time = effectiveMeetingTime(r.date, "weekend", schedules);
								const moved = time && time !== schedules?.weekend?.time ? ` · ${time12(time)}` : "";
								return [`${dayLabel(date)}${moved}`, r.number ?? "", r.title ?? "", r.speaker ?? "", r.congregation ?? ""];
							}),
						},
					},
				]
			: [{ type: "paragraph", text: "No hay oradores invitados en este periodo.", muted: true }],
		footer: "Mi Congre",
	};
}
