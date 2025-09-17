'use client';

import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { CldImage, CldUploadWidget } from 'next-cloudinary';
import { toast } from 'react-toastify';
import DOMPurify from 'dompurify';

import AuthContext from '@/context/AuthContext';
// import { validateProfileWithLogging } from '@/helpers/schemas';
import { captureException } from '@/monitoring/sentry';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Composant de mise à jour de profil utilisateur sécurisé et optimisé
 *
 * @param {Object} props
 * @param {string} props.userId - ID utilisateur pour monitoring
 * @param {string} props.initialEmail - Email de l'utilisateur (pour affichage uniquement)
 * @param {string} props.referer - URL referer pour le suivi
 */
const UpdateProfile = ({ userId, initialEmail, referer }) => {
  const { user, error, loading, updateProfile, clearErrors } =
    useContext(AuthContext);

  // Références pour gestion du formulaire et focus
  const formRef = useRef(null);
  const nameInputRef = useRef(null);

  // État du formulaire avec données sanitizées
  const [formState, setFormState] = useState({
    name: '',
    phone: '',
    avatar: null,
  });

  // États UI et validation
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [formTouched, setFormTouched] = useState(false);

  // Dans le composant UpdateProfile, ajouter cette ligne après les autres hooks
  const router = useRouter();

  // Initialisation des données du formulaire avec useEffect
  useEffect(() => {
    if (user) {
      setFormState({
        name: user?.name || '',
        phone: user?.phone || '',
        avatar: user?.avatar || null,
      });
    }

    // Focus sur le premier champ au chargement
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [user]);

  // Gestion des erreurs du contexte d'authentification
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearErrors();
      setIsSubmitting(false);
    }
  }, [error, clearErrors]);

  // Fonction de sanitization d'entrée pour prévention XSS
  const sanitizeInput = useCallback((value) => {
    if (typeof value === 'string') {
      // Sanitize mais sans trim() pour permettre les espaces
      return DOMPurify.sanitize(value);
    }
    return value;
  }, []);

  // Gestionnaire de changement d'input avec sanitation
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    const sanitizedValue = sanitizeInput(value);

    setFormState((prevState) => ({
      ...prevState,
      [name]: sanitizedValue,
    }));

    // Marquer le formulaire comme modifié
    setFormTouched(true);

    // Effacer l'erreur de ce champ quand l'utilisateur tape
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, []);

  // Gestionnaire de téléchargement d'avatar réussi
  const handleUploadSuccess = useCallback((result) => {
    if (result?.info?.public_id && result?.info?.secure_url) {
      // Vérifier que l'ID est bien dans le dossier attendu
      const publicId = result.info.public_id;
      const secureUrl = result.info.secure_url;

      if (!publicId.startsWith('buyitnow/avatars/')) {
        toast.error('Erreur de téléchargement: dossier incorrect');
        setUploadInProgress(false);
        return;
      }

      if (!secureUrl.startsWith('https://')) {
        toast.error('Erreur de téléchargement: URL non sécurisée');
        setUploadInProgress(false);
        return;
      }

      setFormState((prevState) => ({
        ...prevState,
        avatar: {
          public_id: publicId,
          url: secureUrl,
        },
      }));

      setFormTouched(true);
      setUploadInProgress(false);
      toast.success('Photo de profil téléchargée avec succès');
    }
  }, []);

  // Gestionnaire d'erreur de téléchargement
  const handleUploadError = useCallback((error) => {
    console.error('Erreur de téléchargement:', error);
    setUploadInProgress(false);
    toast.error("Erreur lors du téléchargement de l'image");
  }, []);

  // Gestionnaire de début de téléchargement
  const handleUploadStart = useCallback(() => {
    setUploadInProgress(true);
  }, []);

  // Ajouter cette fonction de gestion du retour
  const handleGoBack = () => {
    router.back(); // ou router.push('/me') si vous voulez forcer le retour à /me
  };

  // Soumission du formulaire avec validation améliorée
  const submitHandler = async (e) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      // Si un téléchargement est en cours, attendre
      if (uploadInProgress) {
        toast.info("Veuillez attendre la fin du téléchargement de l'image");
        setIsSubmitting(false);
        return;
      }

      // Extraire les données du formulaire
      const { name, phone, avatar } = formState;

      // Appeler la fonction de mise à jour avec données validées
      // await updateProfile(validation.data);
      await updateProfile({ name, phone, avatar });

      // Réinitialiser l'état du formulaire
      setFormTouched(false);
      setValidationErrors({});

      // Journalisation anonymisée (uniquement en production)
      if (process.env.NODE_ENV === 'production') {
        console.info('Profile updated successfully', {
          userId: userId
            ? `${userId.substring(0, 2)}...${userId.slice(-2)}`
            : 'unknown',
          hasAvatar: !!avatar,
          referer: referer ? `${referer.substring(0, 10)}...` : 'direct',
        });
      }
    } catch (error) {
      console.error('Erreur de mise à jour du profil:', error);
      toast.error(
        error.message ||
          'Une erreur est survenue lors de la mise à jour du profil',
      );

      // Capture d'erreur pour monitoring
      if (process.env.NODE_ENV === 'production') {
        captureException(error, {
          tags: { component: 'UpdateProfile', action: 'submitHandler' },
          extra: { formTouched },
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Configuration sécurisée pour Cloudinary avec initialisation correcte
  const uploadOptions = {
    folder: 'buyitnow/avatars',
    maxFiles: 1,
    maxFileSize: 2000000, // 2MB
    resourceType: 'image',
    clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    sources: ['local', 'camera'],
    multiple: false, // S'assurer que c'est bien à false
    showUploadMoreButton: false,
    showPoweredBy: false, // Optionnel: cacher le "powered by Cloudinary"
  };

  return (
    <div className="mb-8 p-4 md:p-7 mx-auto rounded-lg bg-white shadow-lg max-w-lg">
      {/* NOUVEAU : Bouton de retour */}
      <div className="mb-4">
        <button
          type="button"
          onClick={handleGoBack}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          aria-label="Retourner à la page précédente"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </button>
      </div>

      <form
        ref={formRef}
        onSubmit={submitHandler}
        encType="multipart/form-data"
        aria-label="Formulaire de mise à jour de profil"
        noValidate
      >
        <h2 className="mb-5 text-2xl font-semibold">Modifier votre profil</h2>

        {/* Le reste du formulaire reste identique */}
        {/* Email en lecture seule */}
        {initialEmail && (
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block mb-1 font-medium text-gray-700"
            >
              Adresse email (non modifiable)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="appearance-none border border-gray-200 bg-gray-100 rounded-md py-2 px-3 w-full opacity-75 cursor-not-allowed"
              value={initialEmail}
              disabled
              readOnly
            />
            <p className="mt-1 text-xs text-gray-500">
              Pour modifier votre email, contactez le support.
            </p>
          </div>
        )}

        <div className="mb-4">
          <label
            htmlFor="name"
            className="block mb-1 font-medium text-gray-700"
          >
            Nom complet <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            ref={nameInputRef}
            type="text"
            placeholder="Votre nom complet"
            required
            className={
              validationErrors.name
                ? 'appearance-none border border-red-500 bg-red-50 rounded-md py-2 px-3 w-full focus:outline-none focus:ring-2 focus:ring-red-500'
                : 'appearance-none border border-gray-200 bg-gray-100 rounded-md py-2 px-3 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'
            }
            value={formState.name}
            onChange={handleInputChange}
            aria-invalid={!!validationErrors.name}
            aria-describedby={validationErrors.name ? 'name-error' : undefined}
            maxLength={100}
          />
          {validationErrors.name && (
            <p id="name-error" className="mt-1 text-sm text-red-600">
              {validationErrors.name}
            </p>
          )}
        </div>

        <div className="mb-4">
          <label
            htmlFor="phone"
            className="block mb-1 font-medium text-gray-700"
          >
            Numéro de téléphone <span className="text-red-500">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="Votre numéro de téléphone"
            required
            inputMode="tel"
            className={
              validationErrors.phone
                ? 'appearance-none border border-red-500 bg-red-50 rounded-md py-2 px-3 w-full focus:outline-none focus:ring-2 focus:ring-red-500'
                : 'appearance-none border border-gray-200 bg-gray-100 rounded-md py-2 px-3 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'
            }
            value={formState.phone}
            onChange={handleInputChange}
            aria-invalid={!!validationErrors.phone}
            aria-describedby={
              validationErrors.phone ? 'phone-error' : undefined
            }
            maxLength={15}
          />
          {validationErrors.phone && (
            <p id="phone-error" className="mt-1 text-sm text-red-600">
              {validationErrors.phone}
            </p>
          )}
        </div>

        <div className="mb-6">
          <label className="block mb-1 font-medium text-gray-700">
            Photo de profil
          </label>
          <div className="flex flex-col md:flex-row items-start gap-4">
            <div className="flex items-center space-x-3 cursor-default">
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200">
                {uploadInProgress ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <svg
                      className="animate-spin h-8 w-8 text-blue-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                ) : (
                  <CldImage
                    className="w-full h-full object-cover"
                    src={formState.avatar?.public_id || '/images/default.png'}
                    width={80}
                    height={80}
                    alt="Photo de profil"
                  />
                )}
              </div>
            </div>
            <div className="flex-grow">
              <CldUploadWidget
                signatureEndpoint={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me/update/sign-cloudinary-params`}
                onSuccess={handleUploadSuccess}
                onError={handleUploadError}
                onStart={handleUploadStart}
                options={uploadOptions}
                uploadPreset={undefined} // Assurez-vous que c'est undefined pour utiliser la signature
              >
                {({ open }) => {
                  // Ajout d'une vérification de sécurité pour open
                  const handleOpenClick = () => {
                    if (typeof open === 'function') {
                      open();
                    } else {
                      console.error(
                        "L'API Cloudinary n'est pas correctement initialisée",
                      );
                      toast.error(
                        "Impossible d'ouvrir le sélecteur d'image. Veuillez réessayer.",
                      );
                    }
                  };

                  return (
                    <button
                      type="button"
                      className="px-4 py-2 text-center w-full md:w-auto inline-block text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleOpenClick}
                      disabled={uploadInProgress || isSubmitting}
                    >
                      {uploadInProgress
                        ? 'Téléchargement en cours...'
                        : 'Changer ma photo de profil'}
                    </button>
                  );
                }}
              </CldUploadWidget>
              <p className="mt-2 text-xs text-gray-500">
                Formats acceptés: JPG, PNG, WEBP. Taille maximale: 2 Mo
              </p>
            </div>
          </div>
        </div>

        {validationErrors.general && (
          <div className="mb-4 p-3 bg-red-50 border border-red-400 rounded text-red-700">
            {validationErrors.general}
          </div>
        )}

        <button
          type="submit"
          className={`my-2 px-4 py-2 text-center w-full inline-block text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isSubmitting || uploadInProgress || loading
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
          }`}
          disabled={isSubmitting || uploadInProgress || loading}
        >
          {isSubmitting || loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Mise à jour en cours...
            </span>
          ) : (
            'Mettre à jour mon profil'
          )}
        </button>
      </form>
    </div>
  );
};

export default UpdateProfile;
