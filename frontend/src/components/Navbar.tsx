import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Users, LayoutDashboard } from "lucide-react";

function Logo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="#1e3a8a" />
      <rect x="14" y="6" width="4" height="20" rx="1.5" fill="white" />
      <rect x="6" y="14" width="20" height="4" rx="1.5" fill="white" />
      <path
        d="M6 16 L10 16 L12 11 L15 21 L17 16 L20 16 L26 16"
        stroke="#f87171"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Navbar() {
  const { role, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="border-b bg-white px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2">
        <Logo className="h-8 w-8" />
        <span className="font-semibold text-lg">ED Triage Support</span>
      </div>

      <nav className="flex items-center gap-2">
        {(role === "nurse" || role === "admin") && (
          <Button variant="ghost" size="sm" onClick={() => navigate("/nurse")}>
            <LayoutDashboard className="h-4 w-4 mr-1" />
            Board
          </Button>
        )}
        {role === "admin" && (
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <Users className="h-4 w-4 mr-1" />
            Admin
          </Button>
        )}
        {(role === "patient" || role === "nurse" || role === "admin") && (
          <Button variant="ghost" size="sm" onClick={() => navigate("/intake")}>
            New Intake
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-1" />
          Logout
        </Button>
      </nav>
    </header>
  );
}
