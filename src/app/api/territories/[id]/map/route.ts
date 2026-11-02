import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { territories } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { RbacError } from "@/lib/rbac/errors";
import { canAccessTerritoriesModule, territoryMapKinds } from "@/lib/rbac/guards";
import { parseMapData } from "@/lib/territories/geo";
import { territoryErrorResponse } from "@/lib/territories/http";
import { isCurrentAssignee, TerritoryFailure } from "@/lib/territories/service";

// Solo el dibujo del mapa: lo ve quien administra territorios, el encargado vigente de ese territorio (desde Mi Panel) y quien
// puede recibir territorios de ese tipo (desde el calendario de predicación).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getSession();
		if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		const { id } = await params;

		const db = getDb();
		const [territory] = await db.select().from(territories).where(eq(territories.id, id)).limit(1);
		if (
			!canAccessTerritoriesModule(session) &&
			!(territory && territoryMapKinds(session).includes(territory.kind)) &&
			!(await isCurrentAssignee(db, id, session.userId))
		) {
			throw new RbacError("No tienes acceso a este territorio.");
		}
		if (!territory) throw new TerritoryFailure("territory_not_found");
		return NextResponse.json({
			number: territory.number,
			kind: territory.kind,
			name: territory.name,
			notes: territory.notes,
			mapData: parseMapData(territory.mapData),
		});
	} catch (error) {
		return territoryErrorResponse(error);
	}
}
