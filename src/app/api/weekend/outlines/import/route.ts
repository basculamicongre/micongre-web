import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { errorResponse } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { assertCanAccessWeekendModule } from "@/lib/rbac/guards";
import { canPublishCatalog, outlineListSchema, publishOutlineCatalog, syncOutlineCatalog } from "@/lib/publicTalks/catalogSync";
import { applyOutlineImport } from "@/lib/publicTalks/importOutlines";
import { parseS99aEpub, type ParsedTalkOutline } from "@/lib/publicTalks/parseS99a";

// El PDF se lee en el navegador (pdf.js no cabe en el Worker) y llega aquí ya convertido en la lista.
const parsedListSchema = z.object({ outlines: outlineListSchema, publish: z.boolean().optional() });
// Sin archivo: `{ catalog: true }` trae ya el catálogo central de Mi Congre (lo mismo que hace el job diario).
const catalogSchema = z.object({ catalog: z.literal(true) });

/** ¿Puede esta persona, en esta instalación, publicar el catálogo para todas las congregaciones? (admin + clave configurada) */
export async function GET() {
	try {
		const session = await getSession();
		assertCanAccessWeekendModule(session);
		return NextResponse.json({ canPublish: session?.role === "admin" && canPublishCatalog() });
	} catch (error) {
		return errorResponse(error);
	}
}

/** Importa el S-99a: un EPUB (multipart, campo `file`), la lista ya leída del PDF (JSON `{outlines}`) o, sin archivo
 * (`{catalog: true}`), el catálogo central de Mi Congre. Con `publish`, la lista del archivo además se publica en el catálogo
 * central del router para que todas las instalaciones la tomen en su job diario. */
export async function POST(request: Request) {
	try {
		const session = await getSession();
		assertCanAccessWeekendModule(session);

		let outlines: ParsedTalkOutline[];
		let publish = false;
		if (request.headers.get("content-type")?.includes("application/json")) {
			const json = await request.json().catch(() => null);
			if (catalogSchema.safeParse(json).success) {
				const synced = await syncOutlineCatalog(getDb()).catch((error) => {
					console.error("catalog_sync_failed", error);
					return { skipped: "error" as const };
				});
				if ("skipped" in synced) return NextResponse.json({ error: "catalog_unavailable" }, { status: 409 });
				return NextResponse.json({ ...synced, published: null, fromCatalog: true });
			}
			const parsed = parsedListSchema.safeParse(json);
			if (!parsed.success) return NextResponse.json({ error: "unrecognized_file" }, { status: 422 });
			outlines = parsed.data.outlines.filter((o) => o.retired || o.title);
			publish = !!parsed.data.publish;
		} else {
			const formData = await request.formData().catch(() => null);
			const file = formData?.get("file");
			if (!(file instanceof File)) {
				return NextResponse.json({ error: "missing_file" }, { status: 400 });
			}
			outlines = parseS99aEpub(await file.arrayBuffer());
			publish = formData?.get("publish") === "1";
		}
		if (outlines.length === 0) {
			return NextResponse.json({ error: "unrecognized_file" }, { status: 422 });
		}

		const result = await applyOutlineImport(getDb(), outlines);
		const published = publish && session?.role === "admin" && canPublishCatalog() ? await publishOutlineCatalog(outlines) : null;
		return NextResponse.json({ ...result, published });
	} catch (error) {
		return errorResponse(error);
	}
}
