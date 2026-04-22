import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { apiFetch } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Loader2 } from "lucide-react";

interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  user_id: string;
}

const DEMO_ACCOUNTS = [
  { label: "Nurse", email: "nurse@hospital.com", password: "nurse123" },
  { label: "Admin", email: "admin@hospital.com", password: "admin123" },
  { label: "Patient", email: "patient@hospital.com", password: "patient123" },
];

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e?: React.FormEvent, prefill?: { email: string; password: string }) => {
    e?.preventDefault();
    setError("");
    setLoading(true);
    const creds = prefill ?? { email, password };
    try {
      const res = await apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(creds),
      });
      setAuth(res.access_token, res.role, res.user_id);
      if (res.role === "nurse") navigate("/nurse");
      else if (res.role === "admin") navigate("/admin");
      else navigate("/intake");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center gap-2 mb-2">
            <Activity className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">ED Triage Support</h1>
          </div>
          <p className="text-muted-foreground text-sm">Emergency Department Management System</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Demo Accounts</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acct) => (
              <Button
                key={acct.label}
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail(acct.email);
                  setPassword(acct.password);
                  submit(undefined, acct);
                }}
                disabled={loading}
              >
                {acct.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
