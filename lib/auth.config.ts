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
      return user.email === process.env.ALLOWED_EMAIL
    },
    jwt: async ({ token, user }) => {
      if (user) token.id = user.id
      return token
    },
    session: async ({ session, token }) => {
      if (token?.id && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}
