import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import Login from "./pages/Login";
import NurseDashboard from "./pages/NurseDashboard";
import PatientIntake from "./pages/PatientIntake";
import AdminDashboard from "./pages/AdminDashboard";

function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { token, role } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && role && !roles.includes(role))
    return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleRedirect() {
  const { role } = useAuthStore();
  if (role === "nurse") return <Navigate to="/nurse" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "patient") return <Navigate to="/intake" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RoleRedirect />} />
      <Route
        path="/nurse"
        element={
          <RequireAuth roles={["nurse", "admin"]}>
            <NurseDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth roles={["admin"]}>
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/intake"
        element={
          <RequireAuth roles={["patient", "nurse", "admin"]}>
            <PatientIntake />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
