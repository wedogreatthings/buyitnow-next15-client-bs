export default function Head() {
  return (
    <>
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <meta
        name="description"
        content="Votre description professionnelle ici - décrivez votre site/app en 150-160 caractères"
      />
      <meta
        name="keywords"
        content="mots-clés, pertinents, pour, votre, site"
      />

      {/* SEO et Open Graph */}
      <meta property="og:title" content="Titre de votre site" />
      <meta
        property="og:description"
        content="Description pour les réseaux sociaux"
      />
      <meta property="og:type" content="website" />
      {/* <meta property="og:image" content="/og-image.jpg" /> */}

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Titre de votre site" />
      <meta name="twitter:description" content="Description pour Twitter" />

      <link rel="icon" href="/favicon.ico" />

      {/* Préchargement des ressources critiques */}
      <link rel="preconnect" href="https://res.cloudinary.com" />
    </>
  );
}
