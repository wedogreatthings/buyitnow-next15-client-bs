'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastContainer } from 'react-toastify';

import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { OrderProvider } from '@/context/OrderContext';

import 'react-toastify/dist/ReactToastify.css';

export function GlobalProvider({ children }) {
  return (
    <>
      <ToastContainer position="bottom-right" />
      <AuthProvider>
        <CartProvider>
          <OrderProvider>
            <SessionProvider>{children}</SessionProvider>
          </OrderProvider>
        </CartProvider>
      </AuthProvider>
    </>
  );
}
