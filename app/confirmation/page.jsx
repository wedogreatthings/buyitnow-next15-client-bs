import dynamic from 'next/dynamic';

const Confirmation = dynamic(
  () => import('@/components/cart/Confirmation'),
  {},
);

export const metadata = {
  title: 'Buy It Now - Confirmation',
};

const ConfirmationPage = () => {
  return <Confirmation />;
};

export default ConfirmationPage;
