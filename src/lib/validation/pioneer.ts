import { z } from "zod";
import { PIONEER_STUDY_STATUSES } from "@/db/schema";
import { MAX_HOURS_PER_ENTRY } from "@/lib/pioneer/rules";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optText = (max: number) => z.string().trim().max(max).nullable().optional();

export const hoursSchema = z.object({
	entryDate: isoDate,
	hours: z.number().positive().max(MAX_HOURS_PER_ENTRY),
	comment: optText(300),
});

export const hoursUpdateSchema = hoursSchema.partial();

export const studySchema = z.object({
	name: z.string().trim().min(1).max(120),
	status: z.enum(PIONEER_STUDY_STATUSES),
	weekday: z.number().int().min(1).max(7).nullable().optional(),
	comment: optText(1000),
	latitude: z.number().min(-90).max(90).nullable().optional(),
	longitude: z.number().min(-180).max(180).nullable().optional(),
});

export const studyUpdateSchema = studySchema.partial();
