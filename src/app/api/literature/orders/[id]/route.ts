import { getDb } from "@/db/client";
import { literatureRoute, parseBody } from "@/lib/literature/http";
import { deleteOrder, updateOrder } from "@/lib/literature/service";
import { orderUpdateSchema } from "@/lib/validation/literature";

/** Cambiar un pedido o archivarlo (`archived: true`) / sacarlo del archivo. */
export const PATCH = literatureRoute<{ id: string }>(async ({ request, params }) => {
	await updateOrder(getDb(), params.id, await parseBody(request, orderUpdateSchema));
	return { ok: true };
});

export const DELETE = literatureRoute<{ id: string }>(async ({ params }) => {
	await deleteOrder(getDb(), params.id);
	return { ok: true };
});
