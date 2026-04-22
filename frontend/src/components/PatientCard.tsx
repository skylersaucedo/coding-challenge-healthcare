import { Patient } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Clock } from "lucide-react";

const URGENCY_STYLE: Record<string, "danger" | "warning" | "success"> = {
  IMMEDIATE: "danger",
  MONITOR: "warning",
  "CAN WAIT": "success",
};

const URGENCY_BORDER: Record<string, string> = {
  IMMEDIATE: "#ef4444",
  MONITOR: "#f59e0b",
  "CAN WAIT": "#22c55e",
};

function ageFromDob(dob: string | null): string {
  if (!dob) return "?";
  const diff = Date.now() - new Date(dob).getTime();
  return `${Math.floor(diff / (365.25 * 24 * 3600 * 1000))}y`;
}

function waitLabel(arrivedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(arrivedAt).getTime()) / 60_000);
  if (mins < 60) return `${mins}m waiting`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m waiting`;
}

interface PatientCardProps {
  patient: Patient;
  onClick: () => void;
}

export default function PatientCard({ patient, onClick }: PatientCardProps) {
  const { urgency } = patient;

  return (
    <Card
      className="mb-2 cursor-pointer hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: urgency ? URGENCY_BORDER[urgency] : "#94a3b8" }}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              {patient.first_name} {patient.last_name}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <User className="h-3 w-3" />
              {patient.gender ?? "—"} &bull; {ageFromDob(patient.date_of_birth)}
            </p>
          </div>
          {urgency ? (
            <Badge variant={URGENCY_STYLE[urgency] ?? "outline"} className="shrink-0 text-[10px]">
              {urgency}
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
              Unassessed
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {patient.chief_complaint}
        </p>
        <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {waitLabel(patient.created_at)}
        </div>
      </CardContent>
    </Card>
  );
}
