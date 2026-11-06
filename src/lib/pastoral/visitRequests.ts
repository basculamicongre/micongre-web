import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { CONGREGATION_ROW_ID, congregations, fieldServiceGroups, users } from "@/db/schema";
import type { Session } from "@/lib/auth/session";
import { getEligiblePublishers } from "@/lib/rbac/eligibility";
import { isServiceCommitteeMember } from "@/lib/rbac/guards";
import { PRIVILEGE_IDS } from "@/lib/rbac/roles";
import { canReassignVisit } from "./visitRequestRules";

export { canReassignVisit, initialVisitAssignees } from "./visitRequestRules";

// Pastoreos solicitados desde Mi Panel. Con Congregación → Configuración → «Los superintendentes de grupo manejan los
// pastoreos solicitados» encendido, la solicitud nace asignada al superintendente del grupo de quien la pide y él (o el
// comité, o un admin) puede reasignarla a una o dos personas con el privilegio «Realiza pastoreos». Apagado: la asigna
// el comité de servicio, como siempre.

export async function visitRequestsByGroupOverseer(db: Database): Promise<boolean> {
	const [row] = await db
		.select({ on: congregations.visitRequestsByGroupOverseer })
		.from(congregations)
		.where(eq(congregations.id, CONGREGATION_ROW_ID))
		.limit(1);
	return !!row?.on;
}

/** Superintendente del grupo de servicio de un publicador (null si no tiene grupo o el grupo no tiene superintendente). */
export async function groupOverseerOf(db: Database, publisherId: string): Promise<string | null> {
	const [row] = await db
		.select({ overseerUserId: fieldServiceGroups.overseerUserId })
		.from(users)
		.innerJoin(fieldServiceGroups, eq(fieldServiceGroups.id, users.fieldServiceGroupId))
		.where(eq(users.id, publisherId))
		.limit(1);
	return row?.overseerUserId ?? null;
}

/** Superintendente por publicador para varias solicitudes a la vez (una sola consulta). */
export async function groupOverseersByPublisher(db: Database): Promise<Map<string, string>> {
	const rows = await db
		.select({ userId: users.id, overseerUserId: fieldServiceGroups.overseerUserId })
		.from(users)
		.innerJoin(fieldServiceGroups, eq(fieldServiceGroups.id, users.fieldServiceGroupId));
	return new Map(rows.filter((r) => r.overseerUserId).map((r) => [r.userId, r.overseerUserId as string]));
}

export async function sessionCanReassignVisit(db: Database, session: Session, publisherId: string): Promise<boolean> {
	if (session.role === "admin") return true;
	const [byGroupOverseer, isCommittee] = await Promise.all([visitRequestsByGroupOverseer(db), isServiceCommitteeMember(db, session.userId)]);
	return canReassignVisit({
		isAdmin: false,
		isCommittee,
		byGroupOverseer,
		overseerUserId: byGroupOverseer ? await groupOverseerOf(db, publisherId) : null,
		userId: session.userId,
	});
}

/** ¿Todas estas personas pueden recibir un pastoreo (privilegio «Realiza pastoreos»)? Revalidación del servidor. */
export async function canReceiveVisits(db: Database, userIds: string[]): Promise<boolean> {
	if (new Set(userIds).size !== userIds.length) return false;
	const eligible = new Set((await getEligiblePublishers(db, PRIVILEGE_IDS.SHEPHERDING_VISITOR)).map((u) => u.id));
	return userIds.every((id) => eligible.has(id));
}
