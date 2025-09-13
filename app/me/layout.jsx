import { Suspense } from 'react';
import { redirect } from 'next/navigation';
// MODIFICATION: Import depuis un fichier lib centralisé
import { getAuthenticatedUser } from '@/lib/auth';
import { headers } from 'next/headers';

export default async function UserLayout({ children }) {
  // MODIFICATION: Utiliser une fonction DAL pour l'authentification
  let user;
  try {
    // AJOUT: Passer les headers pour maintenir le contexte de requête
    const headersList = await headers();
    user = await getAuthenticatedUser(headersList);
  } catch (error) {
    // MODIFICATION: Logger conditionnel
    console.error('Authentication error in layout', {
      error: error.message,
      route: '/me',
    });

    redirect('/error?code=auth_error');
  }

  // MODIFICATION: Vérification simplifiée car getAuthenticatedUser gère déjà la logique
  if (!user) {
    const callbackPath = encodeURIComponent('/me');
    return redirect(`/login?callbackUrl=${callbackPath}`);
  }

  // Safe access to user name
  const userName = user?.name || 'User Profile';

  return (
    <>
      {/* User profile header section */}
      <section className="flex flex-row py-3 sm:py-7 bg-blue-100 print:hidden">
        <div className="container max-w-[var(--breakpoint-xl)] mx-auto px-4">
          <h2 className="font-medium text-2xl text-slate-800">
            {userName.toUpperCase()}
          </h2>
        </div>
      </section>

      {/* Main content section */}
      <section className="py-6 md:py-10">
        <div className="container max-w-[var(--breakpoint-xl)] mx-auto px-4">
          <div className="flex justify-center items-center flex-col md:flex-row -mx-4">
            <main className="md:w-2/3 lg:w-3/4 px-4 w-full">
              <article className="border border-gray-200 bg-white shadow-sm rounded-md mb-5 p-3 lg:p-5">
                <Suspense
                  fallback={
                    <div
                      className="animate-pulse"
                      aria-busy="true"
                      aria-live="polite"
                    >
                      <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
                      <div className="h-4 bg-gray-200 rounded w-full mb-2.5" />
                      <div className="h-4 bg-gray-200 rounded w-full mb-2.5" />
                      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2.5" />
                      <span className="sr-only">Loading content...</span>
                    </div>
                  }
                >
                  {children}
                </Suspense>
              </article>
            </main>
          </div>
        </div>
      </section>
    </>
  );
}
