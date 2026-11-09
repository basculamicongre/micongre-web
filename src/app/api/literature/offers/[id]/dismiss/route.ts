import { getDb } from "@/db/client";
import { literatureRoute } from "@/lib/literature/http";
import { dismissOffer } from "@/lib/literature/service";

/** Quitar una solicitud de Mi Panel (web o app). Lo que se respondió se conserva. */
export const POST = literatureRoute<{ id: string }>(
	async ({ params, session }) => {
		await dismissOffer(getDb(), params.id, session.userId);
		return { ok: true };
	},
	{ open: true },
);
