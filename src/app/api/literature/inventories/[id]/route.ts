import { getDb } from "@/db/client";
import { literatureRoute, parseBody } from "@/lib/literature/http";
import { deleteInventory, getInventory, updateInventory, upsertInventoryItem } from "@/lib/literature/service";
import { inventoryItemSchema, inventoryUpdateSchema } from "@/lib/validation/literature";

export const GET = literatureRoute<{ id: string }>(async ({ params }) => getInventory(getDb(), params.id));

export const PATCH = literatureRoute<{ id: string }>(async ({ request, params }) => {
	await updateInventory(getDb(), params.id, await parseBody(request, inventoryUpdateSchema));
	return { ok: true };
});

export const DELETE = literatureRoute<{ id: string }>(async ({ params }) => {
	await deleteInventory(getDb(), params.id);
	return { ok: true };
});

/** Agrega una línea (publicación + ubicación + cantidad); si ya estaba, reemplaza la cantidad. */
export const POST = literatureRoute<{ id: string }>(async ({ request, params }) => {
	const id = await upsertInventoryItem(getDb(), params.id, await parseBody(request, inventoryItemSchema));
	return Response.json({ id }, { status: 201 });
});
