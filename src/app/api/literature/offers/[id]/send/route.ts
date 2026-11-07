import { getDb } from "@/db/client";
import { literatureRoute } from "@/lib/literature/http";
import { sendOffer } from "@/lib/literature/service";

/** Envía la solicitud: aparece en Mi Panel de los destinatarios y les llega el push (al reenviar, solo a quienes no han respondido). */
export const POST = literatureRoute<{ id: string }>(async ({ params }) => sendOffer(getDb(), params.id));
