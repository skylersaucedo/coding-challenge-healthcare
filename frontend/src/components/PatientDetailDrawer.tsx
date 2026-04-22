import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Patient, Vitals, TriageAssessment } from "@/types";
import { apiFetch } from "@/api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  Stethoscope,
  AlertTriangle,
  MessageSquare,
  Loader2,
  Clock,
  ListChecks,
  Zap,
  Eye,
  ArrowUpRight,
} from "lucide-react";

const URGENCY_BADGE: Record<string, "danger" | "warning" | "success"> = {
  IMMEDIATE: "danger",
  MONITOR: "warning",
  "CAN WAIT": "success",
};

const URGENCY_BG: Record<string, string> = {
  IMMEDIATE: "bg-red-50 border border-red-200",
  MONITOR: "bg-amber-50 border border-amber-200",
  "CAN WAIT": "bg-green-50 border border-green-200",
};

function waitLabel(arrivedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(arrivedAt).getTime()) / 60_000);
  if (mins < 60) return `${mins}m waiting`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface Props {
  patient: Patient | null;
  onClose: () => void;
}

type AssessmentRow = TriageAssessment & {
  confidence: number;
  rationale: string;
  red_flags: string[];
  missing_fields: string[];
  assessed_at?: string;
};

export default function PatientDetailDrawer({ patient, onClose }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const { data: vitals } = useQuery<Vitals[]>({
    queryKey: ["vitals", patient?.id],
    queryFn: () => apiFetch<Vitals[]>(`/patients/${patient!.id}/vitals`),
    enabled: !!patient,
  });

  const { data: assessments, refetch: refetchAssessments } = useQuery<AssessmentRow[]>({
    queryKey: ["assessments", patient?.id],
    queryFn: () => apiFetch<AssessmentRow[]>(`/triage/assessments/${patient!.id}`),
    enabled: !!patient,
  });

  const assessMutation = useMutation({
    mutationFn: () => apiFetch<TriageAssessment>(`/triage/assess/${patient!.id}`, { method: "POST" }),
    onSuccess: () => refetchAssessments(),
  });

  const followupMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ answer: string }>(`/triage/followup/${patient!.id}`, {
        method: "POST",
        body: JSON.stringify({ nurse_question: question }),
      }),
    onSuccess: (data) => {
      setAnswer(data.answer);
      setQuestion("");
    },
  });

  if (!patient) return null;

  const latest = assessments?.[0];
  const latestVitals = vitals?.[0];
  const stage = patient.stage;

  return (
    <Dialog open={!!patient} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>
                {patient.first_name} {patient.last_name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{patient.chief_complaint}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {latest?.urgency && (
                <Badge variant={URGENCY_BADGE[latest.urgency] ?? "outline"} className="text-xs">
                  {latest.urgency}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {waitLabel(patient.created_at)}
              </span>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-4 space-y-6">

            {/* Urgency banner for intake/vitals */}
            {(stage === "intake" || stage === "vitals") && latest && (
              <section className={`rounded-xl p-4 ${URGENCY_BG[latest.urgency] ?? "bg-muted"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4" />
                  <span className="text-sm font-semibold">Triage Urgency</span>
                  <Badge variant={URGENCY_BADGE[latest.urgency] ?? "outline"} className="text-xs">
                    {latest.urgency}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {Math.round(latest.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="text-sm">{latest.rationale}</p>
                {latest.missing_fields?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Missing info: {latest.missing_fields.join(", ")}
                  </p>
                )}
              </section>
            )}

            {/* Demographics */}
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Patient Information
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">DOB</span>
                <span>{patient.date_of_birth ?? "—"}</span>
                <span className="text-muted-foreground">Gender</span>
                <span>{patient.gender ?? "—"}</span>
                <span className="text-muted-foreground">Stage</span>
                <Badge variant="outline" className="w-fit capitalize">
                  {patient.stage.replace("_", " ")}
                </Badge>
              </div>
            </section>

            {/* Intake data */}
            {patient.intake_data && (
              <section>
                <h3 className="text-sm font-semibold mb-2">Intake Details</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {(patient.intake_data.allergies as string[])?.length > 0 && (
                    <>
                      <span className="text-muted-foreground">Allergies</span>
                      <span>{(patient.intake_data.allergies as string[]).join(", ")}</span>
                    </>
                  )}
                  {(patient.intake_data.medical_history as string[])?.length > 0 && (
                    <>
                      <span className="text-muted-foreground">Medical History</span>
                      <span>{(patient.intake_data.medical_history as string[]).join(", ")}</span>
                    </>
                  )}
                  {(patient.intake_data.current_medications as string[])?.length > 0 && (
                    <>
                      <span className="text-muted-foreground">Medications</span>
                      <span>{(patient.intake_data.current_medications as string[]).join(", ")}</span>
                    </>
                  )}
                </div>
              </section>
            )}

            {/* Vitals */}
            {latestVitals && (
              <section>
                <h3 className="text-sm font-semibold mb-2">Latest Vitals</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "HR", value: latestVitals.heart_rate ? `${latestVitals.heart_rate} bpm` : "—" },
                    { label: "BP", value: latestVitals.blood_pressure_systolic ? `${latestVitals.blood_pressure_systolic}/${latestVitals.blood_pressure_diastolic}` : "—" },
                    { label: "Temp", value: latestVitals.temperature ? `${latestVitals.temperature}°C` : "—" },
                    { label: "RR", value: latestVitals.respiratory_rate ? `${latestVitals.respiratory_rate}/min` : "—" },
                    { label: "SpO2", value: latestVitals.oxygen_saturation ? `${latestVitals.oxygen_saturation}%` : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <Separator />

            {/* AI Assessment section */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Triage Assessment
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => assessMutation.mutate()}
                  disabled={assessMutation.isPending}
                >
                  {assessMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  {latest ? "Re-assess" : "Run Assessment"}
                </Button>
              </div>

              {assessMutation.isError && (
                <p className="text-xs text-destructive mb-2">
                  Assessment failed: {(assessMutation.error as Error)?.message}
                </p>
              )}

              {latest && (
                <div className="space-y-4">
                  {/* Red flags (all stages) */}
                  {latest.red_flags?.length > 0 && (
                    <div className="flex items-start gap-2 bg-red-50 rounded-lg p-3">
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-red-700 mb-1">Red Flags</p>
                        <ul className="text-xs text-red-600 space-y-0.5">
                          {latest.red_flags.map((f, i) => (
                            <li key={i}>• {f}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Doc Visit: recommended actions organized by category */}
                  {stage === "doc_visit" && latest.recommended_actions && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">{latest.rationale}</p>

                      {latest.recommended_actions.immediate?.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-red-700 flex items-center gap-1 mb-1.5">
                            <Zap className="h-3.5 w-3.5" /> Immediate
                          </p>
                          <ul className="text-xs text-red-800 space-y-0.5">
                            {latest.recommended_actions.immediate.map((a, i) => (
                              <li key={i}>• {a}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {latest.recommended_actions.monitor?.length > 0 && (
                        <div className="bg-amber-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1 mb-1.5">
                            <Eye className="h-3.5 w-3.5" /> Monitor
                          </p>
                          <ul className="text-xs text-amber-800 space-y-0.5">
                            {latest.recommended_actions.monitor.map((a, i) => (
                              <li key={i}>• {a}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {latest.recommended_actions.escalate_or_redirect?.length > 0 && (
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-purple-700 flex items-center gap-1 mb-1.5">
                            <ArrowUpRight className="h-3.5 w-3.5" /> Escalate / Redirect
                          </p>
                          <ul className="text-xs text-purple-800 space-y-0.5">
                            {latest.recommended_actions.escalate_or_redirect.map((a, i) => (
                              <li key={i}>• {a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Post-visit: follow-up checklist */}
                  {stage === "post_visit" && latest.follow_up_checklist?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold flex items-center gap-1 mb-2">
                        <ListChecks className="h-3.5 w-3.5" /> Follow-up Checklist
                      </p>
                      <div className="space-y-1.5">
                        {latest.follow_up_checklist.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 bg-muted rounded-lg px-3 py-2">
                            <span
                              className={`text-[10px] font-semibold uppercase mt-0.5 px-1.5 py-0.5 rounded ${
                                item.priority === "high"
                                  ? "bg-red-100 text-red-700"
                                  : item.priority === "medium"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-green-100 text-green-700"
                              }`}
                            >
                              {item.priority}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs">{item.action}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                                {item.assignee.replace(/_/g, " ")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Intake/vitals: rationale only (urgency shown in banner above) */}
                  {(stage === "intake" || stage === "vitals") && !latest.red_flags?.length && (
                    <p className="text-sm text-muted-foreground">{latest.rationale}</p>
                  )}

                  {/* Vitals: also show recommended actions */}
                  {stage === "vitals" && latest.recommended_actions && (
                    <>
                      {latest.recommended_actions.immediate?.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-red-700 flex items-center gap-1 mb-1.5">
                            <Zap className="h-3.5 w-3.5" /> Immediate Actions Needed
                          </p>
                          <ul className="text-xs text-red-800 space-y-0.5">
                            {latest.recommended_actions.immediate.map((a, i) => (
                              <li key={i}>• {a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>

            <Separator />

            {/* Nurse Q&A */}
            <section>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4" />
                Ask About This Patient
              </h3>
              <div className="space-y-2">
                <Textarea
                  placeholder="Ask a clinical question about this patient..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={() => followupMutation.mutate()}
                  disabled={!question.trim() || followupMutation.isPending}
                >
                  {followupMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Ask Claude
                </Button>
              </div>

              {answer && (
                <div className="mt-3 bg-blue-50 rounded-lg p-3 text-sm">
                  <p className="font-semibold text-blue-800 text-xs mb-1">Clinical Response</p>
                  <p className="text-blue-900 whitespace-pre-wrap">{answer}</p>
                </div>
              )}
            </section>

            <div className="h-4" />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
