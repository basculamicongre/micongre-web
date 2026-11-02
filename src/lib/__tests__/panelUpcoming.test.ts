import { describe, expect, it } from "vitest";
import { selectUpcoming } from "@/lib/panel/upcoming";
import type { PanelAssignment } from "@/lib/queries/panel";

const w = { today: "2026-11-03", weekStart: "2026-11-02", weekEnd: "2026-11-08" };
const a = (over: Partial<PanelAssignment> & Pick<PanelAssignment, "date" | "meetingType" | "label">): PanelAssignment => ({ ...over });
const labels = (list: PanelAssignment[]) => list.map((x) => x.label);

describe("Mis asignaciones: solo lo que sigue", () => {
	it("de las reuniones muestra todo lo de la siguiente de cada tipo (partes y acomodadores)", () => {
		const out = selectUpcoming(
			[
				a({ date: "2026-11-09", meetingType: "midweek", label: "Lectura", bucket: "meeting:midweek" }),
				a({ date: "2026-11-09", meetingType: "operational", label: "Micrófono 1", bucket: "meeting:midweek" }),
				a({ date: "2026-11-16", meetingType: "midweek", label: "Oración", bucket: "meeting:midweek" }),
				a({ date: "2026-11-07", meetingType: "weekend", label: "Presidente", bucket: "meeting:weekend" }),
				a({ date: "2026-11-14", meetingType: "operational", label: "Plataforma", bucket: "meeting:weekend" }),
			],
			w,
		);
		expect(labels(out)).toEqual(["Presidente", "Lectura", "Micrófono 1"]);
	});

	it("de lo demás solo el siguiente de cada tipo; predicación pública aparte de la de la congregación", () => {
		const out = selectUpcoming(
			[
				a({ date: "2026-11-04", meetingType: "cleaning", label: "Limpieza 1" }),
				a({ date: "2026-11-11", meetingType: "cleaning", label: "Limpieza 2" }),
				a({ date: "2026-11-05", meetingType: "preaching", label: "Congregación 1", bucket: "preaching:group", territoryIds: ["t9"] }),
				a({ date: "2026-11-06", meetingType: "preaching", label: "Congregación 2", bucket: "preaching:group", territoryIds: ["t9"] }),
				a({ date: "2026-11-07", meetingType: "preaching", label: "Pública 1", bucket: "preaching:public", territoryIds: ["p1"] }),
				a({ date: "2026-11-14", meetingType: "preaching", label: "Pública 2", bucket: "preaching:public", territoryIds: ["p1"] }),
			],
			w,
		);
		expect(labels(out)).toEqual(["Limpieza 1", "Congregación 1", "Pública 1"]);
	});

	it("el capitán no ve la salida repetida: la fecha de la siguiente se agrega a su territorio", () => {
		const out = selectUpcoming(
			[
				a({ date: "2026-10-20", meetingType: "territory", label: "Territorio 4", territory: { assignmentId: "a", territoryId: "t4", status: "assigned", comment: null } }),
				a({ date: "2026-11-05", meetingType: "preaching", label: "Salida t4", bucket: "preaching:group", territoryIds: ["t4"], when: "05/nov 8:45 a. m." }),
				a({ date: "2026-11-12", meetingType: "preaching", label: "Salida t4 b", bucket: "preaching:group", territoryIds: ["t4"], when: "12/nov 8:45 a. m." }),
			],
			w,
		);
		expect(labels(out)).toEqual(["Territorio 4 · Salida: 05/nov 8:45 a. m."]);
		expect(out[0]).not.toHaveProperty("bucket");
	});

	it("discursos: todos los de esta semana (o el siguiente) y quienes salen, solo esta semana", () => {
		const out = selectUpcoming(
			[
				a({ date: "2026-11-07", meetingType: "outgoing_talk", label: "Mi discurso A" }),
				a({ date: "2026-11-08", meetingType: "outgoing_talk", label: "Mi discurso B" }),
				a({ date: "2026-11-15", meetingType: "outgoing_talk", label: "Mi discurso C" }),
				a({ date: "2026-11-08", meetingType: "outgoing_talk", label: "Sale Juan", bucket: "talks_out" }),
			],
			w,
		);
		expect(labels(out)).toEqual(["Mi discurso A", "Mi discurso B", "Sale Juan"]);
		const later = selectUpcoming([a({ date: "2026-11-15", meetingType: "outgoing_talk", label: "C" }), a({ date: "2026-11-22", meetingType: "outgoing_talk", label: "D" })], w);
		expect(labels(later)).toEqual(["C"]);
	});
});
