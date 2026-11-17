import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { publicTalkOutlines, songs, speakerOutlines, speakers, theocraticAppointments, users } from "@/db/schema";
import { chunked } from "@/lib/cleaning/meetings";
import { nicaraguaToday } from "@/lib/preaching/recurring";
import { assertCanAccessWeekendModule } from "@/lib/rbac/guards";
import type { BuilderContext } from "../registry";
import type { ReportBlock, ReportDoc } from "../types";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export type SpeakerRank = "elder" | "ministerial_servant" | "other";

export interface LocalSpeakerInput {
	fullName: string;
	phone: string | null;
	email: string | null;
	active: boolean;
	rank: SpeakerRank;
	outlines: { number: number; title: string; song: string }[];
}

const RANK_ORDER: SpeakerRank[] = ["elder", "ministerial_servant", "other"];
export const RANK_LABEL: Record<SpeakerRank, string> = { elder: "Ancianos", ministerial_servant: "Siervos ministeriales", other: "Otros oradores" };

/** Ancianos primero, luego siervos ministeriales (y al final cualquier otro); en cada grupo por nombre y los bosquejos por número.
 * `onlyActive` deja fuera a los marcados como inactivos. Los grupos vacíos no se devuelven. */
export function groupLocalSpeakers(list: LocalSpeakerInput[], onlyActive: boolean): { rank: SpeakerRank; speakers: LocalSpeakerInput[] }[] {
	return RANK_ORDER.map((rank) => ({
		rank,
		speakers: list
			.filter((s) => s.rank === rank && (!onlyActive || s.active))
			.sort((a, b) => a.fullName.localeCompare(b.fullName, "es"))
			.map((s) => ({ ...s, outlines: [...s.outlines].sort((a, b) => a.number - b.number) })),
	})).filter((g) => g.speakers.length > 0);
}

/** Datos del orador en una línea («Tel. 8888-1234 · correo@ejemplo.com»); lo que falta no se pone. Con `withStatus`, también
 * «Inactivo» si lo está. Vacío si no hay nada que mostrar. */
export function speakerDetails(s: Pick<LocalSpeakerInput, "phone" | "email" | "active">, withStatus: boolean): string {
	const parts: string[] = [];
	if (withStatus && !s.active) parts.push("Inactivo");
	if (s.phone?.trim()) parts.push(`Tel. ${s.phone.trim()}`);
	if (s.email?.trim()) parts.push(s.email.trim());
	return parts.join(" · ");
}

/** «Oradores públicos aprobados para Noviembre 2026» (`month` = AAAA-MM). */
export function localSpeakersTitle(month: string): string {
	const [y, m] = month.split("-").map(Number);
	return `Oradores públicos aprobados para ${MONTHS[m - 1]} ${y}`;
}

/** Oradores locales (pestaña Oradores de fin de semana): `?status=active` (por omisión) o `?status=all`; `?month=AAAA-MM` (por omisión, el actual). */
export async function buildLocalSpeakers({ db, session, params }: BuilderContext): Promise<ReportDoc> {
	assertCanAccessWeekendModule(session);
	const onlyActive = params.get("status") !== "all";
	const monthParam = params.get("month");
	const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : nicaraguaToday().slice(0, 7);

	const rows = await db
		.select({ id: speakers.id, userId: users.id, fullName: users.fullName, phone: users.phone, email: users.email, active: speakers.active })
		.from(speakers)
		.innerJoin(users, eq(users.id, speakers.userId))
		.where(eq(speakers.kind, "local"))
		.orderBy(asc(users.fullName));

	const outlinesBySpeaker = new Map<string, LocalSpeakerInput["outlines"]>();
	const rankByUser = new Map<string, SpeakerRank>();
	for (const ids of chunked(rows.map((r) => r.id), 90)) {
		const list = await db
			.select({ speakerId: speakerOutlines.speakerId, number: publicTalkOutlines.number, title: publicTalkOutlines.title, songNumber: speakerOutlines.songNumber, songTitle: songs.title })
			.from(speakerOutlines)
			.innerJoin(publicTalkOutlines, eq(publicTalkOutlines.id, speakerOutlines.outlineId))
			.leftJoin(songs, eq(songs.number, speakerOutlines.songNumber))
			.where(inArray(speakerOutlines.speakerId, ids));
		for (const o of list) {
			const song = o.songNumber ? (o.songTitle ? `${o.songNumber}: ${o.songTitle}` : String(o.songNumber)) : "";
			outlinesBySpeaker.set(o.speakerId, [...(outlinesBySpeaker.get(o.speakerId) ?? []), { number: o.number, title: o.title, song }]);
		}
	}
	for (const ids of chunked(rows.map((r) => r.userId), 90)) {
		const list = await db
			.select({ userId: theocraticAppointments.userId, type: theocraticAppointments.appointmentType })
			.from(theocraticAppointments)
			.where(and(inArray(theocraticAppointments.userId, ids), isNull(theocraticAppointments.endDate), inArray(theocraticAppointments.appointmentType, ["elder", "ministerial_servant"])));
		for (const a of list) if (rankByUser.get(a.userId) !== "elder") rankByUser.set(a.userId, a.type as SpeakerRank);
	}

	const groups = groupLocalSpeakers(
		rows.map((r) => ({
			fullName: r.fullName,
			phone: r.phone,
			email: r.email,
			active: r.active,
			rank: rankByUser.get(r.userId) ?? "other",
			outlines: outlinesBySpeaker.get(r.id) ?? [],
		})),
		onlyActive,
	);

	const blocks: ReportBlock[] = [];
	for (const group of groups) {
		blocks.push({ type: "heading", text: RANK_LABEL[group.rank], level: 2 });
		for (const s of group.speakers) {
			blocks.push({ type: "heading", text: s.fullName, level: 3 });
			// Una sola línea discreta debajo del nombre, solo con los datos que hay (el grupo ya dice si es anciano o siervo).
			const details = speakerDetails(s, !onlyActive);
			if (details) blocks.push({ type: "paragraph", text: details, muted: true });
			blocks.push(
				s.outlines.length
					? {
							type: "table",
							table: {
								sheetName: s.fullName,
								columns: [
									{ label: "Número", width: 0.8, align: "center" },
									{ label: "Título", width: 4 },
									{ label: "Canción", width: 2.6 },
								],
								rows: s.outlines.map((o) => [o.number, o.title, o.song]),
							},
						}
					: { type: "paragraph", text: "Sin bosquejos registrados.", muted: true },
			);
		}
	}

	return {
		// El nombre de la congregación lo pone /api/export como subtítulo (segunda línea).
		title: localSpeakersTitle(month),
		fileName: `oradores-publicos-${month}${onlyActive ? "" : "-todos"}`,
		blocks: blocks.length ? blocks : [{ type: "paragraph", text: onlyActive ? "No hay oradores locales activos." : "No hay oradores locales.", muted: true }],
		footer: "Mi Congre",
	};
}
