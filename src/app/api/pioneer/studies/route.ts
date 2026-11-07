import { getDb } from "@/db/client";
import { parseBody, pioneerRoute } from "@/lib/pioneer/http";
import { createStudy, listStudies, mapCenter } from "@/lib/pioneer/service";
import { studySchema } from "@/lib/validation/pioneer";

/** Estudios y revisitas del propio precursor, y dónde abrir el mapa si uno no tiene punto (el Salón del Reino). */
export const GET = pioneerRoute(async ({ session }) => {
	const db = getDb();
	const [items, center] = await Promise.all([listStudies(db, session.userId), mapCenter(db)]);
	return { items, center };
});

export const POST = pioneerRoute(async ({ request, session }) => {
	const id = await createStudy(getDb(), session.userId, await parseBody(request, studySchema));
	return Response.json({ id }, { status: 201 });
});
