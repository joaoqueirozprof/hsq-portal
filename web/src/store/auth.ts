import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  document?: string;
  documentType?: string;
  email?: string;
  role: 'client' | 'admin';
  isFirstLogin?: boolean;
  mustChangePassword?: boolean;
  onboardingCompleted?: boolean;
  traccarUserId?: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  traccarEmail: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User, traccarEmail?: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      traccarEmail: null,
      isAuthenticated: false,
      login: (token, user, traccarEmail) =>
        set({
          token,
          user: { ...user, role: user.role || 'client' },
          traccarEmail: traccarEmail || null,
          isAuthenticated: true,
        }),
      logout: () =>
        set({ token: null, user: null, traccarEmail: null, isAuthenticated: false }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'hsq-auth',
      // Migrate old sessions that are missing the role field
      onRehydrate: (_state, error) => {
        if (error) return;
        return (rehydratedState) => {
          if (rehydratedState?.user && !rehydratedState.user.role) {
            // Old session without role - infer from email (admins have email, clients have document)
            const inferredRole = rehydratedState.user.email && !rehydratedState.user.document ? 'admin' : 'client';
            rehydratedState.user.role = inferredRole;
          }
        };
      },
    }
  )
);
