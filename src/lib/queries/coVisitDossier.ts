import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { fieldServiceGroups, midweekMeetings, monthlyAttendanceSummary, serviceReports, theocraticAppointments, users, weekendMeetings } from "@/db/schema";
import { readMeetingSchedules } from "@/lib/assignments/stats";
import { effectiveMeetingDate } from "@/lib/attendance/summary";
import { isMeetingCancelled } from "@/lib/cleaning/meetings";
import type { MeetingsHeld } from "@/lib/coVisit/s88";
import { notHiddenAdmin } from "@/lib/rbac/visibility";
import { SERVICE_YEAR_MONTHS, calendarYearForServiceMonth, getCurrentServiceYear } from "@/lib/serviceYear";

/** Orden alfabético en español, con números en orden natural. */
const byName = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

const PIONEER_APPOINTMENT_TYPES = ["regular_pioneer", "special_pioneer", "missionary"] as const;

export interface CoVisitDossier {
	serviceYear: number;
	pioneers: {
		id: string;
		fullName: string;
		appointmentType: string;
		totalHours: number;
		/** Horas acreditadas: las de proyecto (construcción, etc.) que cada publicador manda en sus informes del año de servicio. */
		creditHours: number;
		creditHoursNotes: string[];
	}[];
	activeByGroup: { groupId: string | null; groupName: string; members: { id: string; fullName: string }[] }[];
	inactivePublishers: { id: string; fullName: string }[];
	attendance: {
		periodYear: number | null;
		periodMonth: number | null;
		meetingType: string | null;
		meetingsRecorded: number | null;
		totalInPerson: number | null;
		totalZoom: number | null;
	}[];
	/** Reuniones celebradas por mes y tipo (sin las canceladas), por la fecha real en que se celebran. */
	meetingsHeld: MeetingsHeld[];
}

// Paquete S-61 (sin territorios ni cuentas — ver plan, las cuentas se
// gestionan en JW.ORG): concentrado de S-21 (precursores, publicadores
// activos por grupo, inactivos) y consolidado S-88 (asistencia) — todo
// derivado, sin tabla propia, mismo criterio que la tarjeta S-21 individual
// (publishers/[id]/s21/page.tsx).
export async function getCoVisitDossier(db: Database): Promise<CoVisitDossier> {
	const serviceYear = getCurrentServiceYear();
	// {año calendario}-{mes} válidos para el año de servicio actual — mismo
	// criterio que publishers/[id]/s21/page.tsx.
	const serviceYearPeriods = new Set(
		SERVICE_YEAR_MONTHS.map(({ month }) => `${calendarYearForServiceMonth(serviceYear, month)}-${month}`),
	);

	const [pioneerAppointments, groups, allActivePublishers, inactivePublishers, attendanceRows] = await Promise.all([
			db
				.select({
					userId: theocraticAppointments.userId,
					appointmentType: theocraticAppointments.appointmentType,
					fullName: users.fullName,
				})
				.from(theocraticAppointments)
				.innerJoin(users, eq(users.id, theocraticAppointments.userId))
				.where(
					and(
						isNull(theocraticAppointments.endDate),
						inArray(theocraticAppointments.appointmentType, [...PIONEER_APPOINTMENT_TYPES]),
						notHiddenAdmin,
					),
				),
			db
				.select({ id: fieldServiceGroups.id, name: fieldServiceGroups.name, color: fieldServiceGroups.color })
				.from(fieldServiceGroups),
			db
				.select({ id: users.id, fullName: users.fullName, fieldServiceGroupId: users.fieldServiceGroupId })
				.from(users)
				.where(and(eq(users.congregationStatus, "active"), notHiddenAdmin)),
			db
				.select({ id: users.id, fullName: users.fullName })
				.from(users)
				.where(and(eq(users.congregationStatus, "inactive"), notHiddenAdmin)),
			db.select().from(monthlyAttendanceSummary),
		]);

	const pioneerReports = pioneerAppointments.length
		? await db
				.select({
					userId: serviceReports.userId,
					hours: serviceReports.hours,
					projectHours: serviceReports.projectHours,
					creditHoursNote: serviceReports.creditHoursNote,
					periodYear: serviceReports.periodYear,
					periodMonth: serviceReports.periodMonth,
				})
				.from(serviceReports)
				.where(
					inArray(
						serviceReports.userId,
						pioneerAppointments.map((p) => p.userId),
					),
				)
		: [];

	const pioneers = pioneerAppointments.map((appt) => {
		const reportsForUser = pioneerReports.filter(
			(r) => r.userId === appt.userId && serviceYearPeriods.has(`${r.periodYear}-${r.periodMonth}`),
		);
		return {
			id: appt.userId,
			fullName: appt.fullName,
			appointmentType: appt.appointmentType,
			totalHours: reportsForUser.reduce((sum, r) => sum + (r.hours ?? 0), 0),
			creditHours: reportsForUser.reduce((sum, r) => sum + (r.projectHours ?? 0), 0),
			creditHoursNotes: reportsForUser.map((r) => r.creditHoursNote).filter((n): n is string => !!n),
		};
	});

	const activeByGroup = [
		...groups.map((g) => ({
			groupId: g.id,
			groupName: g.name,
			groupColor: g.color,
			members: allActivePublishers
				.filter((p) => p.fieldServiceGroupId === g.id)
				.map(({ id, fullName }) => ({ id, fullName })),
		})),
		{
			groupId: null,
			groupName: "Sin grupo asignado",
			groupColor: null,
			members: allActivePublishers.filter((p) => !p.fieldServiceGroupId).map(({ id, fullName }) => ({ id, fullName })),
		},
	]
		.filter((g) => g.members.length > 0)
		// Grupos por nombre (natural: «Grupo 2» antes que «Grupo 10»; «Sin grupo» al final) y sus integrantes en orden alfabético.
		.sort((a, b) => (a.groupId === null ? 1 : b.groupId === null ? -1 : byName(a.groupName, b.groupName)))
		.map((g) => ({ ...g, members: [...g.members].sort((a, b) => byName(a.fullName, b.fullName)) }));

	const meetingsHeld = await countMeetingsHeld(db);

	return {
		serviceYear,
		pioneers: [...pioneers].sort((a, b) => byName(a.fullName, b.fullName)),
		activeByGroup,
		inactivePublishers: [...inactivePublishers].sort((a, b) => byName(a.fullName, b.fullName)),
		attendance: attendanceRows,
		meetingsHeld,
	};
}

/** Reuniones de entre semana y de fin de semana celebradas en los últimos 25 meses, por mes y tipo (sin las canceladas). */
async function countMeetingsHeld(db: Database): Promise<MeetingsHeld[]> {
	const from = new Date();
	from.setUTCMonth(from.getUTCMonth() - 25);
	const since = from.toISOString().slice(0, 10);
	const today = new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);
	const [mid, wk, schedules] = await Promise.all([
		db.select({ date: midweekMeetings.meetingDate, status: midweekMeetings.status }).from(midweekMeetings).where(gte(midweekMeetings.meetingDate, since)),
		db.select({ date: weekendMeetings.meetingDate, status: weekendMeetings.status }).from(weekendMeetings).where(gte(weekendMeetings.meetingDate, since)),
		readMeetingSchedules(db),
	]);
	const counts = new Map<string, MeetingsHeld>();
	const add = (stored: string, status: string, type: "midweek" | "weekend") => {
		if (isMeetingCancelled(status)) return;
		const real = effectiveMeetingDate(stored, type, schedules);
		if (real > today) return; // solo las ya celebradas
		const y = Number(real.slice(0, 4));
		const m = Number(real.slice(5, 7));
		const k = `${y}-${m}-${type}`;
		const row = counts.get(k) ?? { periodYear: y, periodMonth: m, meetingType: type, count: 0 };
		row.count++;
		counts.set(k, row);
	};
	mid.forEach((r) => add(r.date, r.status, "midweek"));
	wk.forEach((r) => add(r.date, r.status, "weekend"));
	return [...counts.values()];
}
