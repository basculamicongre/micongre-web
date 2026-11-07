// Datos del Registro de asignación de territorio (S-13) para un año de servicio: lo usan la pestaña «Registro» y su descarga.
import { and, eq, gte, lte } from "drizzle-orm";
import type { Database } from "@/db/client";
import { preachingSessionTerritories, preachingSessions, territories, territoryAssignments, users } from "@/db/schema";
import { getCurrentServiceYear } from "@/lib/serviceYear";
import { availableServiceYears, buildS13, serviceYearRange, type S13Assignment, type S13Record } from "./s13";

export type TerritoryKind = "general" | "public_preaching";

/** Fecha AAAA-MM-DD en hora de Nicaragua (UTC−6, sin horario de verano). */
function localDate(value: Date): string {
	return new Date(value.getTime() - 6 * 3600_000).toISOString().slice(0, 10);
}

export interface TerritoryRecord {
	serviceYear: number;
	years: number[];
	kind: TerritoryKind;
	/** Tipos con al menos un territorio (para ofrecer el filtro solo si hay de los dos). */
	kinds: TerritoryKind[];
	records: S13Record[];
}

export async function loadTerritoryRecord(db: Database, serviceYear: number | null, kind: TerritoryKind): Promise<TerritoryRecord> {
	const current = getCurrentServiceYear();
	const requested = serviceYear ?? current;
	const range = serviceYearRange(requested);
	const today = localDate(new Date());
	const [terrs, rows, sessionRows] = await Promise.all([
		db.select({ id: territories.id, number: territories.number, name: territories.name, kind: territories.kind }).from(territories),
		db
			.select({
				id: territoryAssignments.id,
				territoryId: territoryAssignments.territoryId,
				assigneeName: users.fullName,
				assignedAt: territoryAssignments.assignedAt,
				resolvedAt: territoryAssignments.resolvedAt,
				status: territoryAssignments.status,
			})
			.from(territoryAssignments)
			.innerJoin(users, eq(users.id, territoryAssignments.assigneeUserId)),
		// Salidas de predicación del año ya hechas (hasta hoy): cada una es una casilla «Asignado a».
		db
			.select({ territoryId: preachingSessionTerritories.territoryId, assignmentId: preachingSessionTerritories.assignmentId, date: preachingSessions.sessionDate })
			.from(preachingSessionTerritories)
			.innerJoin(preachingSessions, eq(preachingSessions.id, preachingSessionTerritories.sessionId))
			.where(and(gte(preachingSessions.sessionDate, range.start), lte(preachingSessions.sessionDate, range.end < today ? range.end : today))),
	]);
	const ofKind = terrs.filter((t) => t.kind === kind);
	const ids = new Set(ofKind.map((t) => t.id));
	const assignments: S13Assignment[] = rows
		.filter((r) => ids.has(r.territoryId))
		.map((r) => ({
			id: r.id,
			territoryId: r.territoryId,
			assigneeName: r.assigneeName,
			assignedOn: localDate(r.assignedAt),
			resolvedOn: r.resolvedAt ? localDate(r.resolvedAt) : null,
			status: r.status,
		}));
	const years = availableServiceYears(assignments, current);
	const year = years.includes(requested) ? requested : current;
	const sessions = year === requested ? sessionRows.filter((r) => ids.has(r.territoryId)) : [];
	return {
		serviceYear: year,
		years,
		kind,
		kinds: (["general", "public_preaching"] as const).filter((k) => terrs.some((t) => t.kind === k)),
		records: buildS13(ofKind, assignments, sessions, year),
	};
}

export function parseRecordParams(params: URLSearchParams): { serviceYear: number | null; kind: TerritoryKind } {
	const sy = Number(params.get("serviceYear"));
	return {
		serviceYear: Number.isInteger(sy) && sy > 2000 ? sy : null,
		kind: params.get("kind") === "public_preaching" ? "public_preaching" : "general",
	};
}
