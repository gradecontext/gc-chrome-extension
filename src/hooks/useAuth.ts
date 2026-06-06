import { Storage } from "@plasmohq/storage"
import { useEffect, useState } from "react"
import { STORAGE_KEYS } from "~lib/constants"
import { clearAuthState, getAuthState } from "~lib/storage"
import { sendToBackground } from "~lib/messaging"
import type { AuthState } from "~types"

const localStore = new Storage({ area: "local" })

export function useAuth() {
  // undefined = still loading from storage, null = loaded but not signed in
  const [auth, setAuth] = useState<AuthState | null | undefined>(undefined)

  useEffect(() => {
    // 1. Read current value immediately
    getAuthState()
      .then((stored) => {
        console.debug("[CG:useAuth] initial storage read →", stored ? `user:${stored.user.email}` : "null")
        setAuth(stored)
      })
      .catch((err) => {
        console.error("[CG:useAuth] storage read failed", err)
        setAuth(null)
      })

    // 2. Watch for background writing new auth state (login / logout)
    const watchMap = {
      [STORAGE_KEYS.AUTH_STATE]: (change: { newValue?: AuthState }) => {
        console.debug("[CG:useAuth] storage changed →", change.newValue ? `user:${change.newValue.user?.email}` : "cleared")
        setAuth(change.newValue ?? null)
      }
    }
    localStore.watch(watchMap)

    return () => {
      localStore.unwatch(watchMap)
    }
  }, [])

  async function signOut() {
    console.debug("[CG:useAuth] signing out")
    await clearAuthState()
    setAuth(null)
    sendToBackground({ type: "SIGN_OUT" }).catch(() => {})
  }

  const loading = auth === undefined
  const isAuthenticated = !!auth
  const user = auth?.user ?? null
  const activeClientId = auth?.activeClientId ?? null
  const displayName = user?.displayName ?? user?.name ?? user?.email ?? null
  const memberships = user?.memberships.filter((m) => m.status === "ACTIVE") ?? []

  return { auth, isAuthenticated, user, displayName, activeClientId, memberships, loading, signOut }
}
