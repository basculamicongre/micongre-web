import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { errorResponse } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { assertCanAccessTerritoriesModule } from "@/lib/rbac/guards";
import { loadTerritoryRecord, parseRecordParams } from "@/lib/territories/record";

/** Registro de asignación de territorio (S-13) de un año de servicio: ?serviceYear=2025 (sept. 2025 a ago. 2026)&kind=general. */
export async function GET(request: Request) {
	try {
		const session = await getSession();
		assertCanAccessTerritoriesModule(session);
		const { serviceYear, kind } = parseRecordParams(new URL(request.url).searchParams);
		return NextResponse.json(await loadTerritoryRecord(getDb(), serviceYear, kind));
	} catch (error) {
		return errorResponse(error);
	}
}
