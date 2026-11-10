import { z } from "zod";
import { getDb } from "@/db/client";
import { dataRequestRoute } from "@/lib/dataRequests/http";
import { DataRequestFailure, myDataRequest, saveMyData } from "@/lib/dataRequests/service";

/** Mi Panel (web y app): `request` = null si no hay nada pedido; si hay, los tipos pedidos y los datos actuales para precargar. */
export const GET = dataRequestRoute(async ({ session }) => ({ request: await myDataRequest(getDb(), session.userId) }));

const text = z.string().max(200).nullable().optional();
const schema = z.object({
	personal: z.object({ fullName: z.string().max(200), birthDate: text, baptismDate: text, phone: text, email: text }).optional(),
	emergency: z.object({ name: z.string().max(200), phone: z.string().max(200), relation: text }).optional(),
});

/** Guarda lo llenado y cierra las solicitudes de esos tipos. */
export const POST = dataRequestRoute(async ({ session, request }) => {
	const parsed = schema.safeParse(await request.json());
	if (!parsed.success) throw new DataRequestFailure("too_long");
	await saveMyData(getDb(), session.userId, parsed.data);
	return { ok: true };
});
