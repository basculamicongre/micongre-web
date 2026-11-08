import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { errorResponse } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { todayLocal, upcomingEvents } from "@/lib/events/service";

/** «Próximos eventos» de Mi Panel (web y app): cualquier persona con sesión. Cada evento sale desde sus días de aviso hasta que termina. */
export async function GET() {
	try {
		const session = await getSession();
		if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		return NextResponse.json({ items: await upcomingEvents(getDb(), todayLocal()) });
	} catch (error) {
		return errorResponse(error);
	}
}
