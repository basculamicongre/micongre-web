import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { shepherdingVisitRequests } from "@/db/schema";
import { errorResponse } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { canReceiveVisits, sessionCanReassignVisit } from "@/lib/pastoral/visitRequests";
import { notifyUsers } from "@/lib/push/dispatch";
import { RbacError } from "@/lib/rbac/errors";
import { reassignVisitRequestSchema } from "@/lib/validation/pastoralCare";

// Reasignar un pastoreo solicitado y todavía pendiente: el superintendente del grupo de quien lo pidió (con la
// configuración «Los superintendentes de grupo manejan los pastoreos solicitados»), el comité de servicio o un admin.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getSession();
		if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		const { id } = await params;

		const parsed = reassignVisitRequestSchema.safeParse(await request.json().catch(() => null));
		if (!parsed.success) {
			return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
		}

		const db = getDb();
		const [existing] = await db
			.select({ publisherId: shepherdingVisitRequests.publisherId, status: shepherdingVisitRequests.status, assignedElders: shepherdingVisitRequests.assignedElders })
			.from(shepherdingVisitRequests)
			.where(eq(shepherdingVisitRequests.id, id))
			.limit(1);
		if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
		if (existing.status !== "pending") return NextResponse.json({ error: "not_pending" }, { status: 409 });
		if (!(await sessionCanReassignVisit(db, session, existing.publisherId))) {
			throw new RbacError("Solo el superintendente del grupo, el comité de servicio o un administrador pueden reasignar este pastoreo.");
		}

		const assignedTo = parsed.data.assignedTo;
		if (assignedTo.includes(existing.publisherId) || !(await canReceiveVisits(db, assignedTo))) {
			return NextResponse.json({ error: "invalid_assignees" }, { status: 400 });
		}

		await db.update(shepherdingVisitRequests).set({ assignedElders: JSON.stringify(assignedTo) }).where(eq(shepherdingVisitRequests.id, id));

		const previous = new Set(existing.assignedElders ? (JSON.parse(existing.assignedElders) as string[]) : []);
		const added = assignedTo.filter((userId) => !previous.has(userId) && userId !== session.userId);
		if (added.length) {
			await notifyUsers(db, added, {
				title: "Pastoreo solicitado",
				body: "Te asignaron un pastoreo solicitado. Lo verás en Mi Panel.",
				url: "/panel",
			}).catch(() => {});
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		return errorResponse(error);
	}
}
