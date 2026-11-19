import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getSession } from "@/lib/auth/session";
import { preachingErrorResponse } from "@/lib/preaching/http";
import { canChangeDeparture, listSessionsForCalendar } from "@/lib/preaching/service";
import { nicaraguaNow } from "@/lib/panel/upcoming";
import { canAccessPreachingModule, canManageDepartures } from "@/lib/rbac/guards";
import { territoryMapKindsFor } from "@/lib/territories/mapAccess";

// Calendario de predicación de un mes (?month=AAAA-MM): lo puede ver cualquier persona con sesión. Quien administra el módulo
// ve todas las salidas (con `all=0`, solo las que le tocan, como «Solo las mías» del calendario; así lo pide el widget); los demás,
// solo las que les tocan (toda la congregación, su grupo o ellos).
export async function GET(request: Request) {
	try {
		const session = await getSession();
		if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		const params = new URL(request.url).searchParams;
		const month = params.get("month") ?? new Date().toISOString().slice(0, 7);
		if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "invalid_month" }, { status: 400 });
		const canManage = canAccessPreachingModule(session);
		const db = getDb();
		const now = nicaraguaNow();
		// `canChangeDeparture` por territorio (`canManageDepartures` o el capitán), con más de un punto y dentro del plazo.
		const [sessions, canDepart] = await Promise.all([
			listSessionsForCalendar(db, session.userId, { month, all: canManage && params.get("all") !== "0" }),
			canManageDepartures(db, session),
		]);
		const items = sessions.map((s) => ({
			...s,
			territories: s.territories.map((t) => ({ ...t, canChangeDeparture: canChangeDeparture(s, t, session.userId, canDepart, now) })),
		}));
		// `mapKinds`: de qué tipos de territorio puede abrir el mapa desde la tarjeta del día.
		return NextResponse.json({ items, canManage, mapKinds: await territoryMapKindsFor(db, session) });
	} catch (error) {
		return preachingErrorResponse(error);
	}
}
