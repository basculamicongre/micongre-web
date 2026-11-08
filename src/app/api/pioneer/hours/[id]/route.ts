import { getDb } from "@/db/client";
import { parseBody, pioneerRoute } from "@/lib/pioneer/http";
import { deleteHours, updateHours } from "@/lib/pioneer/service";
import { hoursUpdateSchema } from "@/lib/validation/pioneer";

export const PATCH = pioneerRoute<{ id: string }>(async ({ request, session, params }) => {
	await updateHours(getDb(), session.userId, params.id, await parseBody(request, hoursUpdateSchema));
	return { ok: true };
});

export const DELETE = pioneerRoute<{ id: string }>(async ({ session, params }) => {
	await deleteHours(getDb(), session.userId, params.id);
	return { ok: true };
});
