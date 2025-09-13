// Squelette de chargement pour la page
const PaymentPageSkeleton = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="h-12 bg-gray-200 animate-pulse rounded-md mb-8"></div>

    <section className="py-8">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-6">
          <main className="md:w-2/3">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="h-8 bg-gray-200 animate-pulse rounded-md w-1/3 mb-6"></div>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-gray-200 animate-pulse rounded-md"
                  ></div>
                ))}
              </div>
            </div>
          </main>

          <aside className="md:w-1/3">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="h-6 bg-gray-200 animate-pulse rounded-md w-1/2 mb-4"></div>

              {[...Array(2)].map((_, i) => (
                <div key={i} className="space-y-2 mb-4">
                  <div className="h-4 bg-gray-200 animate-pulse rounded-md w-1/4"></div>
                  <div className="h-10 bg-gray-200 animate-pulse rounded-md w-full"></div>
                </div>
              ))}

              <div className="space-y-3 my-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 bg-gray-200 animate-pulse rounded-md w-1/3"></div>
                    <div className="h-4 bg-gray-200 animate-pulse rounded-md w-1/4"></div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between mt-4">
                <div className="h-10 bg-gray-200 animate-pulse rounded-md w-1/4"></div>
                <div className="h-10 bg-gray-200 animate-pulse rounded-md w-1/2"></div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  </div>
);

export default PaymentPageSkeleton;
