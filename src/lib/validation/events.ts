import { z } from "zod";
import { EVENT_MEETING_ACTIONS } from "@/db/schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((v) => (v ? v : null));
const time = z
	.string()
	.regex(/^\d{2}:\d{2}$/)
	.nullish()
	.transform((v) => v ?? null);

// La visita del superintendente no se crea aquí: la crea (y borra) su módulo.
export const createEventSchema = z.object({
	kind: z.enum(["memorial", "circuit_assembly", "regional_convention", "other"]),
	title: optText(120),
	startDate: isoDate,
	endDate: isoDate,
	message: optText(2000),
	notifyDaysBefore: z.number().int().min(0).max(120).default(15),
	midweekAction: z.enum(EVENT_MEETING_ACTIONS).default("none"),
	midweekDay: optText(20),
	midweekTime: time,
	weekendAction: z.enum(EVENT_MEETING_ACTIONS).default("none"),
	weekendDay: optText(20),
	weekendTime: time,
});

export const updateEventSchema = createEventSchema.partial();
