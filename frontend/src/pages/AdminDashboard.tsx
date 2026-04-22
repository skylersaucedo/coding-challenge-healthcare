import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { StaffMember, StageMetric } from "@/types";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Activity } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  physician: "Physician",
  nurse: "Nurse",
  charge_nurse: "Charge Nurse",
  specialist: "Specialist",
};

const SHIFT_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  day: "default",
  evening: "secondary",
  night: "outline",
};

export default function AdminDashboard() {
  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["staff"],
    queryFn: () => apiFetch<StaffMember[]>("/admin/staff"),
  });

  const { data: metrics } = useQuery<{ stages: StageMetric[]; total_patients: number }>({
    queryKey: ["metrics"],
    queryFn: () => apiFetch("/admin/metrics"),
    refetchInterval: 30_000,
  });

  const physicians = staff.filter((s) => s.role === "physician" || s.role === "specialist");
  const nurses = staff.filter((s) => s.role === "nurse" || s.role === "charge_nurse");

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Navbar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold">Administration Dashboard</h1>

          {/* ED Capacity Metrics */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">ED Capacity</h2>
              {metrics && (
                <span className="text-sm text-muted-foreground ml-auto">
                  {metrics.total_patients} total patients
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(metrics?.stages ?? []).map((s) => (
                <Card key={s.stage}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium">{s.label}</p>
                      <Badge
                        variant={
                          s.utilization >= 90
                            ? "danger"
                            : s.utilization >= 70
                              ? "warning"
                              : "success"
                        }
                        className="text-[10px]"
                      >
                        {s.utilization}%
                      </Badge>
                    </div>
                    <Progress
                      value={s.utilization}
                      className={
                        s.utilization >= 90
                          ? "[&>div]:bg-red-500"
                          : s.utilization >= 70
                            ? "[&>div]:bg-amber-500"
                            : "[&>div]:bg-green-500"
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {s.count} / {s.capacity} beds
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Staff Directory */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Staff Directory</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Physicians & Specialists */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Physicians & Specialists</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-72">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-4 py-2 font-medium">Name</th>
                          <th className="text-left px-4 py-2 font-medium">Specialty</th>
                          <th className="text-left px-4 py-2 font-medium">Shift</th>
                          <th className="text-left px-4 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {physicians.map((s) => (
                          <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-2 font-medium">
                              Dr. {s.first_name} {s.last_name}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {s.specialty ?? ROLE_LABEL[s.role]}
                            </td>
                            <td className="px-4 py-2">
                              <Badge variant={SHIFT_BADGE[s.shift] ?? "outline"} className="text-[10px] capitalize">
                                {s.shift}
                              </Badge>
                            </td>
                            <td className="px-4 py-2">
                              <Badge variant={s.is_on_duty ? "success" : "outline"} className="text-[10px]">
                                {s.is_on_duty ? "On Duty" : "Off"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Nurses */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Nursing Staff</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-72">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-4 py-2 font-medium">Name</th>
                          <th className="text-left px-4 py-2 font-medium">Role</th>
                          <th className="text-left px-4 py-2 font-medium">Shift</th>
                          <th className="text-left px-4 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nurses.map((s) => (
                          <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-2 font-medium">
                              {s.first_name} {s.last_name}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {ROLE_LABEL[s.role]}
                            </td>
                            <td className="px-4 py-2">
                              <Badge variant={SHIFT_BADGE[s.shift] ?? "outline"} className="text-[10px] capitalize">
                                {s.shift}
                              </Badge>
                            </td>
                            <td className="px-4 py-2">
                              <Badge variant={s.is_on_duty ? "success" : "outline"} className="text-[10px]">
                                {s.is_on_duty ? "On Duty" : "Off"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
