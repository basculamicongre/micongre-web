import { z } from "zod";

/**
 * Versión «para editar» (PATCH) de un esquema de creación: todos los campos opcionales y SIN sus valores por omisión.
 * En zod 4, `schema.partial()` rellena los `.default()` cuando el campo no viene, y un PATCH que no manda, por ejemplo,
 * `congregationStatus` lo regresaría a «active». Aquí un campo ausente queda `undefined` (no se toca), como en zod 3.
 */
export function patchSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>): ReturnType<z.ZodObject<T>["partial"]> {
	const shape: Record<string, z.ZodType> = {};
	for (const [key, field] of Object.entries(schema.shape) as [string, z.ZodType][]) {
		shape[key] = (field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : field).optional();
	}
	return z.object(shape) as unknown as ReturnType<z.ZodObject<T>["partial"]>;
}
