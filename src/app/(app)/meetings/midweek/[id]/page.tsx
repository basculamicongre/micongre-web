import { redirect } from "next/navigation";
import { WeekBuilder } from "@/components/meetings/midweek/WeekBuilder";
import { getSession } from "@/lib/auth/session";
import { PRIVILEGE_CODES } from "@/lib/rbac/roles";

export default async function MidweekMeetingPage({ params }: { params: Promise<{ id: string }> }) {
	const session = await getSession();
	if (!session || (session.role !== "admin" && !session.privilegeCodes.includes(PRIVILEGE_CODES.MIDWEEK_ACCESS))) {
		redirect("/panel");
	}

	const { id } = await params;
	return <WeekBuilder meetingId={id} />;
}
