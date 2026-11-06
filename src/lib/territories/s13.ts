// Registro de asignación de territorio (S-13), puro y con pruebas. Cada asignación de un territorio (a un capitán) es una línea
// del formulario y cada salida de predicación a ese territorio es una casilla «Asignado a»: arriba el nombre del capitán, abajo la
// fecha en que se predicó y, solo si ese día se completó el territorio, la misma fecha en «se completó». Las casillas se agregan
// hasta que la asignación se completa (normalmente unas 4 por mes, pueden ser más).

export interface S13Territory {
	id: string;
	number: string;
	name: string | null;
}

export interface S13Assignment {
	id: string;
	territoryId: string;
	assigneeName: string;
	/** AAAA-MM-DD (hora de Nicaragua). */
	assignedOn: string;
	/** AAAA-MM-DD en que se completó o devolvió; null si sigue vigente. */
	resolvedOn: string | null;
	status: "assigned" | "completed" | "returned";
}

/** Una salida de predicación que ya se hizo (fecha pasada o de hoy) a un territorio. */
export interface S13Session {
	territoryId: string;
	/** Asignación vigente al programarla (las salidas viejas no la tienen: se ubican por fecha). */
	assignmentId: string | null;
	date: string;
}

/** Una casilla «Asignado a». */
export interface S13Block {
	assigneeName: string;
	/** Día en que se predicó (null si la asignación no tuvo salidas registradas en el año). */
	preachedOn: string | null;
	/** Solo si ese día se completó el territorio. */
	completedOn: string | null;
}

export interface S13AssignmentRow {
	assigneeName: string;
	assignedOn: string;
	status: S13Assignment["status"];
	/** Fecha en que se completó o devolvió dentro del año (null si sigue vigente o se resolvió después). */
	resolvedOn: string | null;
	/** Días en que se predicó dentro del año, en orden. */
	sessions: string[];
	blocks: S13Block[];
}

export interface S13Record {
	territoryId: string;
	number: string;
	name: string | null;
	/** Última fecha en que se completó una asignación antes del año de servicio (va en la primera línea si esa asignación no se
	 * completa en el año). */
	previousCompleted: string | null;
	/** Última fecha en que se completó, contando las del año (lo que muestra la pantalla). */
	lastCompleted: string | null;
	assignments: S13AssignmentRow[];
}

export interface S13Line {
	number: string;
	lastCompleted: string | null;
	blocks: S13Block[];
	/** Segunda línea (o siguientes) del mismo territorio. */
	continuation: boolean;
}

/** Casillas «Asignado a» del formulario oficial; si alguna asignación tiene más salidas, la hoja agrega columnas. */
export const S13_MIN_BLOCKS = 4;
/** Más de esto no cabe ni en horizontal: la asignación sigue en la línea de abajo. */
export const S13_MAX_BLOCKS = 8;

/** El año de servicio que empieza en septiembre de `serviceYear`: «2025 - 2026». */
export function serviceYearLabel(serviceYear: number): string {
	return `${serviceYear} - ${serviceYear + 1}`;
}

export function serviceYearRange(serviceYear: number): { start: string; end: string } {
	return { start: `${serviceYear}-09-01`, end: `${serviceYear + 1}-08-31` };
}

/** Año de servicio de una fecha AAAA-MM-DD. */
export function serviceYearOf(date: string): number {
	const year = Number(date.slice(0, 4));
	return Number(date.slice(5, 7)) >= 9 ? year : year - 1;
}

/** Años de servicio que se pueden elegir: desde el de la primera asignación hasta el actual, del más reciente al más antiguo. */
export function availableServiceYears(assignments: { assignedOn: string }[], current: number): number[] {
	const first = assignments.reduce((min, a) => Math.min(min, serviceYearOf(a.assignedOn)), current);
	const years: number[] = [];
	for (let y = current; y >= first; y--) years.push(y);
	return years;
}

/** 2025-09-12 → 12/09/25 (lo que cabe en las casillas del formulario). */
export function s13Date(date: string | null): string {
	if (!date) return "";
	return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(2, 4)}`;
}

const byNumber = (a: { number: string }, b: { number: string }) => a.number.localeCompare(b.number, "es", { numeric: true });

/** Casillas de una asignación: una por salida; la fecha de «se completó» va en la salida de ese día (o, si se marcó otro día, en la
 * última salida anterior; sin salidas, una casilla sola con el nombre). */
function blocksOf(name: string, sessions: string[], completedOn: string | null): S13Block[] {
	const blocks: S13Block[] = sessions.map((d) => ({ assigneeName: name, preachedOn: d, completedOn: null }));
	if (completedOn) {
		let i = sessions.lastIndexOf(completedOn);
		if (i < 0) i = sessions.reduce((last, d, k) => (d <= completedOn ? k : last), -1);
		if (i >= 0) blocks[i].completedOn = completedOn;
		else blocks.push({ assigneeName: name, preachedOn: null, completedOn });
	}
	if (blocks.length === 0) blocks.push({ assigneeName: name, preachedOn: null, completedOn: null });
	return blocks;
}

/** Una fila por territorio (por número) con las asignaciones que estuvieron vigentes en algún momento del año y sus salidas. */
export function buildS13(territories: S13Territory[], assignments: S13Assignment[], sessions: S13Session[], serviceYear: number): S13Record[] {
	const { start, end } = serviceYearRange(serviceYear);
	const group = <T extends { territoryId: string }>(items: T[]) => {
		const map = new Map<string, T[]>();
		for (const it of items) map.set(it.territoryId, [...(map.get(it.territoryId) ?? []), it]);
		return map;
	};
	const assignmentsBy = group(assignments);
	const sessionsBy = group(sessions.filter((s) => s.date >= start && s.date <= end));

	return [...territories].sort(byNumber).map((t) => {
		const list = [...(assignmentsBy.get(t.id) ?? [])].sort((a, b) => a.assignedOn.localeCompare(b.assignedOn));
		const latestCompleted = (until: string, inclusive: boolean) =>
			list.reduce<string | null>(
				(max, a) =>
					a.status === "completed" && a.resolvedOn && (inclusive ? a.resolvedOn <= until : a.resolvedOn < until) && (!max || a.resolvedOn > max)
						? a.resolvedOn
						: max,
				null,
			);
		const previousCompleted = latestCompleted(start, false);
		const lastCompleted = latestCompleted(end, true);
		const territorySessions = sessionsBy.get(t.id) ?? [];
		const rows = list
			.filter((a) => a.assignedOn <= end && (a.resolvedOn == null || a.resolvedOn >= start))
			.map((a) => {
				// Salidas de esta asignación: las que la nombran, o (salidas viejas sin asignación) las que caen en sus fechas.
				const own = territorySessions
					.filter((s) =>
						s.assignmentId
							? s.assignmentId === a.id
							: s.date >= a.assignedOn && (a.resolvedOn == null || s.date <= a.resolvedOn),
					)
					.map((s) => s.date);
				const dates = [...new Set(own)].sort();
				const resolvedOn = a.resolvedOn != null && a.resolvedOn <= end ? a.resolvedOn : null;
				const completedOn = a.status === "completed" ? resolvedOn : null;
				return {
					assigneeName: a.assigneeName,
					assignedOn: a.assignedOn,
					status: a.status,
					resolvedOn,
					sessions: dates,
					blocks: blocksOf(a.assigneeName, dates, completedOn),
				};
			});
		return { territoryId: t.id, number: t.number, name: t.name, previousCompleted, lastCompleted, assignments: rows };
	});
}

/** Cuántas casillas «Asignado a» lleva la hoja: 4 como el formulario, más si alguna asignación tuvo más salidas (hasta 8). */
export function s13BlockCount(records: S13Record[]): number {
	const most = records.reduce((m, r) => r.assignments.reduce((n, a) => Math.max(n, a.blocks.length), m), 0);
	return Math.min(S13_MAX_BLOCKS, Math.max(S13_MIN_BLOCKS, most));
}

/** Líneas del formulario: una por asignación (partida si pasa de `perLine` casillas); un territorio sin asignaciones en el año
 * ocupa una línea vacía. «Última fecha en que se completó»: cuando la asignación se completa, esa fecha va en su línea (la parte
 * que tiene la salida de ese día); la primera línea de un territorio que no se completó lleva la última fecha anterior al año. */
export function s13Lines(records: S13Record[], perLine: number): S13Line[] {
	const lines: S13Line[] = [];
	for (const r of records) {
		const chunks: { blocks: S13Block[]; completed: string | null }[] = [];
		for (const a of r.assignments) {
			const completedOn = a.blocks.find((b) => b.completedOn)?.completedOn ?? null;
			const parts: S13Block[][] = [];
			for (let i = 0; i < a.blocks.length; i += perLine) parts.push(a.blocks.slice(i, i + perLine));
			parts.forEach((blocks) => chunks.push({ blocks, completed: completedOn && blocks.some((b) => b.completedOn) ? completedOn : null }));
		}
		if (chunks.length === 0) chunks.push({ blocks: [], completed: null });
		chunks.forEach((c, i) =>
			lines.push({ number: r.number, lastCompleted: c.completed ?? (i === 0 ? r.previousCompleted : null), blocks: c.blocks, continuation: i > 0 }),
		);
	}
	return lines;
}

/** Hojas de `perPage` líneas (al menos una, en blanco si no hay territorios). */
export function s13Pages(lines: S13Line[], perPage: number): S13Line[][] {
	if (lines.length === 0) return [[]];
	const pages: S13Line[][] = [];
	for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
	return pages;
}
