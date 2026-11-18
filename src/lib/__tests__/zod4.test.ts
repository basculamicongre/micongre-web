import { describe, expect, it } from "vitest";
import { z } from "zod";
import { patchSchema } from "@/lib/validation/patch";
import { createPublisherSchema, updatePublisherSchema } from "@/lib/validation/publishers";
import { updateEventSchema } from "@/lib/validation/events";

// Comportamientos que cambiaron de zod 3 a zod 4 y de los que depende la app.
describe("zod 4: compatibilidad", () => {
	it("editar (PATCH) no rellena los valores por omisión de los campos que no vienen", () => {
		const parsed = updatePublisherSchema.parse({ fullName: "Juan" });
		expect(parsed).toEqual({ fullName: "Juan" });
		expect(updateEventSchema.parse({})).toEqual({});
	});
	it("crear sí usa los valores por omisión", () => {
		const parsed = createPublisherSchema.safeParse({ fullName: "Juan", gender: "male" });
		if (parsed.success) expect(parsed.data.isMinor).toBe(false);
	});
	it("patchSchema conserva la validación de cada campo", () => {
		const s = patchSchema(z.object({ n: z.number().int().min(1).default(5), name: z.string().min(1) }));
		expect(s.parse({})).toEqual({});
		expect(s.safeParse({ n: 0 }).success).toBe(false);
		expect(s.parse({ n: 3 })).toEqual({ n: 3 });
	});
	it("los id aceptan cualquier UUID con formato (no solo los RFC 4122 estrictos)", () => {
		expect(z.guid().safeParse("00000000-0000-0000-0000-000000000001").success).toBe(true);
		expect(z.guid().safeParse(crypto.randomUUID()).success).toBe(true);
		expect(z.guid().safeParse("no-es-uuid").success).toBe(false);
	});
	it("correo: patrón permisivo", () => {
		const email = updatePublisherSchema.shape.email;
		expect(email.safeParse("o'neil@ejemplo.com").success).toBe(true);
		expect(email.safeParse("juan@ejemplo.com.ni").success).toBe(true);
		expect(email.safeParse("sin-arroba").success).toBe(false);
		expect(email.safeParse(null).success).toBe(true);
	});
	it("flatten() conserva fieldErrors/formErrors (las API lo devuelven en details)", () => {
		const r = z.object({ a: z.string() }).safeParse({ a: 1 });
		expect(r.success).toBe(false);
		if (!r.success) expect(Object.keys(r.error.flatten())).toEqual(expect.arrayContaining(["fieldErrors", "formErrors"]));
	});
});
