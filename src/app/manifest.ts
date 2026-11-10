import type { MetadataRoute } from "next";

/**
 * Manifiesto de la web instalable (`/manifest.webmanifest`). Sirve para agregar Mi Congre a la pantalla de inicio y, sobre todo,
 * para que en iPhone y iPad (iOS 16.4+) lleguen las notificaciones push: Safari solo las permite a sitios abiertos desde la
 * pantalla de inicio. Abre en Mi Panel.
 */
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Mi Congre",
		short_name: "Mi Congre",
		description: "Administración de congregación",
		lang: "es",
		start_url: "/panel",
		scope: "/",
		display: "standalone",
		background_color: "#03233F",
		theme_color: "#03233F",
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
	};
}
