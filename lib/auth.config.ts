import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  providers: [],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    verifyRequest: '/login?verify=1',
  },
  callbacks: {
    authorized: ({ auth, request: { nextUrl } }) => {
      const isLoggedIn = !!auth?.user
      const isLoginPage = nextUrl.pathname.startsWith('/login')
      if (isLoginPage) return true
      return isLoggedIn
    },
    signIn: async ({ user }) => {
      console.log('ALLOWED_EMAIL env:', process.env.ALLOWED_EMAIL)
      console.log('User email attempting login:', user.email)
      const userEmail = user.email?.toLowerCase().trim() ?? ''
      const allowedEmail = process.env.ALLOWED_EMAIL?.toLowerCase().trim() ?? ''
      console.log('Match:', userEmail === allowedEmail)
      const allowed = !!userEmail && userEmail === allowedEmail
      if (!allowed) console.error('[Auth] sign-in rejected for email:', user.email)
      return allowed
    },
    jwt: async ({ token, user }) => {
      try {
        if (user) token.id = user.id
        return token
      } catch (err) {
        console.error('[Auth] jwt callback error:', err)
        return token
      }
    },
    session: async ({ session, token }) => {
      try {
        if (token?.id && session.user) {
          session.user.id = token.id as string
        }
        return session
      } catch (err) {
        console.error('[Auth] session callback error:', err)
        return session
      }
    },
  },
}
