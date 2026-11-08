import { getDb } from "@/db/client";
import { parseBody, pioneerRoute } from "@/lib/pioneer/http";
import { sumHours } from "@/lib/pioneer/rules";
import { createHours, listHours } from "@/lib/pioneer/service";
import { hoursSchema } from "@/lib/validation/pioneer";

/** Horas anotadas del mes (`?year=&month=`, por defecto el actual) y su total. */
export const GET = pioneerRoute(async ({ request, session }) => {
	const params = new URL(request.url).searchParams;
	const now = new Date();
	const year = Number(params.get("year")) || now.getFullYear();
	const month = Number(params.get("month")) || now.getMonth() + 1;
	const items = await listHours(getDb(), session.userId, year, month);
	return { year, month, items, total: sumHours(items) };
});

export const POST = pioneerRoute(async ({ request, session }) => {
	const id = await createHours(getDb(), session.userId, await parseBody(request, hoursSchema));
	return Response.json({ id }, { status: 201 });
});
