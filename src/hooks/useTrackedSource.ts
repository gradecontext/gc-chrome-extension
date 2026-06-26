import { useEffect, useState } from "react"
import { SOURCES_CACHE_TTL_MS } from "~lib/constants"
import { getCachedSources, setCachedSources } from "~lib/storage"
import { listSubjectCompanies } from "~services/api"
import { getAuthState } from "~services/auth"
import type { SubjectCompanySource } from "~types"

// Find an active registered source whose domain matches the given hostname
// (exact match or subdomain, e.g. "app.hubspot.com" matches domain "hubspot.com")
export function matchSource(
  hostname: string,
  sources: SubjectCompanySource[]
): SubjectCompanySource | null {
  const host = hostname.replace(/^www\./, "").toLowerCase()
  return (
    sources.find(
      (s) => s.active && (host === s.domain || host.endsWith(`.${s.domain}`))
    ) ?? null
  )
}

// Cached fetch of the client's tracked sources — avoids hitting the API on
// every single page load across every content script.
export async function getTrackedSources(clientId: number): Promise<SubjectCompanySource[]> {
  const cached = await getCachedSources()
  if (cached && Date.now() - cached.fetchedAt < SOURCES_CACHE_TTL_MS) {
    return cached.sources
  }

  const sources = await listSubjectCompanies(clientId)
  await setCachedSources(sources)
  return sources
}

// React hook: resolves the tracked source (if any) matching the given URL.
// Used by content scripts to decide whether to show the floating icon.
export function useTrackedSource(url: string) {
  const [source, setSource] = useState<SubjectCompanySource | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      const auth = await getAuthState()
      if (!auth) {
        if (!cancelled) {
          setSource(null)
          setLoading(false)
        }
        return
      }

      try {
        const sources = await getTrackedSources(auth.activeClientId)
        const hostname = new URL(url).hostname
        const matched = matchSource(hostname, sources)
        if (!cancelled) setSource(matched)
      } catch {
        if (!cancelled) setSource(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [url])

  return { source, loading }
}
