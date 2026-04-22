import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthStore {
  token: string | null;
  role: string | null;
  userId: string | null;
  setAuth: (token: string, role: string, userId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      userId: null,
      setAuth: (token, role, userId) => set({ token, role, userId }),
      logout: () => set({ token: null, role: null, userId: null }),
    }),
    { name: "auth-storage" }
  )
);
