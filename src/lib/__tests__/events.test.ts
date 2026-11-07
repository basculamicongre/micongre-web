import { describe, expect, it } from "vitest";
import { effectiveMeetingDate, effectiveMeetingTime } from "@/lib/attendance/summary";
import {
	buildOverrides,
	cancelledStatus,
	coVisitForWeek,
	eventForMeeting,
	isNoticeDue,
	noticeText,
	notifyOn,
	validateEvent,
	type EventLike,
} from "@/lib/events/rules";

const base: EventLike = {
	kind: "circuit_assembly",
	title: null,
	startDate: "2026-11-15",
	endDate: "2026-11-15",
	message: null,
	notifyDaysBefore: 15,
	notifiedAt: null,
	midweekAction: "none",
	midweekDay: null,
	midweekTime: null,
	weekendAction: "cancel",
	weekendDay: null,
	weekendTime: null,
};

describe("eventos de la congregación", () => {
	it("afecta solo la reunión configurada de su semana", () => {
		// Domingo 15/nov: semana del lunes 9. Fin de semana guardado el sábado 14; entre semana el lunes 9.
		expect(eventForMeeting([base], "2026-11-14", "weekend")).toBe(base);
		expect(eventForMeeting([base], "2026-11-09", "midweek")).toBeNull();
		expect(eventForMeeting([base], "2026-11-21", "weekend")).toBeNull();
	});

	it("si dos eventos tocan la misma reunión, el que cancela gana", () => {
		const move: EventLike = { ...base, kind: "other", title: "Limpieza", weekendAction: "move", weekendDay: "Sábado", weekendTime: "16:00" };
		expect(eventForMeeting([move, base], "2026-11-14", "weekend")).toBe(base);
	});

	it("mover cambia la fecha y la hora reales solo esa semana", () => {
		const visit: EventLike = { ...base, kind: "co_visit", startDate: "2026-11-10", endDate: "2026-11-15", weekendAction: "none", midweekAction: "move", midweekDay: "Martes", midweekTime: "19:30" };
		const schedules = { midweek: { day: "Jueves", time: "19:00" }, weekend: { day: "Domingo", time: "09:30" }, overrides: buildOverrides([visit]) };
		expect(effectiveMeetingDate("2026-11-09", "midweek", schedules)).toBe("2026-11-10");
		expect(effectiveMeetingTime("2026-11-09", "midweek", schedules)).toBe("19:30");
		// La semana siguiente, como siempre.
		expect(effectiveMeetingDate("2026-11-16", "midweek", schedules)).toBe("2026-11-19");
		expect(effectiveMeetingTime("2026-11-16", "midweek", schedules)).toBe("19:00");
		expect(coVisitForWeek([visit], "2026-11-14")).toBe(visit);
	});

	it("estado de la reunión cancelada", () => {
		expect(cancelledStatus("memorial", "midweek")).toBe("cancelled_memorial");
		expect(cancelledStatus("other", "midweek")).toBe("cancelled_assembly");
		expect(cancelledStatus("memorial", "weekend")).toBe("cancelled");
	});

	it("aviso X días antes, una sola vez y no después del evento", () => {
		expect(notifyOn(base)).toBe("2026-10-31");
		expect(isNoticeDue(base, "2026-10-30")).toBe(false);
		expect(isNoticeDue(base, "2026-10-31")).toBe(true);
		expect(isNoticeDue(base, "2026-11-16")).toBe(false);
		expect(isNoticeDue({ ...base, notifiedAt: new Date() }, "2026-11-01")).toBe(false);
	});

	it("texto del aviso", () => {
		const e: EventLike = { ...base, midweekAction: "move", midweekDay: "Martes", midweekTime: "19:30", message: "Lleven su Biblia." };
		expect(noticeText(e)).toBe(
			"Asamblea de circuito: el domingo 15 de noviembre.\nLa reunión de entre semana pasa al martes a las 7:30 p. m.\nLa reunión de fin de semana se cancela.\nLleven su Biblia.",
		);
	});

	it("validación", () => {
		expect(validateEvent(base)).toBeNull();
		expect(validateEvent({ ...base, kind: "other" })).toBe("title_required");
		expect(validateEvent({ ...base, endDate: "2026-11-14", startDate: "2026-11-15" })).toBe("end_before_start");
		expect(validateEvent({ ...base, endDate: "2026-11-17" })).toBe("spans_weeks");
		expect(validateEvent({ ...base, weekendAction: "move" })).toBe("move_needs_day_and_time");
		expect(validateEvent({ ...base, weekendAction: "move", weekendDay: "Sábado" })).toBe("move_needs_day_and_time");
		expect(validateEvent({ ...base, weekendAction: "move", weekendDay: "Sabado", weekendTime: "16:00" })).toBe("invalid_day");
	});
});
