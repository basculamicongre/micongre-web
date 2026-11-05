import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { shepherdingVisitRequests, users } from "@/db/schema";
import { errorResponse } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { canReassignVisit, groupOverseersByPublisher, visitRequestsByGroupOverseer } from "@/lib/pastoral/visitRequests";
import { getEligiblePublishers } from "@/lib/rbac/eligibility";
import { isServiceCommitteeMember } from "@/lib/rbac/guards";
import { PRIVILEGE_IDS } from "@/lib/rbac/roles";

// Solicitudes donde el usuario logueado es uno de los 2 ancianos asignados —
// separado de /mine (que es "lo que YO solicité"), ver comentario en
// src/lib/queries/panel.ts sobre por qué son casos distintos.
export async function GET() {
	try {
		const session = await getSession();
		if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

		const db = getDb();
		const rows = await db
			.select({
				id: shepherdingVisitRequests.id,
				publisherId: shepherdingVisitRequests.publisherId,
				publisherName: users.fullName,
				requestedDate: shepherdingVisitRequests.requestedDate,
				notes: shepherdingVisitRequests.notes,
				assignedElders: shepherdingVisitRequests.assignedElders,
				status: shepherdingVisitRequests.status,
			})
			.from(shepherdingVisitRequests)
			.innerJoin(users, eq(users.id, shepherdingVisitRequests.publisherId))
			// Una vez atendido (completado, postergado o cancelado) deja de
			// aparecer en Mi Panel del anciano — solo lo pendiente.
			.where(eq(shepherdingVisitRequests.status, "pending"))
			.orderBy(desc(shepherdingVisitRequests.requestedDate));

		const mine = rows
			.map((r) => ({ ...r, elderIds: r.assignedElders ? (JSON.parse(r.assignedElders) as string[]) : [] }))
			.filter((r) => r.elderIds.includes(session.userId));

		const otherElderIds = new Set(mine.flatMap((r) => r.elderIds.filter((id) => id !== session.userId)));
		const otherElderNames = otherElderIds.size
			? await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, [...otherElderIds]))
			: [];
		const nameById = new Map(otherElderNames.map((e) => [e.id, e.fullName]));

		// Reasignar: el superintendente del grupo de quien lo pidió (con la configuración encendida), el comité o un admin.
		// La lista de candidatos (privilegio «Realiza pastoreos») solo se carga si puede reasignar alguno.
		const [byGroupOverseer, isCommittee] = mine.length
			? await Promise.all([visitRequestsByGroupOverseer(db), session.role === "admin" ? true : isServiceCommitteeMember(db, session.userId)])
			: [false, false];
		const overseers = byGroupOverseer && mine.length ? await groupOverseersByPublisher(db) : new Map<string, string>();
		const canReassign = (publisherId: string) =>
			canReassignVisit({
				isAdmin: session.role === "admin",
				isCommittee,
				byGroupOverseer,
				overseerUserId: overseers.get(publisherId) ?? null,
				userId: session.userId,
			});
		const anyReassign = mine.some((r) => canReassign(r.publisherId));
		const visitors = anyReassign
			? (await getEligiblePublishers(db, PRIVILEGE_IDS.SHEPHERDING_VISITOR)).map((u) => ({ id: u.id, fullName: u.fullName }))
			: [];

		return NextResponse.json({
			visitors,
			items: mine.map((r) => ({
				id: r.id,
				publisherName: r.publisherName,
				requestedDate: r.requestedDate,
				notes: r.notes,
				status: r.status,
				coElderName: nameById.get(r.elderIds.find((id) => id !== session.userId) ?? "") ?? null,
				assignedIds: r.elderIds,
				canReassign: canReassign(r.publisherId),
			})),
		});
	} catch (error) {
		return errorResponse(error);
	}
}
