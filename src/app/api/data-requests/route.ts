import { z } from "zod";
import { getDb } from "@/db/client";
import { dataRequestRoute } from "@/lib/dataRequests/http";
import { createRequests, DataRequestFailure, requestOptions } from "@/lib/dataRequests/service";

// Pedir a una persona, a un grupo o a toda la congregación que actualice sus datos personales o su contacto de emergencia
// (una sola cosa por solicitud).
// Admin: los 3 niveles. Con «Solicitar actualización de datos» (superintendente y auxiliar de grupo): personas o todo su grupo.

/** Grupos y personas a su alcance, con lo que ya tienen pendiente. */
export const GET = dataRequestRoute(async ({ session }) => requestOptions(getDb(), session));

const schema = z.object({
	kind: z.enum(["personal", "emergency"]),
	scope: z.enum(["user", "group", "congregation"]),
	userIds: z.array(z.string().min(1)).max(500).optional(),
	groupId: z.string().min(1).optional(),
});

export const POST = dataRequestRoute(async ({ session, request }) => {
	const parsed = schema.safeParse(await request.json());
	if (!parsed.success) throw new DataRequestFailure("invalid_scope");
	return createRequests(getDb(), session, parsed.data);
});
