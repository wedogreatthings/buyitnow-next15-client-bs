import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white py-6 mt-auto">
      <div className="container max-w-[1440px] mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-4">Buy It Now</h3>
            <p className="text-gray-300 text-sm">
              Votre destination pour le shopping en ligne de qualité. Découvrez
              notre vaste sélection de produits à des prix compétitifs.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4">Liens utiles</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Accueil
                </Link>
              </li>
              <li>
                <Link
                  href="/me"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Mon compte
                </Link>
              </li>
              <li>
                <Link
                  href="/cart"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Panier
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4">Nous contacter</h3>
            <address className="text-gray-300 text-sm not-italic">
              <p>Email: contact@buyitnow.com</p>
              <p>Téléphone: +33 1 23 45 67 89</p>
            </address>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-6 text-center text-sm text-gray-400">
          <p>© {new Date().getFullYear()} Buy It Now. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
