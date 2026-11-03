import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { errorResponse } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { JwHubError } from "@/lib/jw/hub";
import { syncOwnCongregation } from "@/lib/jw/ownCongregation";
import { assertCanAccessCongregationModule } from "@/lib/rbac/guards";

const bodySchema = z.object({ url: z.string().trim().max(2000).nullish() });

// Actualiza nuestra congregación desde JW.ORG: con `url` (enlace o texto de «Compartir») lo guarda; sin él usa el ya guardado.
export async function POST(request: Request) {
	try {
		assertCanAccessCongregationModule(await getSession());
		const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
		if (!parsed.success) return NextResponse.json({ error: "invalid_url" }, { status: 400 });
		try {
			const updated = await syncOwnCongregation(getDb(), parsed.data.url);
			if (!updated) return NextResponse.json({ error: "no_jw_url" }, { status: 400 });
			return NextResponse.json({ ok: true });
		} catch (error) {
			if (error instanceof JwHubError) {
				return NextResponse.json({ error: error.code }, { status: error.code === "unavailable" ? 502 : 400 });
			}
			throw error;
		}
	} catch (error) {
		return errorResponse(error);
	}
}
