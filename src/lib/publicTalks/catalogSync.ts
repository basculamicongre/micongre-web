// Catálogo central de bosquejos (S-99a) en micongre-router: cada instalación lo lee en el job diario con su clave de relay
// (`PUSH_RELAY_URL`/`PUSH_RELAY_KEY`) y lo aplica; la instalación con `CATALOG_PUBLISH_KEY` lo publica al importar.
import { z } from "zod";
import type { Database } from "@/db/client";
import { getEnv } from "@/lib/env";
import { applyOutlineImport, type OutlineImportResult } from "./importOutlines";
import type { ParsedTalkOutline } from "./parseS99a";

const CATALOG_PATH = "/__router/catalog/outlines";

export const outlineListSchema = z
	.array(
		z.object({
			number: z.number().int().positive().max(999),
			category: z.string().trim().min(1).max(200),
			title: z.string().trim().max(300),
			retired: z.boolean(),
		}),
	)
	.min(1)
	.max(500);

type Env = { PUSH_RELAY_URL?: string; PUSH_RELAY_KEY?: string; CATALOG_PUBLISH_KEY?: string };

/** Dirección del catálogo en el mismo router que el relay de push; null si esta instalación no tiene relay. */
export function catalogUrl(env: Env): string | null {
	if (!env.PUSH_RELAY_URL?.startsWith("https://") || !env.PUSH_RELAY_KEY) return null;
	return new URL(CATALOG_PATH, env.PUSH_RELAY_URL).toString();
}

export function canPublishCatalog(env: Env = getEnv()): boolean {
	return !!catalogUrl(env) && !!env.CATALOG_PUBLISH_KEY;
}

export type OutlineCatalogResult = (OutlineImportResult & { updatedAt: string }) | { skipped: "no_relay" | "empty" };

/** Job diario: trae el catálogo central y lo aplica (solo cambia lo distinto). */
export async function syncOutlineCatalog(db: Database, env: Env = getEnv()): Promise<OutlineCatalogResult> {
	const url = catalogUrl(env);
	if (!url) return { skipped: "no_relay" };
	const response = await fetch(url, { headers: { Authorization: `Bearer ${env.PUSH_RELAY_KEY}` } });
	if (response.status === 404) return { skipped: "empty" };
	if (!response.ok) throw new Error(`catalog_${response.status}`);
	const body = (await response.json()) as { updatedAt?: string; outlines?: unknown };
	const outlines = outlineListSchema.parse(body.outlines).filter((o) => o.retired || o.title);
	return { ...(await applyOutlineImport(db, outlines)), updatedAt: body.updatedAt ?? "" };
}

/** Publica la lista para todas las instalaciones. Devuelve si se pudo. */
export async function publishOutlineCatalog(outlines: ParsedTalkOutline[], env: Env = getEnv()): Promise<boolean> {
	const url = catalogUrl(env);
	if (!url || !env.CATALOG_PUBLISH_KEY) return false;
	const response = await fetch(url, {
		method: "PUT",
		headers: { Authorization: `Bearer ${env.CATALOG_PUBLISH_KEY}`, "Content-Type": "application/json" },
		body: JSON.stringify({ outlines }),
	});
	if (!response.ok) console.error("catalog_publish_failed", response.status);
	return response.ok;
}
