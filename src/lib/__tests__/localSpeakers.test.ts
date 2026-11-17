import { describe, expect, it } from "vitest";
import { localSpeakerRows } from "@/lib/export/builders/localSpeakers";

const list = [
	{ fullName: "Zúñiga Pedro", phone: null, active: false, outlineNumbers: [12, 3] },
	{ fullName: "Álvarez Juan", phone: "8888-0000", active: true, outlineNumbers: [] },
	{ fullName: "Bonilla Luis", phone: "8888-1111", active: true, outlineNumbers: [45, 7, 101] },
];

describe("localSpeakerRows", () => {
	it("solo activos: sin columna de estado, por nombre y bosquejos ordenados", () => {
		expect(localSpeakerRows(list, true)).toEqual([
			["Álvarez Juan", "8888-0000", "—", 0],
			["Bonilla Luis", "8888-1111", "7, 45, 101", 3],
		]);
	});
	it("todos: incluye inactivos con su estado", () => {
		const rows = localSpeakerRows(list, false);
		expect(rows).toHaveLength(3);
		expect(rows[2]).toEqual(["Zúñiga Pedro", "", "Inactivo", "3, 12", 2]);
		expect(rows[0][2]).toBe("Activo");
	});
});
