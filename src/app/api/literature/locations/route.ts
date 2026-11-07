import { getDb } from "@/db/client";
import { literatureRoute, parseBody } from "@/lib/literature/http";
import { createLocation, listLocations } from "@/lib/literature/service";
import { locationSchema } from "@/lib/validation/literature";

export const GET = literatureRoute(async () => ({ items: await listLocations(getDb()) }));

export const POST = literatureRoute(async ({ request }) => {
	const { name } = await parseBody(request, locationSchema);
	return Response.json({ id: await createLocation(getDb(), name) }, { status: 201 });
});
