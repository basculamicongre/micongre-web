import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { getSession, type Session } from "@/lib/auth/session";
import { DataRequestFailure } from "./service";

/** Envoltorio de las rutas de solicitudes de datos: sesión obligatoria; cada servicio valida el alcance. */
export function dataRequestRoute(handler: (ctx: { session: Session; request: Request }) => Promise<object>) {
	return async (request: Request) => {
		try {
			const session = await getSession();
			if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
			return NextResponse.json(await handler({ session, request }));
		} catch (error) {
			if (error instanceof DataRequestFailure) return NextResponse.json({ error: error.code }, { status: error.status });
			if (error instanceof SyntaxError) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
			return errorResponse(error);
		}
	};
}
