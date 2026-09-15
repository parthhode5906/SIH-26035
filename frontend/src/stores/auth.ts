/**
 * Auth store (P3-2): token pair + role-aware access, persisted locally so
 * a mid-test reload restores the session (design.md §7 rule 6).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'lab_technician' | 'approving_officer' | 'admin'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  role: Role | null
  fullName: string | null
  login: (tokens: { access_token: string; refresh_token: string; role: string; full_name: string }) => void
  tryRefresh: (base: string) => Promise<boolean>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      fullName: null,
      login: (tokens) =>
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          role: tokens.role as Role,
          fullName: tokens.full_name,
        }),
      tryRefresh: async (base) => {
        const refreshToken = get().refreshToken
        if (!refreshToken) return false
        try {
          const res = await fetch(`${base}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          })
          if (!res.ok) {
            set({ accessToken: null, refreshToken: null, role: null, fullName: null })
            return false
          }
          const pair = (await res.json()) as {
            access_token: string
            refresh_token: string
            role: string
            full_name: string
          }
          get().login(pair)
          return true
        } catch {
          return false // offline: keep local state, retry later
        }
      },
      logout: () =>
        set({ accessToken: null, refreshToken: null, role: null, fullName: null }),
    }),
    { name: 'oiml-auth' },
  ),
)
