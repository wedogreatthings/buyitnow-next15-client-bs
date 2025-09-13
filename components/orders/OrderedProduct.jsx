import Image from 'next/image';

const OrderedProduct = ({ item }) => {
  return (
    <figure className="flex flex-row mb-4">
      <div>
        <div className="block w-20 h-20 rounded-sm border border-gray-200 overflow-hidden p-3">
          <Image
            src={item?.image ? item?.image : '/images/default_product.png'}
            alt={item.name}
            title="Product Image"
            width={20}
            height={20}
          />
        </div>
      </div>
      <figcaption className="ml-3">
        <p>{item.name.substring(0, 35)}</p>
        <p className="mt-1 font-semibold">
          {item.quantity}x = ${item.price * item.quantity}
        </p>
      </figcaption>
    </figure>
  );
};

export default OrderedProduct;
