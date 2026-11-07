import { getDb } from "@/db/client";
import { literatureRoute, parseBody } from "@/lib/literature/http";
import { deleteInventoryItem, updateInventoryItem } from "@/lib/literature/service";
import { inventoryItemUpdateSchema } from "@/lib/validation/literature";

type P = { id: string; itemId: string };

export const PATCH = literatureRoute<P>(async ({ request, params }) => {
	const { quantity } = await parseBody(request, inventoryItemUpdateSchema);
	await updateInventoryItem(getDb(), params.id, params.itemId, quantity);
	return { ok: true };
});

export const DELETE = literatureRoute<P>(async ({ params }) => {
	await deleteInventoryItem(getDb(), params.id, params.itemId);
	return { ok: true };
});
