import { getDb } from "@/db/client";
import { pioneerRoute } from "@/lib/pioneer/http";
import { progressFor } from "@/lib/pioneer/service";

/** Progreso del año de servicio (`?serviceYear=2026` = sept. 2026 a ago. 2027; por defecto el actual): horas por mes y total contra 600. */
export const GET = pioneerRoute(async ({ request, session }) => {
	const param = Number(new URL(request.url).searchParams.get("serviceYear"));
	return progressFor(getDb(), session.userId, Number.isInteger(param) && param > 2000 ? param : undefined);
});
