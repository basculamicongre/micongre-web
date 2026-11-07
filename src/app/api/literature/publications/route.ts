import { getDb } from "@/db/client";
import { literatureRoute, parseBody } from "@/lib/literature/http";
import { createPublication, listPublications } from "@/lib/literature/service";
import { publicationSchema } from "@/lib/validation/literature";

/** Catálogo de publicaciones (todo: la pantalla busca por código o título). */
export const GET = literatureRoute(async () => ({ items: await listPublications(getDb()) }));

/** Agregar una publicación a mano (algo que no está en JW.ORG). */
export const POST = literatureRoute(async ({ request }) => {
	const id = await createPublication(getDb(), await parseBody(request, publicationSchema));
	return Response.json({ id }, { status: 201 });
});
