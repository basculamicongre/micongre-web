import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { CONGREGATION_ROW_ID, congregations, fieldServiceGroups } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { preachingErrorResponse } from "@/lib/preaching/http";
import { listAssignablePeople, listAssignableTerritories, loadDepartures } from "@/lib/preaching/service";
import { assertCanAccessPreachingModule } from "@/lib/rbac/guards";

// Lo que el formulario ofrece: territorios con asignación vigente, grupos activos y personas.
export async function GET() {
	try {
		assertCanAccessPreachingModule(await getSession());
		const db = getDb();
		const [cong] = await db.select({ time: congregations.preachingTime }).from(congregations).where(eq(congregations.id, CONGREGATION_ROW_ID)).limit(1);
		const [territories, groups, people] = await Promise.all([
			listAssignableTerritories(db),
			db
				.select({ id: fieldServiceGroups.id, name: fieldServiceGroups.name, color: fieldServiceGroups.color })
				.from(fieldServiceGroups)
				.where(eq(fieldServiceGroups.active, true))
				.orderBy(asc(fieldServiceGroups.name)),
			listAssignablePeople(db),
		]);
		// Puntos de salida de cada territorio, para elegir el de la salida.
		const departures = await loadDepartures(
			db,
			territories.map((t) => t.id),
		);
		return NextResponse.json({
			territories: territories.map((t) => ({ ...t, departures: departures.get(t.id) ?? [] })),
			groups,
			people,
			defaultTime: cong?.time ?? "09:00",
		});
	} catch (error) {
		return preachingErrorResponse(error);
	}
}
