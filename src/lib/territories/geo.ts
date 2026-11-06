// Dibujo vectorial de un territorio: GeoJSON restringido a lo que se puede
// dibujar en el editor (polígonos, líneas, puntos y textos). Seguro de importar
// tanto en el servidor como en el bundle cliente.

export type LngLat = [number, number];

export type TerritoryGeometry =
	| { type: "Point"; coordinates: LngLat }
	| { type: "LineString"; coordinates: LngLat[] }
	| { type: "Polygon"; coordinates: LngLat[][] };

export interface TerritoryFeatureProperties {
	/** Id propio del elemento dibujado (el editor lo usa para seleccionar). */
	fid: string;
	/** "text" = rótulo de texto (Point con `text`); sin valor = figura normal. */
	kind?: "text";
	text?: string;
	/** Solo puntos: emoji que se muestra en lugar del punto (sin valor = punto). */
	emoji?: string;
	/** Solo puntos: etiqueta que se muestra pegada debajo del punto, a cualquier zoom. */
	label?: string;
	/** Solo puntos: es un punto de salida a la predicación (se marca con un pulso). Puede haber varios; `label` es su nombre. */
	departure?: boolean;
	/** Solo puntos de salida: dirección escrita. */
	address?: string;
	/** Solo puntos de salida: el que se usa si la salida de predicación no elige otro (uno por territorio). */
	departureDefault?: boolean;
	/** Solo textos: tamaño de la letra (sin valor = normal). */
	size?: TextSize;
	/** Solo en el mapa de todos los territorios (no se guarda): color del territorio; en un texto, rótulo con ese fondo. */
	color?: string;
}

/** Emojis que ofrece el editor para los puntos (también se puede escribir otro). */
export const POINT_EMOJIS = ["📍", "🏠", "🏢", "🏫", "⛪", "🛒", "🅿️", "🚏", "🚫", "⚠️", "🐕", "🔒", "🔔", "👥", "✅", "❌"];
export const DEFAULT_POINT_EMOJI = "📍";

export interface TerritoryFeature {
	type: "Feature";
	geometry: TerritoryGeometry;
	properties: TerritoryFeatureProperties;
}

export interface TerritoryMapData {
	type: "FeatureCollection";
	features: TerritoryFeature[];
}

export type TerritoryKind = "general" | "public_preaching";

export const TEXT_SIZES = ["normal", "medium", "large"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
/** Tamaño de letra (px) de cada tamaño de texto. */
export const TEXT_SIZE_PX: Record<TextSize, number> = { normal: 14, medium: 19, large: 26 };

export const TERRITORY_KIND_LABEL: Record<TerritoryKind, string> = {
	general: "General",
	public_preaching: "Predicación pública",
};

export type DrawTool = "polygon" | "line" | "point" | "text";

/** Qué se puede dibujar en el mapa de cada tipo de territorio: los dos tipos admiten lo mismo. */
export const ALLOWED_TOOLS: Record<TerritoryKind, DrawTool[]> = {
	general: ["polygon", "line", "point", "text"],
	public_preaching: ["polygon", "line", "point", "text"],
};

/** Los elementos del dibujo que el tipo de territorio no admite (hoy ninguno: los dos tipos admiten todo). */
export function hasDisallowedFeatures(data: TerritoryMapData, kind: TerritoryKind): boolean {
	return data.features.some((f) => !ALLOWED_TOOLS[kind].includes(f.geometry.type === "Point" ? (f.properties.kind === "text" ? "text" : "point") : f.geometry.type === "Polygon" ? "polygon" : "line"));
}

/** Un punto de salida a la predicación del territorio. */
export interface Departure {
	fid: string;
	name: string;
	address: string | null;
	lng: number;
	lat: number;
	/** El predeterminado (el marcado; si ninguno lo está, el primero). */
	isDefault: boolean;
}

/** Los puntos de salida del dibujo, en el orden en que se dibujaron; exactamente uno lleva `isDefault`. */
export function listDepartures(data: TerritoryMapData | null | undefined): Departure[] {
	const list: Departure[] = [];
	for (const f of data?.features ?? []) {
		if (f.geometry.type !== "Point" || !f.properties.departure || f.properties.kind === "text") continue;
		const [lng, lat] = f.geometry.coordinates;
		list.push({
			fid: f.properties.fid,
			// Sin repetir «Salida:» si la etiqueta ya lo trae (en el aviso va como «Salida: nombre»).
			name: f.properties.label?.trim().replace(/^salida\s*:\s*/i, "") || "Punto de salida",
			address: f.properties.address?.trim() || null,
			lng,
			lat,
			isDefault: !!f.properties.departureDefault,
		});
	}
	const def = list.findIndex((d) => d.isDefault);
	return list.map((d, i) => ({ ...d, isDefault: def >= 0 ? i === def : i === 0 }));
}

/** El punto elegido para una salida de predicación; si no existe (o no se eligió), el predeterminado; null sin puntos de salida. */
export function resolveDeparture(list: Departure[], fid: string | null | undefined): Departure | null {
	return (fid ? list.find((d) => d.fid === fid) : undefined) ?? list.find((d) => d.isDefault) ?? null;
}

/** «Nombre — dirección» (o solo el nombre). */
export function departureText(d: Departure): string {
	return d.address ? `${d.name} — ${d.address}` : d.name;
}

/** El punto de salida predeterminado del dibujo (lng, lat), si hay alguno. */
export function departurePoint(data: TerritoryMapData | null | undefined): LngLat | null {
	const d = resolveDeparture(listDepartures(data), null);
	return d ? [d.lng, d.lat] : null;
}

export const MAX_FEATURES = 500;
export const MAX_MAP_DATA_CHARS = 400_000;

export function emptyMapData(): TerritoryMapData {
	return { type: "FeatureCollection", features: [] };
}

export function allCoordinates(data: TerritoryMapData | null | undefined): LngLat[] {
	if (!data) return [];
	const out: LngLat[] = [];
	for (const f of data.features) {
		const g = f.geometry;
		if (g.type === "Point") out.push(g.coordinates);
		else if (g.type === "LineString") out.push(...g.coordinates);
		else for (const ring of g.coordinates) out.push(...ring);
	}
	return out;
}

/** [oeste, sur, este, norte] de todo lo dibujado, o null si no hay nada. */
export function boundsOf(data: TerritoryMapData | null | undefined): [number, number, number, number] | null {
	const coords = allCoordinates(data);
	if (coords.length === 0) return null;
	let w = Infinity;
	let s = Infinity;
	let e = -Infinity;
	let n = -Infinity;
	for (const [lng, lat] of coords) {
		if (lng < w) w = lng;
		if (lng > e) e = lng;
		if (lat < s) s = lat;
		if (lat > n) n = lat;
	}
	return [w, s, e, n];
}

export function parseMapData(raw: string | null | undefined): TerritoryMapData | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as TerritoryMapData;
		return parsed && parsed.type === "FeatureCollection" && Array.isArray(parsed.features) ? parsed : null;
	} catch {
		return null;
	}
}
