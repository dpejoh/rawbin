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

export async function verifyRequest(): Promise<{ email: string; id: string } | null> {
  try {
    const user = await getUser()
    if (!user) return null
    return { email: user.email ?? '', id: user.id }
  } catch {
    return null
  }
}

const HIERARCHY: Record<string, number> = { viewer: 0, editor: 1, admin: 2 }

export async function getUserRole(email: string): Promise<string> {
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

export async function requireRole(email: string, minRole: string): Promise<boolean> {
  const role = await getUserRole(email)
  return (HIERARCHY[role] ?? 0) >= (HIERARCHY[minRole] ?? 0)
}
