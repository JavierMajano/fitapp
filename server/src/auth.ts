import { ExpressAuth } from '@auth/express';
import type { ExpressAuthConfig } from '@auth/express';
import Apple from '@auth/express/providers/apple';
import Credentials from '@auth/express/providers/credentials';
import Google from '@auth/express/providers/google';
import type { JWT } from '@auth/core/jwt';
import type { Session, User } from '@auth/core/types';
import bcrypt from 'bcryptjs';

import { db } from './db';
import { env } from './env';
import { signInSchema } from './schemas';

export const authConfig: ExpressAuthConfig = {
  secret: env.JWT_SECRET,
  trustHost: true,
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    Apple({
      clientId: env.APPLE_ID ?? '',
      clientSecret: env.APPLE_SECRET ?? '',
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: Record<string, unknown> | undefined) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }: { token: JWT; user?: User }) {
      if (user?.id) token['id'] = user.id;
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (token['id'] && session.user) session.user.id = token['id'] as string;
      return session;
    },
  },
};

export const authHandler = ExpressAuth(authConfig);
