import { getDb } from "@/db/client";
import { literatureRoute } from "@/lib/literature/http";
import { myOpenOffers } from "@/lib/literature/service";

/** Mi Panel: las solicitudes de literatura abiertas para quien consulta. */
export const GET = literatureRoute(async ({ session }) => ({ items: await myOpenOffers(getDb(), session.userId) }), { open: true });
