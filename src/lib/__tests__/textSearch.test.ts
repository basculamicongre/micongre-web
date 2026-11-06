import { describe, expect, it } from "vitest";
import { matchesSearch } from "@/lib/textSearch";

describe("búsqueda en listas", () => {
	it("sin acentos ni mayúsculas, todas las palabras", () => {
		expect(matchesSearch("Oración inicial", "oracion")).toBe(true);
		expect(matchesSearch("Conductor de La Atalaya", "atalaya cond")).toBe(true);
		expect(matchesSearch("Conductor de La Atalaya", "atalaya lector")).toBe(false);
		expect(matchesSearch("Peña", "pena")).toBe(true);
		expect(matchesSearch("Cualquiera", "  ")).toBe(true);
	});
});
