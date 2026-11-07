import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { getSession } from "@/lib/auth/session";
import { preachingErrorResponse } from "@/lib/preaching/http";
import { changeDeparture } from "@/lib/preaching/service";
import { canAccessPreachingModule } from "@/lib/rbac/guards";

const bodySchema = z.object({ territoryId: z.string().min(1), fid: z.string().min(1).max(64).nullable() });

/** Cambia el punto de salida de un territorio en una salida de predicación: quien programa las salidas o el capitán del territorio,
 * antes de la salida o hasta 2 horas después (409 `departure_locked`). Si ya se avisó, reenvía el aviso. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getSession();
		if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		const { id } = await params;
		const parsed = bodySchema.safeParse(await request.json().catch(() => null));
		if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
		await changeDeparture(getDb(), id, parsed.data.territoryId, parsed.data.fid, {
			userId: session.userId,
			canManage: canAccessPreachingModule(session),
		});
		return NextResponse.json({ ok: true });
	} catch (error) {
		return preachingErrorResponse(error);
	}
}
