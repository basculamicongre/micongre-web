import { asc, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { territories } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { assertCanAccessTerritoriesModule } from "@/lib/rbac/guards";
import { parseMapData } from "@/lib/territories/geo";
import { territoryErrorResponse } from "@/lib/territories/http";

// Los dibujos de todos los territorios con mapa, para verlos juntos («Ver todo» del módulo).
export async function GET() {
	try {
		assertCanAccessTerritoriesModule(await getSession());
		const rows = await getDb()
			.select({ id: territories.id, number: territories.number, name: territories.name, kind: territories.kind, mapData: territories.mapData })
			.from(territories)
			.where(isNotNull(territories.mapData))
			.orderBy(asc(territories.number));
		const items = rows
			.map((r) => ({ ...r, mapData: parseMapData(r.mapData) }))
			.filter((r) => r.mapData && r.mapData.features.length > 0)
			.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
		return NextResponse.json({ items });
	} catch (error) {
		return territoryErrorResponse(error);
	}
}
