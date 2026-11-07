// Búsqueda de texto para listas en pantalla: sin distinguir mayúsculas ni acentos, y cada palabra buscada debe aparecer.

/** Minúsculas y sin acentos (á → a, ñ → n). */
export function foldText(value: string): string {
	return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** true si `text` contiene todas las palabras de `query` (vacía = todo coincide). */
export function matchesSearch(text: string, query: string): boolean {
	const words = foldText(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return true;
	const t = foldText(text);
	return words.every((w) => t.includes(w));
}
