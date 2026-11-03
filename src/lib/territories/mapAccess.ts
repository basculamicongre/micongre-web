import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { congregations } from "@/db/schema";
import { CONGREGATION_ROW_ID } from "@/db/schema/congregation";
import type { Session } from "@/lib/auth/session";
import { territoryMapKinds } from "@/lib/rbac/guards";

/** De qué tipos de territorio puede ver el mapa desde el calendario de predicación (siempre solo lectura): todos, si
 * Congregación → «Mostrar los mapas a todos los publicadores» está activo; si no, según su privilegio (territoryMapKinds). */
export async function territoryMapKindsFor(db: Database, session: Session | null): Promise<("general" | "public_preaching")[]> {
	if (!session) return [];
	const [row] = await db
		.select({ all: congregations.mapsVisibleToAll })
		.from(congregations)
		.where(eq(congregations.id, CONGREGATION_ROW_ID))
		.limit(1);
	return row?.all ? ["general", "public_preaching"] : territoryMapKinds(session);
}
