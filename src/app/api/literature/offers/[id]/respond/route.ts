import { getDb } from "@/db/client";
import { literatureRoute, parseBody } from "@/lib/literature/http";
import { respondToOffer } from "@/lib/literature/service";
import { offerResponseSchema } from "@/lib/validation/literature";

/** Sí (con cantidad) o No a una solicitud, desde Mi Panel o la app; se puede cambiar hasta la fecha de fin. */
export const POST = literatureRoute<{ id: string }>(
	async ({ request, params, session }) => {
		const { answer, quantity } = await parseBody(request, offerResponseSchema);
		await respondToOffer(getDb(), params.id, session.userId, answer, quantity ?? 1);
		return { ok: true };
	},
	{ open: true },
);
