import { z } from "zod";
import { LITERATURE_CATEGORIES, LITERATURE_OFFER_AUDIENCES } from "@/db/schema";
import { MAX_OFFER_QUANTITY } from "@/lib/literature/rules";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optText = (max: number) => z.string().trim().max(max).nullable().optional();

export const publicationSchema = z.object({
	code: z.string().trim().min(1).max(40),
	title: z.string().trim().min(1).max(300),
	category: z.enum(LITERATURE_CATEGORIES),
});

export const publicationUpdateSchema = publicationSchema.partial();

export const locationSchema = z.object({ name: z.string().trim().min(1).max(80) });

export const inventorySchema = z.object({
	countDate: isoDate,
	notes: optText(500),
	copyFromId: z.string().min(1).nullable().optional(),
});

export const inventoryUpdateSchema = z.object({ countDate: isoDate.optional(), notes: optText(500) });

const quantity = z.number().int().min(0).max(1_000_000);

export const inventoryItemSchema = z.object({ publicationId: z.string().min(1), locationId: z.string().min(1), quantity });

export const inventoryItemUpdateSchema = z.object({ quantity });

export const offerSchema = z.object({
	publicationId: z.string().min(1),
	audience: z.enum(LITERATURE_OFFER_AUDIENCES),
	message: optText(500),
	endsOn: isoDate,
});

export const offerUpdateSchema = offerSchema.partial();

export const orderSchema = z.object({
	publicationId: z.string().min(1),
	userId: z.string().min(1),
	quantity: z.number().int().min(1).max(MAX_OFFER_QUANTITY),
	note: optText(300),
});

export const orderUpdateSchema = orderSchema.partial().extend({ archived: z.boolean().optional() });

export const offerResponseSchema = z.object({
	answer: z.enum(["yes", "no"]),
	quantity: z.number().int().min(1).max(MAX_OFFER_QUANTITY).optional(),
});
