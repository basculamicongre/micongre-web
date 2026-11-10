import { getDb } from "@/db/client";
import { literatureRoute, parseBody } from "@/lib/literature/http";
import { deletePublication, updatePublication } from "@/lib/literature/service";
import { publicationUpdateSchema } from "@/lib/validation/literature";

/** Nombre y tipo de cualquier publicación; el código, solo de las agregadas a mano. */
export const PATCH = literatureRoute<{ id: string }>(async ({ request, params }) => {
	await updatePublication(getDb(), params.id, await parseBody(request, publicationUpdateSchema));
	return { ok: true };
});

/** Solo las agregadas a mano y sin usar. */
export const DELETE = literatureRoute<{ id: string }>(async ({ params }) => {
	await deletePublication(getDb(), params.id);
	return { ok: true };
});
