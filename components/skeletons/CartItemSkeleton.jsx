// Composant squelette pour le chargement des articles du panier
const CartItemSkeleton = () => {
  return (
    <div className="animate-pulse">
      <div className="flex flex-wrap lg:flex-row gap-5 mb-4">
        <div className="w-full lg:w-2/5 xl:w-2/4">
          <div className="flex">
            <div className="block w-16 h-16 rounded-sm bg-gray-200"></div>
            <div className="ml-3 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
          </div>
        </div>
        <div className="w-24">
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
        <div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-3 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
        <div className="flex-auto">
          <div className="float-right">
            <div className="h-8 bg-gray-200 rounded w-20"></div>
          </div>
        </div>
      </div>
      <hr className="my-4" />
    </div>
  );
};

export default CartItemSkeleton;
