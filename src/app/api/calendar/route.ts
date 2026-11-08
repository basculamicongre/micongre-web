import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getSession } from "@/lib/auth/session";
import { calendarItems } from "@/lib/calendar/service";
import { nicaraguaNow } from "@/lib/panel/upcoming";
import { preachingErrorResponse } from "@/lib/preaching/http";
import { canChangeDeparture, listSessionsForCalendar } from "@/lib/preaching/service";
import { canAccessPreachingModule } from "@/lib/rbac/guards";
import { territoryMapKindsFor } from "@/lib/territories/mapAccess";

// Módulo «Calendario» (web y app; ?month=AAAA-MM): cualquier persona con sesión. `preaching` es lo mismo que el calendario de predicación
// (quien administra el módulo ve todas las salidas; los demás, las que les tocan) y `items`, todo lo demás con fecha: eventos de la
// congregación, reuniones y las asignaciones de la persona (partes, acomodadores, limpieza, discursos fuera, pastoreos).
export async function GET(request: Request) {
	try {
		const session = await getSession();
		if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
		if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "invalid_month" }, { status: 400 });
		const canManage = canAccessPreachingModule(session);
		const db = getDb();
		const now = nicaraguaNow();
		const [sessions, items, mapKinds] = await Promise.all([
			listSessionsForCalendar(db, session.userId, { month, all: canManage }),
			calendarItems(db, session.userId, month),
			territoryMapKindsFor(db, session),
		]);
		const preaching = sessions.map((s) => ({
			...s,
			territories: s.territories.map((t) => ({ ...t, canChangeDeparture: canChangeDeparture(s, t, session.userId, canManage, now) })),
		}));
		return NextResponse.json({ month, items, preaching, canManage, mapKinds });
	} catch (error) {
		return preachingErrorResponse(error);
	}
}
