import { getDb } from "@/db/client";
import { literatureRoute, parseBody } from "@/lib/literature/http";
import { createInventory, listInventories } from "@/lib/literature/service";
import { inventorySchema } from "@/lib/validation/literature";

/** Cortes de inventario, del más reciente al más viejo. */
export const GET = literatureRoute(async () => ({ items: await listInventories(getDb()) }));

export const POST = literatureRoute(async ({ request, session }) => {
	const id = await createInventory(getDb(), await parseBody(request, inventorySchema), session.userId);
	return Response.json({ id }, { status: 201 });
});
