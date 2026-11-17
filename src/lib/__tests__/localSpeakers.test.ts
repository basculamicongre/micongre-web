import { describe, expect, it } from "vitest";
import { groupLocalSpeakers, localSpeakersTitle, speakerDetails, type LocalSpeakerInput } from "@/lib/export/builders/localSpeakers";

const s = (fullName: string, rank: LocalSpeakerInput["rank"], active = true, numbers: number[] = []): LocalSpeakerInput => ({
	fullName,
	phone: null,
	email: null,
	active,
	rank,
	outlines: numbers.map((n) => ({ number: n, title: `T${n}`, song: "—" })),
});

describe("reporte de oradores locales", () => {
	const list = [
		s("Zúñiga Pedro", "ministerial_servant"),
		s("Bonilla Luis", "elder", true, [45, 7]),
		s("Álvarez Juan", "elder"),
		s("Castro Ana", "other"),
		s("Mora Raúl", "ministerial_servant", false),
	];
	it("ancianos primero, luego siervos ministeriales, cada grupo por nombre y bosquejos por número", () => {
		const groups = groupLocalSpeakers(list, false);
		expect(groups.map((g) => g.rank)).toEqual(["elder", "ministerial_servant", "other"]);
		expect(groups[0].speakers.map((x) => x.fullName)).toEqual(["Álvarez Juan", "Bonilla Luis"]);
		expect(groups[0].speakers[1].outlines.map((o) => o.number)).toEqual([7, 45]);
		expect(groups[1].speakers.map((x) => x.fullName)).toEqual(["Mora Raúl", "Zúñiga Pedro"]);
	});
	it("solo activos deja fuera a los inactivos", () => {
		const groups = groupLocalSpeakers(list, true);
		expect(groups[1].speakers.map((x) => x.fullName)).toEqual(["Zúñiga Pedro"]);
	});
	it("título con el mes y el año", () => {
		expect(localSpeakersTitle("2026-11")).toBe("Oradores públicos aprobados para Noviembre 2026");
	});
	it("datos del orador en una línea, sin lo que falta", () => {
		expect(speakerDetails({ phone: "8888-1234", email: null, active: true }, true)).toBe("Tel. 8888-1234");
		expect(speakerDetails({ phone: " ", email: "a@b.com", active: false }, true)).toBe("Inactivo · a@b.com");
		expect(speakerDetails({ phone: null, email: null, active: false }, false)).toBe("");
	});
});
