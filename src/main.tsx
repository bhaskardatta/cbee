import { createRoot } from 'react-dom/client'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
// Side-effect import: registers the camera-preview plugin with Capacitor
// at app boot so useNativeCamera() can call CameraPreview.start() without
// a registration race. Mirrors the pattern used for push notifications.
import '@capgo/camera-preview'
import App from './App.tsx'
import './index.css'
import { supabase } from './integrations/supabase/client'

// Handle OAuth callback for Capacitor mobile (iOS + Android).
// Flow: LoginPage → Browser.open(supabase google URL) → user signs in →
// Google → Supabase → redirect to `app.cbee.online://callback#access_token=…`
// → Android intent / iOS URL scheme wakes the app → this listener fires.
CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
  // Match new bundle ID (app.cbee.online) + two legacy schemes:
  //   - app.cbee.in       : transitional name we used during early Phase 2 dev
  //   - app.netlify.cbee  : Phase 1 production scheme
  // Keep all three until Phase 1 install base drains (~4 weeks post-launch).
  const isOAuthCallback =
    url.startsWith('app.cbee.online://') ||
    url.startsWith('app.cbee.in://') ||
    url.startsWith('app.netlify.cbee://')

  if (!isOAuthCallback) return

  console.log('[OAuth callback] received deep link')

  // Close the in-app browser (SFSafariViewController on iOS, Custom Tabs on Android)
  try {
    await Browser.close()
  } catch (e) {
    console.warn('[OAuth callback] Browser.close failed (likely already closed):', e)
  }

  // Some custom URL schemes confuse the URL constructor (no host). Be defensive.
  let hash = ''
  let search = ''
  try {
    const parsed = new URL(url)
    hash = parsed.hash?.startsWith('#') ? parsed.hash.slice(1) : (parsed.hash || '')
    search = parsed.search?.startsWith('?') ? parsed.search.slice(1) : (parsed.search || '')
  } catch {
    const hashIdx = url.indexOf('#')
    const queryIdx = url.indexOf('?')
    if (hashIdx >= 0) hash = url.slice(hashIdx + 1)
    if (queryIdx >= 0 && (hashIdx < 0 || queryIdx < hashIdx)) {
      search = url.slice(queryIdx + 1, hashIdx >= 0 ? hashIdx : undefined)
    }
  }

  const hashParams = new URLSearchParams(hash)
  const queryParams = new URLSearchParams(search)

  // OAuth provider errors (e.g. user denied consent) come back with ?error=...
  const oauthError = queryParams.get('error') || hashParams.get('error')
  if (oauthError) {
    const desc = queryParams.get('error_description') || hashParams.get('error_description')
    console.error('[OAuth callback] provider error:', oauthError, desc)
    return
  }

  // Retry helper — the first network call right after the deep link wakes
  // the app can fail with "Failed to fetch" because the WebView's network
  // context is still settling. Retry with backoff a few times.
  const withRetry = async <T,>(label: string, fn: () => Promise<T>, tries = 4): Promise<T> => {
    let lastErr: unknown
    for (let i = 0; i < tries; i++) {
      try {
        return await fn()
      } catch (e) {
        lastErr = e
        console.warn(`[OAuth callback] ${label} attempt ${i + 1}/${tries} failed:`, e)
        await new Promise((r) => setTimeout(r, 300 * (i + 1)))
      }
    }
    throw lastErr
  }

  // Decode a base64url-encoded JWT payload without verifying signature.
  // Used for the fallback path below — the JWT came from Supabase via the
  // OAuth deep link, so we trust it without re-verifying.
  const decodeJwtPayload = (jwt: string): Record<string, unknown> | null => {
    try {
      const part = jwt.split('.')[1]
      if (!part) return null
      const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
      const json = atob(padded)
      // JWT may contain non-ASCII (e.g. utf-8 names) — decode through UTF-8.
      const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0))
      const decoded = new TextDecoder('utf-8').decode(bytes)
      return JSON.parse(decoded)
    } catch (e) {
      console.error('[OAuth callback] JWT decode failed', e)
      return null
    }
  }

  // Manually persist the session to the Supabase storage key, then reload.
  // Used when setSession()'s network call fails — the JWT in the deep link
  // is trusted (came from Supabase via Browser.open + our redirect allowlist)
  // so we don't need a server round-trip to validate it. AuthContext picks
  // up the new session from localStorage on the next mount.
  const persistSessionLocally = (token: string, refresh: string) => {
    const claims = decodeJwtPayload(token)
    if (!claims) return false
    const projectRef = 'gjaoevysppponsawrjha' // matches VITE_SUPABASE_PROJECT_ID
    const storageKey = `sb-${projectRef}-auth-token`
    const expiresAtSec =
      Number(hashParams.get('expires_at')) ||
      (typeof claims.exp === 'number' ? (claims.exp as number) : Math.floor(Date.now() / 1000) + 3600)
    const expiresInSec =
      Number(hashParams.get('expires_in')) || Math.max(expiresAtSec - Math.floor(Date.now() / 1000), 60)
    const meta = (claims.user_metadata as Record<string, unknown>) || {}
    const appMeta = (claims.app_metadata as Record<string, unknown>) || {}
    const session = {
      access_token: token,
      refresh_token: refresh,
      token_type: 'bearer',
      expires_in: expiresInSec,
      expires_at: expiresAtSec,
      provider_token: hashParams.get('provider_token') || null,
      provider_refresh_token: hashParams.get('provider_refresh_token') || null,
      user: {
        id: claims.sub as string,
        aud: (claims.aud as string) || 'authenticated',
        role: (claims.role as string) || 'authenticated',
        email: (claims.email as string) || '',
        phone: (claims.phone as string) || '',
        app_metadata: appMeta,
        user_metadata: meta,
        identities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(session))
      console.log('[OAuth callback] session persisted locally for', session.user.email)
      return true
    } catch (e) {
      console.error('[OAuth callback] localStorage write failed', e)
      return false
    }
  }

  // 1) Implicit flow (our default — see client.ts flowType: 'implicit'):
  //    tokens arrive in the URL fragment.
  const access_token = hashParams.get('access_token')
  const refresh_token = hashParams.get('refresh_token')

  if (access_token && refresh_token) {
    console.log('[OAuth callback] implicit flow — calling setSession')
    try {
      const { data, error } = await withRetry('setSession', () =>
        supabase.auth.setSession({ access_token, refresh_token })
      )
      if (!error && data.session) {
        console.log('[OAuth callback] session set for user:', data.session.user.email)
        window.location.replace('/')
        return
      }
      console.warn(
        '[OAuth callback] setSession failed, falling back to local persist:',
        error
      )
    } catch (e) {
      console.warn('[OAuth callback] setSession threw, falling back to local persist:', e)
    }

    // Fallback: skip the network round-trip and save the session straight
    // into localStorage. AuthContext will pick it up on the next mount.
    if (persistSessionLocally(access_token, refresh_token)) {
      window.location.replace('/')
    } else {
      console.error('[OAuth callback] both setSession and local persist failed')
    }
    return
  }

  // 2) PKCE / code flow: ?code=...
  //    exchangeCodeForSession() takes the bare code, NOT the full URL.
  //    Passing the URL silently fails because the backend rejects
  //    `auth_code: "app.cbee.online://callback?code=…"`.
  const code = queryParams.get('code')
  if (code) {
    console.log('[OAuth callback] PKCE flow — exchanging code for session')
    try {
      const { data, error } = await withRetry('exchangeCodeForSession', () =>
        supabase.auth.exchangeCodeForSession(code)
      )
      if (error) {
        console.error('[OAuth callback] exchangeCodeForSession returned error:', error)
        return
      }
      if (data.session) {
        console.log('[OAuth callback] session created for user:', data.session.user.email)
        window.location.replace('/')
        return
      }
      console.error('[OAuth callback] exchange returned no session')
    } catch (e) {
      console.error('[OAuth callback] exchangeCodeForSession failed after retries:', e)
    }
    return
  }

  console.warn('[OAuth callback] deep link had neither tokens nor code:', url)
})

createRoot(document.getElementById("root")!).render(<App />);
