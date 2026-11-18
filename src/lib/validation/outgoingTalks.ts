import { z } from "zod";
import { patchSchema } from "./patch";

export const createOutgoingTalkSchema = z.object({
	meetingDate: z.string().min(1),
	meetingTime: z.string().min(1),
	congregationId: z.string().min(1),
	speakerId: z.string().min(1),
	talkOutlineId: z.string().min(1),
});

export const updateOutgoingTalkSchema = patchSchema(createOutgoingTalkSchema);
