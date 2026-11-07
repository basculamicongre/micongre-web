import { getDb } from "@/db/client";
import { literatureRoute, parseBody } from "@/lib/literature/http";
import { deleteOffer, getOffer, updateOffer } from "@/lib/literature/service";
import { offerUpdateSchema } from "@/lib/validation/literature";

export const GET = literatureRoute<{ id: string }>(async ({ params }) => getOffer(getDb(), params.id));

export const PATCH = literatureRoute<{ id: string }>(async ({ request, params }) => {
	await updateOffer(getDb(), params.id, await parseBody(request, offerUpdateSchema));
	return { ok: true };
});

export const DELETE = literatureRoute<{ id: string }>(async ({ params }) => {
	await deleteOffer(getDb(), params.id);
	return { ok: true };
});
