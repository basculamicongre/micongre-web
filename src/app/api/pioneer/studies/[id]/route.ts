import { getDb } from "@/db/client";
import { parseBody, pioneerRoute } from "@/lib/pioneer/http";
import { deleteStudy, updateStudy } from "@/lib/pioneer/service";
import { studyUpdateSchema } from "@/lib/validation/pioneer";

export const PATCH = pioneerRoute<{ id: string }>(async ({ request, session, params }) => {
	await updateStudy(getDb(), session.userId, params.id, await parseBody(request, studyUpdateSchema));
	return { ok: true };
});

export const DELETE = pioneerRoute<{ id: string }>(async ({ session, params }) => {
	await deleteStudy(getDb(), session.userId, params.id);
	return { ok: true };
});
