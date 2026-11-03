import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getSession } from "@/lib/auth/session";
import { preachingErrorResponse } from "@/lib/preaching/http";
import { listSessionsForCalendar } from "@/lib/preaching/service";
import { canAccessPreachingModule } from "@/lib/rbac/guards";
import { territoryMapKindsFor } from "@/lib/territories/mapAccess";

// Calendario de predicación de un mes (?month=AAAA-MM): lo puede ver cualquier persona con sesión. Quien administra el módulo
// ve todas las salidas; los demás, solo las que les tocan (toda la congregación, su grupo o ellos).
export async function GET(request: Request) {
	try {
		const session = await getSession();
		if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
		if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "invalid_month" }, { status: 400 });
		const canManage = canAccessPreachingModule(session);
		const db = getDb();
		const items = await listSessionsForCalendar(db, session.userId, { month, all: canManage });
		// `mapKinds`: de qué tipos de territorio puede abrir el mapa desde la tarjeta del día.
		return NextResponse.json({ items, canManage, mapKinds: await territoryMapKindsFor(db, session) });
	} catch (error) {
		return preachingErrorResponse(error);
	}
}
