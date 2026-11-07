import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { errorResponse } from "@/lib/api/errors";
import { getSession, type Session } from "@/lib/auth/session";
import { assertCanAccessLiteratureModule } from "@/lib/rbac/guards";
import { LiteratureFailure } from "./service";

class BodyError extends Error {}

/** Envoltorio de las rutas del módulo: valida el acceso (con `open`, basta la sesión: Mi Panel) y traduce los errores. */
export function literatureRoute<C = Record<string, never>>(
	handler: (ctx: { session: Session; request: Request; params: C }) => Promise<Response | object>,
	opts: { open?: boolean } = {},
) {
	return async (request: Request, context: { params: Promise<C> }) => {
		try {
			const session = await getSession();
			if (opts.open) {
				if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
			} else assertCanAccessLiteratureModule(session);
			const result = await handler({ session: session as Session, request, params: await context.params });
			return result instanceof Response ? result : NextResponse.json(result);
		} catch (error) {
			if (error instanceof LiteratureFailure) return NextResponse.json({ error: error.code }, { status: error.status });
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
