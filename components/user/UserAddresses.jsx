import Link from 'next/link';
import { memo } from 'react';

import { isArrayEmpty } from '@/helpers/helpers';
import { MapPin } from 'lucide-react';

const UserAddresses = memo(({ addresses }) => {
  return isArrayEmpty(addresses) ? (
    <div className="w-full">
      <p className="font-bold text-xl text-center">No address found!</p>
    </div>
  ) : (
    addresses?.map((address) => (
      <Link href={`/address/${address._id}`} key={address._id}>
        <div className="mb-5 gap-4">
          <figure className="w-full flex align-center bg-gray-100 hover:bg-blue-100 p-4 rounded-md cursor-pointer">
            <div className="mr-3">
              <span className="flex items-center justify-center text-yellow-500 w-12 h-12 bg-white rounded-full shadow-sm mt-2">
                <MapPin />
              </span>
            </div>
            <figcaption className="text-gray-600">
              <p>
                {address.street} <br />
                {address.additionalInfo && (
                  <>
                    Additional Info: {address.additionalInfo}
                    <br />
                  </>
                )}
                {address.city}, {address.state}, {address.zipCode},{' '}
                {address.country}
                <br />
                Address ID: {address.addressId}
                {address.isDefault && (
                  <>
                    <br />
                    <span className="text-green-600 font-semibold">
                      Default Address
                    </span>
                  </>
                )}
              </p>
            </figcaption>
          </figure>
        </div>
      </Link>
    ))
  );
});

UserAddresses.displayName = 'UserAddresses';

export default UserAddresses;
