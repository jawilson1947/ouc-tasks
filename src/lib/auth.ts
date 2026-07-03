/**
 * Auth.js / NextAuth configuration — replaces Supabase Auth.
 *
 * Strategy: Credentials provider (email + password against
 * user_profile.password_hash) with stateless JWT sessions. The JWT carries
 * the user's id and role so authorization checks never need a DB round-trip.
 *
 * IMPORTANT — access control: Supabase enforced row-level security in the
 * database. MySQL has no RLS, so every server action and API route MUST
 * check the session role via these helpers before touching Prisma.
 *
 * Role changes take effect on next sign-in (the role is baked into the JWT).
 * If an account is deactivated, the JWT callback re-checks `active` at most
 * every 10 minutes and kills the session.
 */
import type { NextAuthOptions, Session } from 'next-auth'
import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import type { AppRole } from '@/lib/permissions'

const REVALIDATE_ACTIVE_MS = 10 * 60 * 1000

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days ("Keep me signed in")
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password
        if (!email || !password) return null

        const user = await prisma.userProfile.findUnique({ where: { email } })
        if (!user || !user.active || !user.passwordHash) return null

        const valid = await compare(password, user.passwordHash)
        if (!valid) return null

        await prisma.userProfile.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role as AppRole,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in
        token.uid = (user as { id: string }).id
        token.role = (user as { role: AppRole }).role
        token.checkedAt = Date.now()
        return token
      }
      // Periodically confirm the account is still active and refresh the role
      const checkedAt = (token.checkedAt as number | undefined) ?? 0
      if (Date.now() - checkedAt > REVALIDATE_ACTIVE_MS && token.uid) {
        const u = await prisma.userProfile.findUnique({
          where: { id: token.uid as string },
          select: { active: true, role: true },
        })
        if (!u || !u.active) return { ...token, uid: null, role: null }
        token.role = u.role as AppRole
        token.checkedAt = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      if (!token.uid) {
        // Deactivated account — expire the session immediately
        return { ...session, user: undefined, expires: new Date(0).toISOString() } as unknown as Session
      }
      if (session.user) {
        session.user.id = token.uid as string
        session.user.role = token.role as AppRole
      }
      return session
    },
  },
}

// ---------------------------------------------------------------------------
// Server-side helpers (Server Components, Server Actions, Route Handlers)
// ---------------------------------------------------------------------------

/** Current session, or null. Drop-in replacement for supabase.auth.getUser(). */
export function auth() {
  return getServerSession(authOptions)
}

export type SessionUser = { id: string; email: string; name: string; role: AppRole }

/** Current signed-in user (id, email, name, role) or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  const u = session?.user
  if (!u?.id) return null
  return { id: u.id, email: u.email ?? '', name: u.name ?? '', role: u.role }
}

/**
 * Require a signed-in user with one of the given roles; throws otherwise.
 * Use at the top of every mutating server action / API route — this is the
 * application-layer replacement for the old RLS policies.
 */
export async function requireRole(...roles: AppRole[]): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('Not authenticated')
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw new Error('Not authorized')
  }
  return user
}
