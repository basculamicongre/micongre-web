import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { errorResponse } from "@/lib/api/errors";
import { getSession, type Session } from "@/lib/auth/session";
import { assertCanUsePioneerTools } from "@/lib/rbac/guards";
import { PioneerFailure } from "./service";

class BodyError extends Error {}

/** Envoltorio de las rutas del módulo: solo quien tiene «Herramientas de precursor»; cada quien ve y cambia solo lo suyo. */
export function pioneerRoute<C = Record<string, never>>(handler: (ctx: { session: Session; request: Request; params: C }) => Promise<Response | object>) {
	return async (request: Request, context: { params: Promise<C> }) => {
		try {
			const session = await getSession();
			assertCanUsePioneerTools(session);
			const result = await handler({ session, request, params: await context.params });
			return result instanceof Response ? result : NextResponse.json(result);
		} catch (error) {
			if (error instanceof PioneerFailure) return NextResponse.json({ error: error.code }, { status: error.status });
			if (error instanceof BodyError) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
			return errorResponse(error);
		}
	};
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
	const parsed = schema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw new BodyError();
	return parsed.data;
}
