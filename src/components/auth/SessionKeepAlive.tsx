"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// El access token dura 15 min (ver lib/auth/constants.ts); renovamos bastante
// antes de que venza para que la sesión nunca se sienta cortada mientras la
// pestaña sigue abierta. `middleware.ts` es la red de seguridad para cuando
// esto no alcanza a correr a tiempo (pestaña en segundo plano, equipo
// suspendido) — la sesión solo debe terminar por un logout explícito.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// Última renovación, compartida entre pestañas: al volver a la pestaña solo se renueva si ya pasó el intervalo (antes era en cada cambio de
// pestaña, y cada renovación cuesta CPU del Worker; si el token venció de todos modos, el middleware lo renueva solo).
const LAST_REFRESH_KEY = "mc_last_refresh";

function lastRefreshAt(): number {
	try {
		return Number(localStorage.getItem(LAST_REFRESH_KEY) ?? 0);
	} catch {
		return 0;
	}
}

export function SessionKeepAlive() {
	const router = useRouter();
	const inFlight = useRef(false);

	useEffect(() => {
		let cancelled = false;

		async function refresh() {
			if (inFlight.current) return;
			if (Date.now() - lastRefreshAt() < REFRESH_INTERVAL_MS - 30_000) return;
			inFlight.current = true;
			try {
				const response = await fetch("/api/auth/refresh", { method: "POST" });
				if (response.ok) {
					try {
						localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
					} catch {
						// Sin almacenamiento: se renueva en cada intervalo, como antes.
					}
				}
				if (!response.ok && !cancelled) {
					// Refresh token inválido/vencido/reusado, o cuenta deshabilitada:
					// ahí sí la sesión terminó de verdad.
					router.push("/login");
					router.refresh();
				}
			} catch {
				// Sin red por un momento: reintentamos en el próximo tick, no cerramos la sesión.
			} finally {
				inFlight.current = false;
			}
		}

		const interval = setInterval(refresh, REFRESH_INTERVAL_MS);

		function onVisibilityChange() {
			if (document.visibilityState === "visible") refresh();
		}
		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			cancelled = true;
			clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [router]);

	return null;
}
