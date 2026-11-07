import { getDb } from "@/db/client";
import { literatureRoute } from "@/lib/literature/http";
import { deletePublication } from "@/lib/literature/service";

/** Solo las agregadas a mano y sin usar. */
export const DELETE = literatureRoute<{ id: string }>(async ({ params }) => {
	await deletePublication(getDb(), params.id);
	return { ok: true };
});
