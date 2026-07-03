/**
 * NextAuth route handler — serves /api/auth/* (signin, signout, session,
 * csrf, callback). Configuration lives in src/lib/auth.ts.
 */
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
