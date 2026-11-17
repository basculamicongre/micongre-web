import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { errorResponse } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { assertCanAccessWeekendModule } from "@/lib/rbac/guards";
import { applyOutlineImport } from "@/lib/publicTalks/importOutlines";
import { parseS99aEpub, type ParsedTalkOutline } from "@/lib/publicTalks/parseS99a";

// El PDF se lee en el navegador (pdf.js no cabe en el Worker) y llega aquí ya convertido en la lista.
const parsedListSchema = z.object({
	outlines: z
		.array(
			z.object({
				number: z.number().int().positive().max(999),
				category: z.string().trim().min(1).max(200),
				title: z.string().trim().max(300),
				retired: z.boolean(),
			}),
		)
		.min(1)
		.max(500),
});

/** Importa el S-99a: un EPUB (multipart, campo `file`) o la lista ya leída del PDF (JSON `{outlines}`). */
export async function POST(request: Request) {
	try {
		const session = await getSession();
		assertCanAccessWeekendModule(session);

		let outlines: ParsedTalkOutline[];
		if (request.headers.get("content-type")?.includes("application/json")) {
			const parsed = parsedListSchema.safeParse(await request.json().catch(() => null));
			if (!parsed.success) return NextResponse.json({ error: "unrecognized_file" }, { status: 422 });
			outlines = parsed.data.outlines.filter((o) => o.retired || o.title);
		} else {
			const formData = await request.formData().catch(() => null);
			const file = formData?.get("file");
			if (!(file instanceof File)) {
				return NextResponse.json({ error: "missing_file" }, { status: 400 });
			}
			outlines = parseS99aEpub(await file.arrayBuffer());
		}
		if (outlines.length === 0) {
			return NextResponse.json({ error: "unrecognized_file" }, { status: 422 });
		}

		return NextResponse.json(await applyOutlineImport(getDb(), outlines));
	} catch (error) {
		return errorResponse(error);
	}
}
