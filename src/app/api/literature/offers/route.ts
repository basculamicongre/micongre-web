import { getDb } from "@/db/client";
import { literatureRoute, parseBody } from "@/lib/literature/http";
import { createOffer, listOffers } from "@/lib/literature/service";
import { offerSchema } from "@/lib/validation/literature";

/** Solicitudes con su lista (sí, no, sin responder). */
export const GET = literatureRoute(async () => ({ items: await listOffers(getDb()) }));

/** Crear no avisa: se envía con «Enviar» (POST /offers/[id]/send). */
export const POST = literatureRoute(async ({ request, session }) => {
	const id = await createOffer(getDb(), await parseBody(request, offerSchema), session.userId);
	return Response.json({ id }, { status: 201 });
});
