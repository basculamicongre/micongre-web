// Reglas puras de los pastoreos solicitados (ver visitRequests.ts).

/** A quién queda asignada una solicitud nueva (null = sin asignar, la ve el comité). Pura. */
export function initialVisitAssignees(input: {
	byGroupOverseer: boolean;
	overseerUserId: string | null;
	publisherId: string;
}): string[] | null {
	if (!input.byGroupOverseer || !input.overseerUserId || input.overseerUserId === input.publisherId) return null;
	return [input.overseerUserId];
}

/** ¿Puede esta persona reasignar la solicitud? Admin y comité siempre; el superintendente del grupo del solicitante solo
 * con la configuración encendida. Pura. */
export function canReassignVisit(input: {
	isAdmin: boolean;
	isCommittee: boolean;
	byGroupOverseer: boolean;
	overseerUserId: string | null;
	userId: string;
}): boolean {
	if (input.isAdmin || input.isCommittee) return true;
	return input.byGroupOverseer && !!input.overseerUserId && input.overseerUserId === input.userId;
}
