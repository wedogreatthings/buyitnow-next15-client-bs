import { auth } from '@/app/api/auth/[...nextauth]/route';
import { getServerSession } from 'next-auth';
import { cache } from 'react';
// import { logger } from './logger';

/**
 * Get authenticated user with caching
 * This is a Data Access Layer (DAL) function
 */
export const getAuthenticatedUser = cache(async (headers) => {
  try {
    const session = await getServerSession(auth);

    if (!session || !session.user) {
      return null;
    }

    // Vérifier que l'utilisateur existe toujours en DB si nécessaire
    // const userExists = await checkUserInDatabase(session.user.id);
    // if (!userExists) return null;

    return session.user;
  } catch (error) {
    console.error('Failed to get authenticated user', { error: error.message });
    return null;
  }
});

/**
 * Verify session for API routes
 */
export const verifySession = async (req) => {
  try {
    const session = await getServerSession(auth);

    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    return { success: true, session };
  } catch (error) {
    console.error('Session verification failed', { error: error.message });
    return { success: false, error: 'Session verification failed' };
  }
};
