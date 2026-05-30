import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Resend from 'next-auth/providers/resend'
import { db } from '@/lib/db'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db as Parameters<typeof PrismaAdapter>[0]),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    verifyRequest: '/login?verify=1',
  },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? 'noreply@yourdomain.com',
    }),
  ],
  callbacks: {
    signIn: async ({ user }) => {
      const userEmail = user.email?.toLowerCase().trim() ?? ''
      const allowedEmail = process.env.ALLOWED_EMAIL?.toLowerCase().trim() ?? ''
      const allowed = !!userEmail && userEmail === allowedEmail
      if (!allowed) console.error('[Auth] sign-in rejected for email:', user.email)
      return allowed
    },
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
  logger: {
    error: (error) => { console.error('[NextAuth error]', error) },
    warn: (code) => { console.warn('[NextAuth warn]', code) },
  },
})
