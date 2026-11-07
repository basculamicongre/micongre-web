import { and, asc, desc, eq, gte, inArray, like, lte, min, ne, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { congregations, pioneerHours, pioneerStudies, serviceReports, type PioneerStudyStatus } from "@/db/schema";
import { getCurrentServiceYear } from "@/lib/serviceYear";
import { notifyUsers } from "@/lib/push/dispatch";
import { getActivePrivilegeCodes } from "@/lib/rbac/eligibility";
import { PRIVILEGE_CODES } from "@/lib/rbac/roles";
import {
	ACTIVE_STUDY_STATUSES,
	isoWeekday,
	monthPrefix,
	nextWeekday,
	progressMonths,
	reminderBody,
	reportPrefill,
	serviceYearOptions,
	studyReminders,
	YEAR_GOAL_HOURS,
} from "./rules";

/** Error del módulo con su código para la API (`not_found`…). */
export class PioneerFailure extends Error {
	constructor(
		public code: string,
		public status = 400,
	) {
		super(code);
	}
}

// ── Horas ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface HourEntryView {
	id: string;
	entryDate: string;
	hours: number;
	comment: string | null;
}

const hourColumns = { id: pioneerHours.id, entryDate: pioneerHours.entryDate, hours: pioneerHours.hours, comment: pioneerHours.comment };

/** Horas del mes, de la más reciente a la más vieja. */
export async function listHours(db: Database, userId: string, year: number, month: number): Promise<HourEntryView[]> {
	return db
		.select(hourColumns)
		.from(pioneerHours)
		.where(and(eq(pioneerHours.userId, userId), like(pioneerHours.entryDate, `${monthPrefix(year, month)}-%`)))
		.orderBy(desc(pioneerHours.entryDate), desc(pioneerHours.createdAt));
}

export async function createHours(db: Database, userId: string, input: { entryDate: string; hours: number; comment?: string | null }): Promise<string> {
	const [row] = await db
		.insert(pioneerHours)
		.values({ userId, entryDate: input.entryDate, hours: input.hours, comment: input.comment?.trim() || null })
		.returning({ id: pioneerHours.id });
	return row.id;
}

export async function updateHours(db: Database, userId: string, id: string, input: { entryDate?: string; hours?: number; comment?: string | null }): Promise<void> {
	const result = await db
		.update(pioneerHours)
		.set({
			...(input.entryDate ? { entryDate: input.entryDate } : {}),
			...(input.hours !== undefined ? { hours: input.hours } : {}),
			...(input.comment !== undefined ? { comment: input.comment?.trim() || null } : {}),
			updatedAt: new Date(),
		})
		.where(and(eq(pioneerHours.id, id), eq(pioneerHours.userId, userId)))
		.returning({ id: pioneerHours.id });
	if (result.length === 0) throw new PioneerFailure("not_found", 404);
}

export async function deleteHours(db: Database, userId: string, id: string): Promise<void> {
	await db.delete(pioneerHours).where(and(eq(pioneerHours.id, id), eq(pioneerHours.userId, userId)));
}

// ── Estudios ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface StudyView {
	id: string;
	name: string;
	status: PioneerStudyStatus;
	weekday: number | null;
	comment: string | null;
	latitude: number | null;
	longitude: number | null;
	updatedAt: Date;
}

export interface StudyInput {
	name: string;
	status: PioneerStudyStatus;
	weekday?: number | null;
	comment?: string | null;
	latitude?: number | null;
	longitude?: number | null;
}

const studyColumns = {
	id: pioneerStudies.id,
	name: pioneerStudies.name,
	status: pioneerStudies.status,
	weekday: pioneerStudies.weekday,
	comment: pioneerStudies.comment,
	latitude: pioneerStudies.latitude,
	longitude: pioneerStudies.longitude,
	updatedAt: pioneerStudies.updatedAt,
};

/** Solo los del propio precursor, por nombre. */
export async function listStudies(db: Database, userId: string): Promise<StudyView[]> {
	return db.select(studyColumns).from(pioneerStudies).where(eq(pioneerStudies.userId, userId)).orderBy(asc(pioneerStudies.name));
}

/** Dónde abrir el mapa cuando el estudio aún no tiene punto: el Salón del Reino (si la congregación tiene coordenadas). */
export async function mapCenter(db: Database): Promise<{ latitude: number; longitude: number } | null> {
	const [c] = await db.select({ latitude: congregations.latitude, longitude: congregations.longitude }).from(congregations).limit(1);
	return c?.latitude != null && c?.longitude != null ? { latitude: c.latitude, longitude: c.longitude } : null;
}

function studyValues(input: Partial<StudyInput>) {
	// El punto va completo o no va.
	const point = input.latitude !== undefined || input.longitude !== undefined
		? input.latitude != null && input.longitude != null
			? { latitude: input.latitude, longitude: input.longitude }
			: { latitude: null, longitude: null }
		: {};
	return {
		...(input.name !== undefined ? { name: input.name.trim() } : {}),
		...(input.status ? { status: input.status } : {}),
		...(input.weekday !== undefined ? { weekday: input.weekday ?? null } : {}),
		...(input.comment !== undefined ? { comment: input.comment?.trim() || null } : {}),
		...point,
	};
}

export async function createStudy(db: Database, userId: string, input: StudyInput): Promise<string> {
	const [row] = await db
		.insert(pioneerStudies)
		.values({ userId, name: input.name.trim(), status: input.status, ...studyValues(input) })
		.returning({ id: pioneerStudies.id });
	return row.id;
}

export async function updateStudy(db: Database, userId: string, id: string, input: Partial<StudyInput>): Promise<void> {
	const result = await db
		.update(pioneerStudies)
		.set({ ...studyValues(input), updatedAt: new Date() })
		.where(and(eq(pioneerStudies.id, id), eq(pioneerStudies.userId, userId)))
		.returning({ id: pioneerStudies.id });
	if (result.length === 0) throw new PioneerFailure("not_found", 404);
}

export async function deleteStudy(db: Database, userId: string, id: string): Promise<void> {
	await db.delete(pioneerStudies).where(and(eq(pioneerStudies.id, id), eq(pioneerStudies.userId, userId)));
}

// ── Informe ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** ¿Tiene ahora el privilegio «Herramientas de precursor»? (consulta la base: el token puede tener hasta 15 min). */
export async function hasPioneerTools(db: Database, userId: string): Promise<boolean> {
	return (await getActivePrivilegeCodes(db, userId)).includes(PRIVILEGE_CODES.PIONEER_TOOLS);
}

/** Lo que se precarga en el informe nuevo de un mes (null si la persona no usa las herramientas de precursor). */
export async function prefillFor(db: Database, userId: string, year: number, month: number): Promise<{ hours: number; bibleStudies: number } | null> {
	if (!(await hasPioneerTools(db, userId))) return null;
	const [entries, studies] = await Promise.all([
		db
			.select({ entryDate: pioneerHours.entryDate, hours: pioneerHours.hours })
			.from(pioneerHours)
			.where(and(eq(pioneerHours.userId, userId), like(pioneerHours.entryDate, `${monthPrefix(year, month)}-%`))),
		db
			.select({ status: pioneerStudies.status })
			.from(pioneerStudies)
			.where(and(eq(pioneerStudies.userId, userId), inArray(pioneerStudies.status, [...ACTIVE_STUDY_STATUSES]))),
	]);
	return reportPrefill(entries, studies, year, month);
}

// ── Progreso (año de servicio) ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Horas de cada mes del año de servicio (informe enviado o, si no hay, lo anotado), el total contra la meta y los años del selector. */
export async function progressFor(db: Database, userId: string, serviceYear?: number) {
	const current = getCurrentServiceYear();
	const year = serviceYear ?? current;
	const from = `${year}-09-01`;
	const to = `${year + 1}-08-31`;
	const [reports, entries, firstReport, firstEntry] = await Promise.all([
		db
			.select({ periodYear: serviceReports.periodYear, periodMonth: serviceReports.periodMonth, hours: serviceReports.hours, projectHours: serviceReports.projectHours })
			.from(serviceReports)
			.where(
				and(
					eq(serviceReports.userId, userId),
					or(
						and(eq(serviceReports.periodYear, year), gte(serviceReports.periodMonth, 9)),
						and(eq(serviceReports.periodYear, year + 1), lte(serviceReports.periodMonth, 8)),
					),
				),
			),
		db
			.select({ entryDate: pioneerHours.entryDate, hours: pioneerHours.hours })
			.from(pioneerHours)
			.where(and(eq(pioneerHours.userId, userId), gte(pioneerHours.entryDate, from), lte(pioneerHours.entryDate, to))),
		db
			.select({ y: min(serviceReports.periodYear) })
			.from(serviceReports)
			.where(eq(serviceReports.userId, userId)),
		db.select({ d: min(pioneerHours.entryDate) }).from(pioneerHours).where(eq(pioneerHours.userId, userId)),
	]);
	const { months, total } = progressMonths(year, reports, entries);
	// El primer informe cuenta desde enero de su año (no hace falta precisión: solo arma la lista de años).
	const firstReportDate = firstReport[0]?.y ? `${firstReport[0].y}-01-01` : null;
	return {
		serviceYear: year,
		goal: YEAR_GOAL_HOURS,
		months,
		total,
		years: serviceYearOptions(current, [firstReportDate, firstEntry[0]?.d ?? null]),
	};
}

// ── Aviso del día anterior (job diario) ────────────────────────────────────────────────────────────────────────────────────────

/** Avisa por push (sin entrada en el feed) a cada precursor los estudios que tiene mañana según el día anotado. */
export async function runStudyReminders(db: Database, today: string): Promise<{ users: number; studies: number }> {
	const tomorrow = nextWeekday(isoWeekday(today));
	const rows = await db
		.select({ userId: pioneerStudies.userId, name: pioneerStudies.name, status: pioneerStudies.status, weekday: pioneerStudies.weekday })
		.from(pioneerStudies)
		.where(and(eq(pioneerStudies.weekday, tomorrow), ne(pioneerStudies.status, "finished")));
	const byUser = studyReminders(rows, today);
	let studies = 0;
	for (const [userId, names] of byUser) {
		studies += names.length;
		await notifyUsers(db, [userId], { title: "Estudios de mañana", body: reminderBody(names, tomorrow), url: "/pioneer" });
	}
	return { users: byUser.size, studies };
}
