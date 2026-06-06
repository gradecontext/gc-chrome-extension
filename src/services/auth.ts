import { TOKEN_REFRESH_BUFFER_SECS } from "~lib/constants"
import { clearAuthState, getAuthState, getSettings, saveAuthState } from "~lib/storage"
import type { AuthState, MembershipInfo, SupabaseRawSession, UserProfile } from "~types"

// Shape returned by /api/v1/users/me
interface MeResponse {
  success: boolean
  data: {
    id: number
    supabase_auth_id: string
    email: string
    name: string | null
    display_name: string | null
    memberships: Array<{
      id: number
      client_id: number
      role: string
      status: string
      client: {
        id: number
        name: string
        slug: string
        domain: string | null
        logo: string | null
        plan: string
        active: boolean
      }
    }>
  }
}

function mapMeResponse(data: MeResponse["data"]): UserProfile {
  return {
    id: data.id,
    supabaseAuthId: data.supabase_auth_id,
    email: data.email,
    name: data.name,
    displayName: data.display_name,
    memberships: data.memberships.map(
      (m): MembershipInfo => ({
        id: m.id,
        clientId: m.client_id,
        role: m.role,
        status: m.status,
        client: {
          id: m.client.id,
          name: m.client.name,
          slug: m.client.slug,
          plan: m.client.plan
        }
      })
    )
  }
}

// Validate a raw Supabase session by calling /api/v1/users/me
// Returns the stored AuthState on success, null on failure.
export async function validateAndStoreSession(
  session: SupabaseRawSession
): Promise<AuthState | null> {
  const settings = await getSettings()

  let res: Response
  try {
    res = await fetch(`${settings.apiUrl}/v1/users/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
  } catch {
    return null // network error
  }

  if (!res.ok) return null

  const json: MeResponse = await res.json()
  if (!json.success) return null

  const user = mapMeResponse(json.data)

  // Prefer the first ACTIVE membership; fall back to first membership
  const active =
    user.memberships.find((m) => m.status === "ACTIVE") ?? user.memberships[0]

  if (!active) return null

  const authState: AuthState = {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    user,
    activeClientId: active.clientId
  }

  await saveAuthState(authState)
  return authState
}

// Return a valid token or null. Clears auth if expired with no refresh path.
export async function getValidToken(): Promise<string | null> {
  const auth = await getAuthState()
  if (!auth) return null

  const nowSecs = Math.floor(Date.now() / 1000)

  // Token is still valid
  if (auth.expiresAt - nowSecs > TOKEN_REFRESH_BUFFER_SECS) {
    return auth.accessToken
  }

  // Token is expired/close — clear so the user gets a re-auth prompt
  await clearAuthState()
  return null
}

export async function signOut(): Promise<void> {
  await clearAuthState()
}

export { getAuthState }
