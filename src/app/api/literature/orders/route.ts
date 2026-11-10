import { getDb } from "@/db/client";
import { literatureRoute, parseBody } from "@/lib/literature/http";
import { createOrder, listOrders } from "@/lib/literature/service";
import { orderSchema } from "@/lib/validation/literature";

// Literatura › Pedidos: lo que cada publicador pidió por su cuenta. Solo registro del siervo de literatura (no avisa a nadie).
// GET ?archived=1 para los archivados.
export const GET = literatureRoute(async ({ request }) => listOrders(getDb(), new URL(request.url).searchParams.get("archived") === "1"));

export const POST = literatureRoute(async ({ request, session }) => {
	const body = await parseBody(request, orderSchema);
	return Response.json({ id: await createOrder(getDb(), body, session.userId) }, { status: 201 });
});
