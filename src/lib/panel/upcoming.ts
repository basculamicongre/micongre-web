// «Mis asignaciones» de Mi Panel (próximas): solo lo que sigue, para no abrumar.
// - Reuniones: todo lo de la siguiente reunión de entre semana y de la siguiente de fin de semana (partes y acomodadores).
// - Discursos que da la persona en otra congregación: todos los de esta semana (o, si no hay, el siguiente).
// - «Salen este fin de semana» (quien administra los arreglos de discursos): todos los de esta semana.
// - Territorios a su cargo: todos los pendientes (cada uno tiene sus acciones). La salida de predicación que es solo sobre
//   sus territorios no se repite: su fecha y hora se agregan al territorio.
// - Todo lo demás (limpieza, predicación con la congregación o el grupo, predicación pública, pastoreo): solo el siguiente.
import type { PanelAssignment } from "@/lib/queries/panel";

export interface UpcomingWindow {
	/** Hoy (AAAA-MM-DD). */
	today: string;
	/** Lunes y domingo de la semana en curso. */
	weekStart: string;
	weekEnd: string;
}

const inWeek = (a: PanelAssignment, w: UpcomingWindow) => a.date >= w.weekStart && a.date <= w.weekEnd;

/** Recibe las próximas (ya filtradas por fecha) y deja solo lo que sigue de cada tipo, en orden de fecha. */
export function selectUpcoming(items: PanelAssignment[], w: UpcomingWindow): PanelAssignment[] {
	const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
	const out: PanelAssignment[] = [];

	// Territorios pendientes: todos. Las salidas cuyos territorios son todos suyos se funden en el territorio.
	const territories = sorted.filter((a) => a.meetingType === "territory").map((a) => ({ ...a }));
	const mine = new Map(territories.filter((t) => t.territory).map((t) => [t.territory!.territoryId, t]));
	const isCaptainSession = (a: PanelAssignment) =>
		a.meetingType === "preaching" && !!a.territoryIds?.length && a.territoryIds.every((id) => mine.has(id));
	for (const session of sorted.filter(isCaptainSession)) {
		for (const id of session.territoryIds!) {
			const t = mine.get(id)!;
			if (!t.nextSession) t.nextSession = session.when ?? session.date;
		}
	}
	for (const t of territories) {
		out.push(t.nextSession ? { ...t, label: `${t.label} · Salida: ${t.nextSession}` } : t);
	}

	const rest = sorted.filter((a) => a.meetingType !== "territory" && !isCaptainSession(a));
	const byBucket = new Map<string, PanelAssignment[]>();
	for (const a of rest) {
		const key = a.bucket ?? a.meetingType;
		byBucket.set(key, [...(byBucket.get(key) ?? []), a]);
	}

	for (const [bucket, list] of byBucket) {
		if (bucket.startsWith("meeting:")) {
			// Todo lo de la siguiente reunión de ese tipo.
			out.push(...list.filter((a) => a.date === list[0].date));
		} else if (bucket === "outgoing_talk") {
			const thisWeek = list.filter((a) => inWeek(a, w));
			out.push(...(thisWeek.length ? thisWeek : list.slice(0, 1)));
		} else if (bucket === "talks_out") {
			out.push(...list.filter((a) => inWeek(a, w)));
		} else {
			out.push(list[0]);
		}
	}

	return out
		.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
		.map(({ bucket: _b, territoryIds: _t, when: _w, time: _time, nextSession: _n, ...rest }) => rest);
}
