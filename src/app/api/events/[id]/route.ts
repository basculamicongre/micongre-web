import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { errorResponse } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { EventFailure, deleteEvent, updateEvent } from "@/lib/events/service";
import { assertCanAccessCongregationModule } from "@/lib/rbac/guards";
import { updateEventSchema } from "@/lib/validation/events";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
	try {
		const session = await getSession();
		assertCanAccessCongregationModule(session);
		const { id } = await params;
		const parsed = updateEventSchema.safeParse(await request.json().catch(() => null));
		if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
		await updateEvent(getDb(), id, parsed.data, session.userId);
		return NextResponse.json({ ok: true });
	} catch (error) {
		if (error instanceof EventFailure) return NextResponse.json({ error: error.code }, { status: error.status });
		return errorResponse(error);
	}
}

/** Borra el evento: sus reuniones canceladas vuelven a «programada» (las asignaciones que se quitaron no vuelven) y se retira el aviso. */
export async function DELETE(_request: Request, { params }: Params) {
	try {
		const session = await getSession();
		assertCanAccessCongregationModule(session);
		const { id } = await params;
		await deleteEvent(getDb(), id);
		return NextResponse.json({ ok: true });
	} catch (error) {
		if (error instanceof EventFailure) return NextResponse.json({ error: error.code }, { status: error.status });
		return errorResponse(error);
	}
}
