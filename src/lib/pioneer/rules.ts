// Reglas puras del módulo «Precursorado» (con pruebas en __tests__/pioneer.test.ts).
import { calendarYearForServiceMonth, getServiceYear, SERVICE_YEAR_MONTHS } from "@/lib/serviceYear";

export type StudyStatus = "return_visit" | "active" | "progressive" | "finished";

export const STUDY_STATUS_LABEL: Record<StudyStatus, string> = {
	return_visit: "Revisita",
	active: "Activo",
	progressive: "Progresivo",
	finished: "Terminado",
};

/** Los que cuentan como cursos bíblicos en el informe. */
export const ACTIVE_STUDY_STATUSES: readonly StudyStatus[] = ["active", "progressive"];

/** 1 = lunes … 7 = domingo (como ISO). */
export const WEEKDAY_LABEL: Record<number, string> = {
	1: "Lunes",
	2: "Martes",
	3: "Miércoles",
	4: "Jueves",
	5: "Viernes",
	6: "Sábado",
	7: "Domingo",
};

export const MAX_HOURS_PER_ENTRY = 24;

/** Día de la semana (1 = lunes … 7 = domingo) de una fecha AAAA-MM-DD. */
export function isoWeekday(date: string): number {
	const [y, m, d] = date.split("-").map(Number);
	const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
	return day === 0 ? 7 : day;
}

/** El día siguiente (1 = lunes … 7 = domingo). */
export function nextWeekday(weekday: number): number {
	return weekday === 7 ? 1 : weekday + 1;
}

/** Prefijo AAAA-MM de un mes, para filtrar fechas AAAA-MM-DD. */
export function monthPrefix(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, "0")}`;
}

/** Suma de horas, redondeada a 2 decimales (evita 0.30000000000000004). */
export function sumHours(entries: { hours: number }[]): number {
	return Math.round(entries.reduce((s, e) => s + e.hours, 0) * 100) / 100;
}

/** Lo que se precarga en el informe de un mes: las horas anotadas en ese mes y cuántos estudios están Activos o Progresivos. */
export function reportPrefill(
	entries: { entryDate: string; hours: number }[],
	studies: { status: StudyStatus }[],
	year: number,
	month: number,
): { hours: number; bibleStudies: number } {
	const prefix = monthPrefix(year, month);
	return {
		hours: sumHours(entries.filter((e) => e.entryDate.startsWith(prefix))),
		bibleStudies: studies.filter((s) => ACTIVE_STUDY_STATUSES.includes(s.status)).length,
	};
}

/** A quién avisar hoy: los estudios (no terminados) cuyo día es mañana, agrupados por precursor. */
export function studyReminders<T extends { userId: string; name: string; status: StudyStatus; weekday: number | null }>(
	studies: T[],
	today: string,
): Map<string, string[]> {
	const tomorrow = nextWeekday(isoWeekday(today));
	const out = new Map<string, string[]>();
	for (const s of studies) {
		if (s.status === "finished" || s.weekday !== tomorrow) continue;
		out.set(s.userId, [...(out.get(s.userId) ?? []), s.name]);
	}
	for (const names of out.values()) names.sort((a, b) => a.localeCompare(b, "es"));
	return out;
}

/** «Ana», «Ana y Luis», «Ana, Luis y Marta». */
export function joinNames(names: string[]): string {
	if (names.length <= 1) return names[0] ?? "";
	return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** Texto del aviso del día anterior. */
export function reminderBody(names: string[], tomorrowWeekday: number): string {
	return `Mañana (${WEEKDAY_LABEL[tomorrowWeekday].toLowerCase()}) toca visitar a ${joinNames(names)}.`;
}

/** Meta anual del precursor regular (horas de servicio + proyectos). */
export const YEAR_GOAL_HOURS = 600;

export interface ProgressMonth {
	year: number;
	month: number;
	/** Horas del informe enviado (servicio + proyectos), o null si aún no hay informe de ese mes. */
	reported: number | null;
	/** Horas anotadas en Precursorado con fecha en ese mes. */
	logged: number;
	/** Lo que cuenta: el informe si ya lo hay; si no, lo anotado. */
	hours: number;
}

/** Los 12 meses de un año de servicio (septiembre a agosto) con sus horas, y el total. */
export function progressMonths(
	serviceYear: number,
	reports: { periodYear: number; periodMonth: number; hours: number | null; projectHours: number | null }[],
	entries: { entryDate: string; hours: number }[],
): { months: ProgressMonth[]; total: number } {
	const months = SERVICE_YEAR_MONTHS.map(({ month }) => {
		const year = calendarYearForServiceMonth(serviceYear, month);
		const report = reports.find((r) => r.periodYear === year && r.periodMonth === month);
		const reported = report ? Math.round(((report.hours ?? 0) + (report.projectHours ?? 0)) * 100) / 100 : null;
		const logged = sumHours(entries.filter((e) => e.entryDate.startsWith(monthPrefix(year, month))));
		return { year, month, reported, logged, hours: reported ?? logged };
	});
	return { months, total: sumHours(months) };
}

/** Años de servicio para el selector: del primero con datos al actual, del más nuevo al más viejo (al menos el actual). */
export function serviceYearOptions(current: number, firstDates: (string | null)[]): number[] {
	const years = firstDates.filter((d): d is string => !!d).map((d) => getServiceYear(Number(d.slice(0, 4)), Number(d.slice(5, 7))));
	const first = Math.min(current, ...years);
	const out: number[] = [];
	for (let y = current; y >= Math.max(first, current - 20); y--) out.push(y);
	return out;
}
