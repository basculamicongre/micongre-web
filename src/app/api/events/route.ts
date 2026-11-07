import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { coVisitSchedules } from "@/db/schema";
import { errorResponse } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { EventFailure, createEvent, listEvents } from "@/lib/events/service";
import { assertCanAccessCongregationModule } from "@/lib/rbac/guards";
import { createEventSchema } from "@/lib/validation/events";

/** Eventos de la congregación (módulo «Eventos», mismo acceso que Congregación). */
export async function GET() {
	try {
		const session = await getSession();
		assertCanAccessCongregationModule(session);
		const db = getDb();
		const [items, visits] = await Promise.all([listEvents(db), db.select({ id: coVisitSchedules.id, name: coVisitSchedules.circuitOverseerName }).from(coVisitSchedules)]);
		const visitName = new Map(visits.map((v) => [v.id, v.name]));
		return NextResponse.json({
			items: items.map((e) => ({ ...e, coVisitName: e.coVisitId ? (visitName.get(e.coVisitId) ?? null) : null })),
		});
	} catch (error) {
		return errorResponse(error);
	}
}

export async function POST(request: Request) {
	try {
		const session = await getSession();
		assertCanAccessCongregationModule(session);
		const parsed = createEventSchema.safeParse(await request.json().catch(() => null));
		if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
		const row = await createEvent(getDb(), parsed.data, session.userId);
		return NextResponse.json({ id: row.id }, { status: 201 });
	} catch (error) {
		if (error instanceof EventFailure) return NextResponse.json({ error: error.code }, { status: error.status });
		return errorResponse(error);
	}
}
