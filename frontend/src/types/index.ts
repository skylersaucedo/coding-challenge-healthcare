export type Stage = "intake" | "vitals" | "doc_visit" | "post_visit";

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  chief_complaint: string;
  stage: Stage;
  stage_order: number;
  intake_data: Record<string, unknown> | null;
  created_at: string;
  urgency: "IMMEDIATE" | "MONITOR" | "CAN WAIT" | null;
}

export interface Vitals {
  id: string;
  patient_id: string;
  heart_rate: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  temperature: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
  recorded_at: string;
}

export interface TriageAssessment {
  urgency: "IMMEDIATE" | "MONITOR" | "CAN WAIT";
  escalate_or_redirect: "Escalate" | "Redirect" | "Standard";
  confidence: number;
  recommended_actions: {
    immediate: string[];
    monitor: string[];
    escalate_or_redirect: string[];
  };
  rationale: string;
  red_flags: string[];
  missing_fields: string[];
  follow_up_checklist: Array<{
    action: string;
    priority: string;
    assignee: string;
  }>;
}

export interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  specialty: string | null;
  department: string;
  shift: string;
  is_on_duty: boolean;
  created_at: string;
}

export interface StageMetric {
  stage: Stage;
  label: string;
  count: number;
  capacity: number;
  utilization: number;
}

export interface AuthState {
  token: string | null;
  role: string | null;
  userId: string | null;
}
