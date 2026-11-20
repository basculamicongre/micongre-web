import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getSession } from "@/lib/auth/session";
import { nicaraguaNow } from "@/lib/panel/upcoming";
import { preachingErrorResponse } from "@/lib/preaching/http";
import { listSessions } from "@/lib/preaching/service";
import { buildWhatsAppMessage, rangeLabel, whatsappRange, whatsappShareUrl, type WhatsAppKind } from "@/lib/preaching/whatsapp";
import { assertCanAccessPreachingModule } from "@/lib/rbac/guards";

// Mensaje para el grupo de WhatsApp de la congregación con la predicación de entre semana (?kind=weekday) o del fin de semana
// (?kind=weekend), de esta semana (?week=current, desde hoy) o de la próxima (?week=next). Solo quien administra la predicación.
export async function GET(request: Request) {
	try {
		const session = await getSession();
		assertCanAccessPreachingModule(session);
		const params = new URL(request.url).searchParams;
		const kind = params.get("kind");
		const week = params.get("week") ?? "current";
		if ((kind !== "weekday" && kind !== "weekend") || (week !== "current" && week !== "next")) {
			return NextResponse.json({ error: "invalid_params" }, { status: 400 });
		}
		const today = nicaraguaNow().date;
		const range = whatsappRange(kind as WhatsAppKind, today, week);
		const sessions = (await listSessions(getDb())).filter((s) => s.date >= range.from && s.date <= range.to);
		const text = buildWhatsAppMessage(kind as WhatsAppKind, sessions, today);
		return NextResponse.json({
			text,
			url: text ? whatsappShareUrl(text) : null,
			from: range.from,
			to: range.to,
			label: rangeLabel(range.from, range.to, today),
			count: sessions.length,
		});
	} catch (error) {
		return preachingErrorResponse(error);
	}
}
