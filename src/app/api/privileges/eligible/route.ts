import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { errorResponse } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { getEligiblePublishers, type EligibleUser } from "@/lib/rbac/eligibility";
import { RbacError } from "@/lib/rbac/errors";
import { PRIVILEGE_CODES } from "@/lib/rbac/roles";

// Selectores "elegir hermano" en toda la app pegan aquí. Acepta varios
// privilegeId en una sola llamada (?privilegeIds=a,b,c) para que un
// constructor semanal con 7+ secciones no dispare 7+ requests — ver
// "Restricciones de free tier" en el plan. Lo usan los tres planificadores (entre semana, fin de semana y acomodadores):
// basta con tener acceso a cualquiera de ellos.
const PLANNER_ACCESS: string[] = [PRIVILEGE_CODES.MIDWEEK_ACCESS, PRIVILEGE_CODES.WEEKEND_ACCESS, PRIVILEGE_CODES.OPERATIONAL_ACCESS];
export async function GET(request: Request) {
	try {
		const session = await getSession();
		if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		if (session.role !== "admin" && !session.privilegeCodes.some((c) => PLANNER_ACCESS.includes(c))) {
			throw new RbacError("No tienes acceso a los planificadores de reuniones.");
		}

		const { searchParams } = new URL(request.url);
		const idsParam = searchParams.get("privilegeIds") ?? searchParams.get("privilegeId") ?? "";
		const privilegeIds = idsParam
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean);

		if (privilegeIds.length === 0) {
			return NextResponse.json({ error: "missing_privilege_ids" }, { status: 400 });
		}

		const db = getDb();
		const entries = await Promise.all(
			privilegeIds.map(async (id) => [id, await getEligiblePublishers(db, id)] as [string, EligibleUser[]]),
		);

		return NextResponse.json(Object.fromEntries(entries));
	} catch (error) {
		return errorResponse(error);
	}
}
