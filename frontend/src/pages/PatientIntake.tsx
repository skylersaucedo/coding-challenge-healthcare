import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { Patient } from "@/types";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, ChevronRight, ChevronLeft } from "lucide-react";

const STEPS = [
  "Personal Info",
  "Medical History",
  "Allergies & Medications",
  "Next of Kin",
  "Insurance",
  "Consent",
];

interface FormData {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  chief_complaint: string;
  medical_history: string;
  allergies: string;
  current_medications: string;
  nok_name: string;
  nok_phone: string;
  nok_relation: string;
  ins_provider: string;
  ins_member_id: string;
  ins_group: string;
  consent_signed: boolean;
}

const INIT: FormData = {
  first_name: "", last_name: "", date_of_birth: "", gender: "", chief_complaint: "",
  medical_history: "", allergies: "", current_medications: "",
  nok_name: "", nok_phone: "", nok_relation: "",
  ins_provider: "", ins_member_id: "", ins_group: "",
  consent_signed: false,
};

export default function PatientIntake() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INIT);
  const [submitted, setSubmitted] = useState(false);

  const set = (field: keyof FormData, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const submitMutation = useMutation({
    mutationFn: () => {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        date_of_birth: form.date_of_birth,
        gender: form.gender,
        chief_complaint: form.chief_complaint,
        medical_history: form.medical_history.split("\n").filter(Boolean),
        allergies: form.allergies.split("\n").filter(Boolean),
        current_medications: form.current_medications.split("\n").filter(Boolean),
        next_of_kin: { name: form.nok_name, phone: form.nok_phone, relation: form.nok_relation },
        insurance: { provider: form.ins_provider, member_id: form.ins_member_id, group: form.ins_group },
        consent_signed: form.consent_signed,
      };
      return apiFetch<Patient>("/patients", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => setSubmitted(true),
  });

  if (submitted) {
    return (
      <div className="flex flex-col h-screen">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Intake Complete</h2>
            <p className="text-muted-foreground">Your information has been submitted. Please wait for a nurse.</p>
            <Button onClick={() => navigate("/")}>Return to Home</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Navbar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-1 flex-1">
                <div
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    i <= step ? "bg-primary" : "bg-muted"
                  }`}
                />
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>

          <Card>
            <CardHeader>
              <CardTitle>{STEPS[step]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 0 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>First Name</Label>
                      <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last Name</Label>
                      <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date of Birth</Label>
                    <Input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gender</Label>
                    <Input value={form.gender} onChange={(e) => set("gender", e.target.value)} placeholder="Male / Female / Non-binary / ..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Chief Complaint</Label>
                    <Textarea
                      value={form.chief_complaint}
                      onChange={(e) => set("chief_complaint", e.target.value)}
                      placeholder="Describe your main symptom or reason for visit..."
                      rows={3}
                    />
                  </div>
                </>
              )}

              {step === 1 && (
                <div className="space-y-1.5">
                  <Label>Medical History</Label>
                  <p className="text-xs text-muted-foreground">List each condition on a new line</p>
                  <Textarea
                    value={form.medical_history}
                    onChange={(e) => set("medical_history", e.target.value)}
                    placeholder={"Hypertension\nDiabetes Type 2\nAsthma"}
                    rows={6}
                  />
                </div>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-1.5">
                    <Label>Allergies</Label>
                    <p className="text-xs text-muted-foreground">One per line (include reaction type if known)</p>
                    <Textarea
                      value={form.allergies}
                      onChange={(e) => set("allergies", e.target.value)}
                      placeholder={"Penicillin - rash\nSulfa - anaphylaxis"}
                      rows={4}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Current Medications</Label>
                    <p className="text-xs text-muted-foreground">Include dosage if known</p>
                    <Textarea
                      value={form.current_medications}
                      onChange={(e) => set("current_medications", e.target.value)}
                      placeholder={"Metformin 1000mg twice daily\nLisinopril 10mg daily"}
                      rows={4}
                    />
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input value={form.nok_name} onChange={(e) => set("nok_name", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone Number</Label>
                    <Input type="tel" value={form.nok_phone} onChange={(e) => set("nok_phone", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Relationship</Label>
                    <Input value={form.nok_relation} onChange={(e) => set("nok_relation", e.target.value)} placeholder="Spouse / Parent / Sibling / ..." />
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <div className="space-y-1.5">
                    <Label>Insurance Provider</Label>
                    <Input value={form.ins_provider} onChange={(e) => set("ins_provider", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Member ID</Label>
                    <Input value={form.ins_member_id} onChange={(e) => set("ins_member_id", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Group Number</Label>
                    <Input value={form.ins_group} onChange={(e) => set("ins_group", e.target.value)} />
                  </div>
                </>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
                    <p className="font-semibold">Patient Consent and Authorization</p>
                    <p className="text-muted-foreground">
                      I authorize the healthcare providers at this facility to provide necessary medical treatment. I consent to the collection and use of my personal health information for treatment purposes. I understand that my information may be shared with other treating providers involved in my care.
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.consent_signed}
                      onChange={(e) => set("consent_signed", e.target.checked)}
                    />
                    <span className="text-sm">I have read and agree to the above consent</span>
                  </label>

                  {submitMutation.isError && (
                    <p className="text-sm text-destructive">
                      Submission failed: {submitMutation.error?.message}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={!form.consent_signed || submitMutation.isPending}
              >
                {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Submit Intake
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
