'use client';

import { memo, useContext, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import AuthContext from '@/context/AuthContext';
import { EllipsisVertical, Lock, Pencil, Plus } from 'lucide-react';

const AddressesSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="h-32 bg-gray-200 rounded"></div>
      <div className="h-32 bg-gray-200 rounded"></div>
    </div>
  </div>
);

// MODIFICATION: Retirer ssr: false si possible
const UserAddresses = dynamic(() => import('@/components/user/UserAddresses'), {
  loading: () => <AddressesSkeleton />,
  // MODIFICATION: Essayer sans ssr: false d'abord
  // ssr: false,
});

const Profile = ({ addresses = [] }) => {
  const { user } = useContext(AuthContext);
  const [isClient, setIsClient] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // AJOUT: Ref pour gérer les cleanup des event listeners
  const modalRef = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // MODIFICATION: Meilleure gestion des event listeners avec cleanup
  useEffect(() => {
    if (!isModalOpen) {
      // Nettoyer les listeners si le modal est fermé
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      return;
    }

    const handleClickOutside = (event) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target) &&
        !event.target.closest('.dots-button')
      ) {
        setIsModalOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    // AJOUT: Stocker la fonction de cleanup
    cleanupRef.current = () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };

    return cleanupRef.current;
  }, [isModalOpen]);

  // AJOUT: Cleanup au unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  const toggleModal = (e) => {
    e.stopPropagation();
    setIsModalOpen(!isModalOpen);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  if (!isClient || !user) {
    return <AddressesSkeleton />;
  }

  const userData = {
    name: user?.name || 'User',
    email: user?.email || 'No email provided',
    phone: user?.phone || 'No phone provided',
    avatarUrl: imageError
      ? '/images/default.png'
      : user?.avatar?.url || '/images/default.png',
  };

  return (
    <section className="profile-container">
      <figure className="flex items-start sm:items-center justify-between w-full">
        <div className="flex-shrink-0">
          <div className="relative rounded-full overflow-hidden w-16 h-16">
            <Image
              className="rounded-full object-cover"
              src={userData.avatarUrl}
              alt={`${userData.name}'s profile picture`}
              width={64}
              height={64}
              priority
              onError={() => setImageError(true)}
              // AJOUT: Optimisation de l'image
              quality={75}
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
            />
          </div>
        </div>

        <div className="flex-1 px-4">
          <figcaption className="text-xs md:text-sm text-center">
            <p className="break-words">
              <span className="font-semibold">Email: </span>
              <span className="text-gray-700">{userData.email}</span> |
              <span className="font-semibold"> Mobile: </span>
              <span className="text-gray-700">{userData.phone}</span>
            </p>
          </figcaption>
        </div>

        <div className="flex-shrink-0 relative">
          <button
            onClick={toggleModal}
            className="dots-button p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Plus d'options"
            aria-expanded={isModalOpen}
            aria-haspopup="true"
          >
            <EllipsisVertical />
          </button>

          {isModalOpen && (
            <div
              ref={modalRef}
              className="actions-modal absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
              role="menu"
              aria-orientation="vertical"
            >
              <div className="absolute -top-2 right-3 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"></div>

              <Link
                href="/address/new"
                onClick={closeModal}
                className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors"
                role="menuitem"
              >
                <Plus className="mr-3 text-green-600" />
                <span>Add Address</span>
              </Link>

              <Link
                href="/me/update"
                onClick={closeModal}
                className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-800 transition-colors"
                role="menuitem"
              >
                <Pencil className="mr-3 text-orange-600" />
                <span>Update Profile</span>
              </Link>

              <Link
                href="/me/update_password"
                onClick={closeModal}
                className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                role="menuitem"
              >
                <Lock className="mr-3 text-blue-600" />
                <span>Change Password</span>
              </Link>
            </div>
          )}
        </div>
      </figure>

      <hr className="my-4 border-gray-200" />

      {Array.isArray(addresses) && addresses.length > 0 ? (
        <UserAddresses addresses={addresses} />
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-600">No saved addresses found</p>
          <Link
            href="/address/new"
            className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Add your first address
          </Link>
        </div>
      )}
    </section>
  );
};

export default memo(Profile);
