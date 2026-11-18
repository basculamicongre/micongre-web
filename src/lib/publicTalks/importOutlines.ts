import { eq } from "drizzle-orm";
import { publicTalkOutlines } from "@/db/schema";
import type { Database } from "@/db/client";
import type { ParsedTalkOutline } from "./parseS99a";

const RETIRED_TITLE = "No usar";

export interface OutlineImportResult {
	created: number;
	updated: number;
	/** Marcados «No usar» en el S-99a. */
	retired: number;
	total: number;
}

/**
 * Aplica al catálogo la lista del S-99a (venga del EPUB o del PDF). `active` = false es la marca «No usar»: un número retirado
 * conserva el título que ya tenía y solo se marca; si no lo teníamos, se crea con «No usar» como título. Un número con título
 * queda sin la marca (p. ej. uno que volvió).
 */
export async function applyOutlineImport(db: Database, outlines: ParsedTalkOutline[]): Promise<OutlineImportResult> {
	const existing = await db.select().from(publicTalkOutlines);
	const existingByNumber = new Map(existing.map((row) => [row.number, row]));

	let created = 0;
	let updated = 0;
	let retired = 0;
	for (const outline of outlines) {
		const current = existingByNumber.get(outline.number);
		if (outline.retired) retired++;
		if (!current) {
			await db.insert(publicTalkOutlines).values({
				number: outline.number,
				category: outline.category,
				title: outline.retired ? RETIRED_TITLE : outline.title,
				active: !outline.retired,
			});
			created++;
			continue;
		}
		const next = outline.retired
			? { category: outline.category, title: current.title, active: false }
			: { category: outline.category, title: outline.title, active: true };
		if (current.category !== next.category || current.title !== next.title || current.active !== next.active) {
			await db.update(publicTalkOutlines).set(next).where(eq(publicTalkOutlines.id, current.id));
			updated++;
		}
	}
	return { created, updated, retired, total: outlines.length };
}
