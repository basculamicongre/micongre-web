import { describe, expect, it } from "vitest";
import { incomingTitle, weekendScheduleLabel } from "@/lib/export/builders/incoming";

describe("reporte Invitados (mes)", () => {
	it("título con las congregaciones del arreglo", () => {
		expect(incomingTitle(["Central"])).toBe("Invitados de Central");
		expect(incomingTitle(["Central", "Norte", "Central", "Sur"])).toBe("Invitados de Central, Norte y Sur");
		expect(incomingTitle([])).toBe("Oradores invitados");
	});

	it("día y hora de la reunión de fin de semana", () => {
		expect(weekendScheduleLabel("Sábado", "16:00")).toBe("Reunión: sábado, 4:00 p.m.");
		expect(weekendScheduleLabel(null, "09:30")).toBe("Reunión: 9:30 a.m.");
		expect(weekendScheduleLabel(null, null)).toBe("");
	});
});
