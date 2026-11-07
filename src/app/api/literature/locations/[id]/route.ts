import { getDb } from "@/db/client";
import { literatureRoute, parseBody } from "@/lib/literature/http";
import { deleteLocation, renameLocation } from "@/lib/literature/service";
import { locationSchema } from "@/lib/validation/literature";

export const PATCH = literatureRoute<{ id: string }>(async ({ request, params }) => {
	const { name } = await parseBody(request, locationSchema);
	await renameLocation(getDb(), params.id, name);
	return { ok: true };
});

export const DELETE = literatureRoute<{ id: string }>(async ({ params }) => {
	await deleteLocation(getDb(), params.id);
	return { ok: true };
});
