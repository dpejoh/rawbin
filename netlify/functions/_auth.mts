import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'

export function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function fail(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function extractToken(req: Request): string | null {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export async function verifyRequest(): Promise<{ email: string; id: string; roles: string[] } | null> {
  try {
    const user = await getUser()
    if (!user) return null
    return { email: user.email ?? '', id: user.id, roles: user.roles ?? [] }
  } catch {
    return null
  }
}

const HIERARCHY: Record<string, number> = { viewer: 0, yuri: 0, editor: 1, admin: 2 }

async function getCustomRole(email: string): Promise<string> {
  try {
    const store = getStore('user-roles')
    const raw = await store.get('index')
    if (!raw) return 'viewer'
    const roles = JSON.parse(raw) as Record<string, string>
    return roles[email] ?? 'viewer'
  } catch {
    return 'viewer'
  }
}

export async function getEffectiveRole(email: string, identityRoles: string[]): Promise<string> {
  if (identityRoles.length > 0) {
    let best = 'viewer'
    let bestLevel = 0
    for (const r of identityRoles) {
      const level = HIERARCHY[r] ?? 0
      if (level > bestLevel) {
        bestLevel = level
        best = r
      }
    }
    return best
  }
  return getCustomRole(email)
}

export async function requireRole(email: string, minRole: string, identityRoles: string[] = []): Promise<boolean> {
  const role = await getEffectiveRole(email, identityRoles)
  return (HIERARCHY[role] ?? 0) >= (HIERARCHY[minRole] ?? 0)
}
