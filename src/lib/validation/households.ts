import { z } from "zod";
import { patchSchema } from "./patch";

export const createHouseholdSchema = z.object({
	label: z.string().min(1),
});

export const updateHouseholdSchema = patchSchema(createHouseholdSchema);
