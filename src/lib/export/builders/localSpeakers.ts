import { asc, eq, inArray } from "drizzle-orm";
import { publicTalkOutlines, speakerOutlines, speakers, users } from "@/db/schema";
import { chunked } from "@/lib/cleaning/meetings";
import { assertCanAccessWeekendModule } from "@/lib/rbac/guards";
import type { BuilderContext } from "../registry";
import type { ReportDoc } from "../types";

export interface LocalSpeakerInput {
	fullName: string;
	phone: string | null;
	active: boolean;
	outlineNumbers: number[];
}

/** Filas del reporte de oradores locales: solo los activos (`onlyActive`) o todos, por nombre y con sus bosquejos en orden. */
export function localSpeakerRows(list: LocalSpeakerInput[], onlyActive: boolean): (string | number)[][] {
	return list
		.filter((s) => !onlyActive || s.active)
		.sort((a, b) => a.fullName.localeCompare(b.fullName, "es"))
		.map((s) => {
			const numbers = [...s.outlineNumbers].sort((a, b) => a - b);
			const row: (string | number)[] = [s.fullName, s.phone ?? "", numbers.length ? numbers.join(", ") : "—", numbers.length];
			if (!onlyActive) row.splice(2, 0, s.active ? "Activo" : "Inactivo");
			return row;
		});
}

/** Oradores locales (pestaña Oradores de fin de semana): `?status=active` (por omisión) o `?status=all`. */
export async function buildLocalSpeakers({ db, session, params }: BuilderContext): Promise<ReportDoc> {
	assertCanAccessWeekendModule(session);
	const onlyActive = params.get("status") !== "all";

	const rows = await db
		.select({ id: speakers.id, fullName: users.fullName, phone: users.phone, active: speakers.active })
		.from(speakers)
		.innerJoin(users, eq(users.id, speakers.userId))
		.where(eq(speakers.kind, "local"))
		.orderBy(asc(users.fullName));

	const numbersBySpeaker = new Map<string, number[]>();
	for (const ids of chunked(rows.map((r) => r.id), 90)) {
		const outlines = await db
			.select({ speakerId: speakerOutlines.speakerId, number: publicTalkOutlines.number })
			.from(speakerOutlines)
			.innerJoin(publicTalkOutlines, eq(publicTalkOutlines.id, speakerOutlines.outlineId))
			.where(inArray(speakerOutlines.speakerId, ids));
		for (const o of outlines) numbersBySpeaker.set(o.speakerId, [...(numbersBySpeaker.get(o.speakerId) ?? []), o.number]);
	}

	const table = localSpeakerRows(
		rows.map((r) => ({ fullName: r.fullName, phone: r.phone, active: r.active, outlineNumbers: numbersBySpeaker.get(r.id) ?? [] })),
		onlyActive,
	);
	const columns = [
		{ label: "Orador", width: 2.4 },
		{ label: "Teléfono", width: 1.4 },
		...(onlyActive ? [] : [{ label: "Estado", width: 1, align: "center" as const }]),
		{ label: "Bosquejos", width: 3.4 },
		{ label: "Total", width: 0.7, align: "center" as const },
	];

	return {
		title: "Oradores locales",
		subtitle: onlyActive ? "Solo activos" : "Activos e inactivos",
		fileName: onlyActive ? "oradores-locales-activos" : "oradores-locales",
		landscape: true,
		blocks: table.length
			? [
					{ type: "table", table: { sheetName: "Oradores locales", columns, rows: table } },
					{ type: "paragraph", text: `${table.length} ${table.length === 1 ? "orador" : "oradores"}.`, muted: true },
				]
			: [{ type: "paragraph", text: onlyActive ? "No hay oradores locales activos." : "No hay oradores locales.", muted: true }],
		footer: "Mi Congre",
	};
}
