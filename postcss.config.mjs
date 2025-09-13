const config = {
  plugins: {
    // Plugin Tailwind CSS v4 - OBLIGATOIRE
    "@tailwindcss/postcss": {},

    // Minification CSS pour production - OPTIONNEL mais recommandé
    ...(process.env.NODE_ENV === "production" && {
      cssnano: {
        preset: [
          "default",
          {
            discardComments: {
              removeAll: true,
            },
            minifyFontValues: true,
            minifyGradients: true,
            mergeLonghand: true,
            colormin: true,
            zindex: false, // Éviter les problèmes de z-index
            reduceIdents: false, // Éviter les problèmes avec animations/keyframes
          },
        ],
      },
    }),
  },
};

export default config;
