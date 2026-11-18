import { z } from "zod";
import { patchSchema } from "./patch";

export const createFieldServiceGroupSchema = z.object({
	name: z.string().min(1),
	overseerUserId: z.guid().nullable().optional(),
	assistantUserId: z.guid().nullable().optional(),
	regularMeetingPlace: z.string().nullable().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.nullable()
		.optional(),
});

export const updateFieldServiceGroupSchema = patchSchema(createFieldServiceGroupSchema).extend({
	active: z.boolean().optional(),
});
