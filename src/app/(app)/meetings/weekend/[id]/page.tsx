import { redirect } from "next/navigation";
import { WeekendDetail } from "@/components/meetings/weekend/WeekendDetail";
import { getSession } from "@/lib/auth/session";
import { PRIVILEGE_CODES } from "@/lib/rbac/roles";

export default async function WeekendMeetingPage({ params }: { params: Promise<{ id: string }> }) {
	const session = await getSession();
	if (!session || (session.role !== "admin" && !session.privilegeCodes.includes(PRIVILEGE_CODES.WEEKEND_ACCESS))) {
		redirect("/panel");
	}

	const { id } = await params;
	return <WeekendDetail meetingId={id} />;
}
