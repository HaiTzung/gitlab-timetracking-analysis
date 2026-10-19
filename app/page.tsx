import TimeTrackingDashboard from "@/components/TimeTrackingDashboard";

const startDate = new Date(process.env.NEXT_PUBLIC_START_DATE ?? "2026-09-27");
const endDate = new Date(process.env.NEXT_PUBLIC_END_DATE ?? "2027-07-01");

export default function Home() {
  return (
    <TimeTrackingDashboard startDate={startDate} endDate={endDate} />
  );
}
