import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { shepherdingVisitRequests, users } from "@/db/schema";
import { errorResponse } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { getEligiblePublishers } from "@/lib/rbac/eligibility";
import { assertIsServiceCommittee } from "@/lib/rbac/guards";
import { PRIVILEGE_IDS } from "@/lib/rbac/roles";

export async function GET() {
	try {
		const session = await getSession();
		if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		const db = getDb();
		await assertIsServiceCommittee(db, session);
		const [requestRows, visitorRows] = await Promise.all([
			db
				.select({
					id: shepherdingVisitRequests.id,
					publisherId: shepherdingVisitRequests.publisherId,
					publisherName: users.fullName,
					requestedDate: shepherdingVisitRequests.requestedDate,
					notes: shepherdingVisitRequests.notes,
					assignedElders: shepherdingVisitRequests.assignedElders,
					status: shepherdingVisitRequests.status,
					createdAt: shepherdingVisitRequests.createdAt,
				})
				.from(shepherdingVisitRequests)
				.innerJoin(users, eq(users.id, shepherdingVisitRequests.publisherId))
				.orderBy(desc(shepherdingVisitRequests.requestedDate)),
			// Quienes pueden recibir un pastoreo: el privilegio «Realiza pastoreos» (todo anciano lo tiene solo; a otros se les otorga a mano).
			getEligiblePublishers(db, PRIVILEGE_IDS.SHEPHERDING_VISITOR),
		]);

		// Resuelve por nombre (no solo la lista de arriba: alguien asignado hace tiempo pudo perder el privilegio después).
		const assignedIds = new Set(
			requestRows.flatMap((r) => (r.assignedElders ? (JSON.parse(r.assignedElders) as string[]) : [])),
		);
		const assignedNameRows = assignedIds.size
			? await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, [...assignedIds]))
			: [];
		const nameById = new Map(assignedNameRows.map((u) => [u.id, u.fullName]));

		return NextResponse.json({
			items: requestRows.map((r) => ({
				...r,
				assignedElders: r.assignedElders
					? (JSON.parse(r.assignedElders) as string[]).map((id) => nameById.get(id) ?? "—")
					: null,
			})),
			elders: visitorRows.map((u) => ({ id: u.id, fullName: u.fullName })),
		});
	} catch (error) {
		return errorResponse(error);
	}
}
