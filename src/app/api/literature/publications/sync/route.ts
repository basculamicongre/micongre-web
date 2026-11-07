import { getDb } from "@/db/client";
import { syncJwCatalog } from "@/lib/literature/jwCatalog";
import { literatureRoute } from "@/lib/literature/http";

/** «Actualizar desde JW.ORG»: agrega las publicaciones nuevas (lo mismo que hace el job diario). */
export const POST = literatureRoute(async () => syncJwCatalog(getDb()));
