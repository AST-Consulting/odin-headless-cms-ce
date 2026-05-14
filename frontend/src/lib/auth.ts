import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@/lib/types';


interface AuthState {
  token: string | null;
  user: User | null;
  hasHydrated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: (selectedPropertyId?: string | null) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  selectedPropertyId: string | null;
  setContext: (roles: any[], permissions: any[]) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hasHydrated: false,
      selectedPropertyId: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null, selectedPropertyId: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setContext: (roles, permissions) => set((state) => ({
        user: state.user ? { 
          ...state.user, 
          roles, 
          permissions,
          rolesName: roles.map((r: any) => r.name).filter(Boolean),
          roleIds: roles.map((r: any) => r.id || r._id).filter(Boolean)
        } : null
      })),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export const havePermission = (user: User | null, module: string, action: string): boolean => {
  if (!user) return false;

  // SuperAdmins bypass all permission checks
  const isSuperAdmin =
    user.roles?.some(role => {
      const name = typeof role === 'string' ? role : (role.name || '');
      return name.toUpperCase() === 'SUPERADMIN';
    }) ||
    user.rolesName?.some(role => role.toUpperCase() === 'SUPERADMIN');
  if (isSuperAdmin) return true;

  if (!user.permissions || !Array.isArray(user.permissions)) return false;

  const modulePermission = user.permissions.find(p => p.module.toLowerCase() === module.toLowerCase());
  if (!modulePermission) return false;

  return modulePermission.actions.some(a => a.toLowerCase() === action.toLowerCase());
};
