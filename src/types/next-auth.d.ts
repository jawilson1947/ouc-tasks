import type { DefaultSession } from 'next-auth'
import type { AppRole } from '@/lib/permissions'

declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      id: string
      role: AppRole
    }
  }
  interface User {
    id: string
    role: AppRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string | null
    role?: AppRole | null
    checkedAt?: number
  }
}
