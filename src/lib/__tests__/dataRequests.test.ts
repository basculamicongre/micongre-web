import { describe, expect, it } from "vitest";
import { isValidPastDate, isValidPhone, planRequests, validateEmergency, validatePersonal } from "../dataRequests/rules";

const today = "2026-11-09";

describe("validatePersonal", () => {
	it("limpia espacios y deja vacíos como null", () => {
		const r = validatePersonal({ fullName: "  Ana   López ", birthDate: "", baptismDate: null, phone: " ", email: " Ana@Correo.COM " }, today);
		expect(r).toEqual({ ok: true, value: { fullName: "Ana López", birthDate: null, baptismDate: null, phone: null, email: "ana@correo.com" } });
	});
	it("exige el nombre", () => {
		expect(validatePersonal({ fullName: "  " }, today)).toEqual({ ok: false, error: "name_required" });
	});
	it("rechaza fechas inválidas, futuras o bautismo antes del nacimiento", () => {
		expect(validatePersonal({ fullName: "A", birthDate: "2026-02-30" }, today)).toEqual({ ok: false, error: "invalid_birth_date" });
		expect(validatePersonal({ fullName: "A", baptismDate: "2027-01-01" }, today)).toEqual({ ok: false, error: "invalid_baptism_date" });
		expect(validatePersonal({ fullName: "A", birthDate: "2000-05-01", baptismDate: "1999-01-01" }, today)).toEqual({ ok: false, error: "baptism_before_birth" });
	});
	it("valida teléfono y email", () => {
		expect(validatePersonal({ fullName: "A", phone: "abc" }, today)).toEqual({ ok: false, error: "invalid_phone" });
		expect(validatePersonal({ fullName: "A", email: "no-es-email" }, today)).toEqual({ ok: false, error: "invalid_email" });
	});
});

describe("validateEmergency", () => {
	it("pide nombre y teléfono; la relación es opcional", () => {
		expect(validateEmergency({ name: "", phone: "8888-8888" })).toEqual({ ok: false, error: "emergency_name_required" });
		expect(validateEmergency({ name: "Juan", phone: "" })).toEqual({ ok: false, error: "emergency_phone_required" });
		expect(validateEmergency({ name: "Juan", phone: "+505 8888 8888", relation: "" })).toEqual({ ok: true, value: { name: "Juan", phone: "+505 8888 8888", relation: null } });
	});
});

describe("helpers", () => {
	it("isValidPastDate", () => {
		expect(isValidPastDate("2026-11-09", today)).toBe(true);
		expect(isValidPastDate("2026-11-10", today)).toBe(false);
		expect(isValidPastDate("1899-12-31", today)).toBe(false);
	});
	it("isValidPhone", () => {
		expect(isValidPhone("(505) 2222-3333")).toBe(true);
		expect(isValidPhone("12345")).toBe(false);
	});
	it("planRequests no repite lo pendiente ni duplicados", () => {
		expect(planRequests(["a", "b", "a"], "personal", new Set(["a:personal", "b:emergency"]))).toEqual([{ userId: "b", kind: "personal" }]);
		expect(planRequests(["a", "b"], "emergency", new Set(["a:personal"]))).toEqual([
			{ userId: "a", kind: "emergency" },
			{ userId: "b", kind: "emergency" },
		]);
	});
});
