'use client';

import { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { countries } from 'countries-list';
import { toast } from 'react-toastify';
import DOMPurify from 'dompurify';

import AuthContext from '@/context/AuthContext';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
// import { addressSchema } from '@/helpers/schemas';

/**
 * NewAddress component for managing address entry
 * Enhanced with validation, security, and performance optimizations
 *
 * @param {Object} props
 * @param {string} props.userId - User ID for monitoring and logging
 * @param {string} props.referer - Referer URL for navigation tracking
 */
const NewAddress = ({ userId, referer }) => {
  // Get auth context functions with error handling
  const { error, addNewAddress, clearErrors } = useContext(AuthContext);

  // Reference to form for focus management and reset
  const formRef = useRef(null);
  const streetInputRef = useRef(null);

  // Format and sort countries list for dropdown (memoized)
  const countriesList = useCallback(() => {
    return Object.values(countries).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, []);

  // Form state with sanitized inputs
  const [formState, setFormState] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: '',
    additionalInfo: '',
    country: '',
    isDefault: false,
  });

  // Form validation state
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formTouched, setFormTouched] = useState(false);

  // Dans le composant NewAddress, ajouter cette ligne après les autres hooks
  const router = useRouter();

  // Focus first field on component mount
  useEffect(() => {
    if (streetInputRef.current) {
      streetInputRef.current.focus();
    }
  }, []);

  // Handle auth context errors
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearErrors();
    }
  }, [error, clearErrors]);

  // Sanitize input to prevent XSS attacks
  const sanitizeInput = useCallback((value) => {
    if (typeof value === 'string') {
      return DOMPurify.sanitize(value);
    }
    return value;
  }, []);

  // Handle input change with sanitization
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const inputValue = type === 'checkbox' ? checked : sanitizeInput(value);

    setFormState((prevState) => ({
      ...prevState,
      [name]: inputValue,
    }));

    // Mark form as touched on any change
    setFormTouched(true);

    // Clear validation error for this field when user types
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  }, []);

  // Ajouter cette fonction de gestion du retour
  const handleGoBack = () => {
    router.back(); // ou router.push('/me') si vous voulez forcer le retour à /me
  };

  // Submit handler with validation
  const submitHandler = async (e) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      // Additional custom validations
      if (formState.zipCode && !/^\d{2,5}$/.test(formState.zipCode)) {
        setValidationErrors((prev) => ({
          ...prev,
          zipCode: 'Le code postal doit contenir entre 2 et 5 chiffres',
        }));
        toast.error('Format de code postal invalide');
        setIsSubmitting(false);
        return;
      }

      // All validations passed, proceed with submission
      await addNewAddress(formState);

      // Clear form after successful submission
      setFormState({
        street: '',
        city: '',
        state: '',
        zipCode: '',
        additionalInfo: '',
        country: '',
        isDefault: false,
      });

      setFormTouched(false);

      // Success feedback
      toast.success('Adresse ajoutée avec succès');

      // Log success anonymously (for monitoring)
      if (process.env.NODE_ENV === 'production') {
        console.info('Address added', {
          userId: userId
            ? `${userId.substring(0, 2)}...${userId.slice(-2)}`
            : 'unknown',
          referer: referer ? `${referer.substring(0, 10)}...` : 'direct',
        });
      }
    } catch (error) {
      toast.error(
        error.message || "Une erreur est survenue lors de l'ajout de l'adresse",
      );
      console.error('Address submission error', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get error class based on validation state
  const getInputClassName = (fieldName) => {
    const baseClass =
      'appearance-none border rounded-md py-2 px-3 w-full transition-colors duration-200';

    if (validationErrors[fieldName]) {
      return `${baseClass} border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500`;
    }

    return `${baseClass} border-gray-200 bg-gray-100 hover:border-gray-400 focus:outline-hidden focus:border-blue-500 focus:ring-blue-500`;
  };

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row">
          <main className="md:w-2/3 lg:w-3/4 px-4 mx-auto w-full">
            <div
              className="mt-1 mb-8 p-4 md:p-7 mx-auto rounded-lg bg-white shadow-lg"
              style={{ maxWidth: '480px' }}
            >
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
                noValidate
                aria-label="Formulaire d'ajout d'adresse"
              >
                <h2 className="mb-5 text-2xl font-semibold">
                  Ajouter une nouvelle adresse
                </h2>

                <div className="mb-4">
                  <label htmlFor="street" className="block mb-1 font-medium">
                    Rue / Voie <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="street"
                    name="street"
                    ref={streetInputRef}
                    required
                    className={getInputClassName('street')}
                    type="text"
                    placeholder="Saisissez votre adresse"
                    value={formState.street}
                    onChange={handleInputChange}
                    aria-invalid={!!validationErrors.street}
                    aria-describedby={
                      validationErrors.street ? 'street-error' : undefined
                    }
                    maxLength={100}
                  />
                  {validationErrors.street && (
                    <p id="street-error" className="mt-1 text-sm text-red-600">
                      {validationErrors.street}
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="additionalInfo"
                    className="block mb-1 font-medium"
                  >
                    Complément d&apos;adresse
                  </label>
                  <input
                    id="additionalInfo"
                    name="additionalInfo"
                    className={getInputClassName('additionalInfo')}
                    type="text"
                    placeholder="Appartement, bâtiment, étage, etc."
                    value={formState.additionalInfo}
                    onChange={handleInputChange}
                    aria-invalid={!!validationErrors.additionalInfo}
                    aria-describedby={
                      validationErrors.additionalInfo
                        ? 'additionalInfo-error'
                        : undefined
                    }
                    maxLength={100}
                  />
                  {validationErrors.additionalInfo && (
                    <p
                      id="additionalInfo-error"
                      className="mt-1 text-sm text-red-600"
                    >
                      {validationErrors.additionalInfo}
                    </p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-x-3">
                  <div className="mb-4">
                    <label htmlFor="city" className="block mb-1 font-medium">
                      Ville <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="city"
                      name="city"
                      required
                      className={getInputClassName('city')}
                      type="text"
                      placeholder="Saisissez votre ville"
                      value={formState.city}
                      onChange={handleInputChange}
                      aria-invalid={!!validationErrors.city}
                      aria-describedby={
                        validationErrors.city ? 'city-error' : undefined
                      }
                      maxLength={50}
                    />
                    {validationErrors.city && (
                      <p id="city-error" className="mt-1 text-sm text-red-600">
                        {validationErrors.city}
                      </p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label htmlFor="state" className="block mb-1 font-medium">
                      Région / Département{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="state"
                      name="state"
                      required
                      className={getInputClassName('state')}
                      type="text"
                      placeholder="Saisissez votre région"
                      value={formState.state}
                      onChange={handleInputChange}
                      aria-invalid={!!validationErrors.state}
                      aria-describedby={
                        validationErrors.state ? 'state-error' : undefined
                      }
                      maxLength={50}
                    />
                    {validationErrors.state && (
                      <p id="state-error" className="mt-1 text-sm text-red-600">
                        {validationErrors.state}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-x-3">
                  <div className="mb-4">
                    <label htmlFor="zipCode" className="block mb-1 font-medium">
                      Code postal
                    </label>
                    <input
                      id="zipCode"
                      name="zipCode"
                      className={getInputClassName('zipCode')}
                      type="text"
                      inputMode="numeric"
                      pattern="\d{2,5}"
                      placeholder="Code postal (2 à 5 chiffres)"
                      value={formState.zipCode}
                      onChange={handleInputChange}
                      aria-invalid={!!validationErrors.zipCode}
                      aria-describedby={
                        validationErrors.zipCode ? 'zipCode-error' : undefined
                      }
                      maxLength={5}
                    />
                    {validationErrors.zipCode && (
                      <p
                        id="zipCode-error"
                        className="mt-1 text-sm text-red-600"
                      >
                        {validationErrors.zipCode}
                      </p>
                    )}
                  </div>

                  <div className="mb-4 flex items-center">
                    <div className="flex items-center h-full mt-6">
                      <input
                        id="isDefault"
                        name="isDefault"
                        className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        type="checkbox"
                        checked={formState.isDefault}
                        onChange={handleInputChange}
                        aria-describedby="isDefault-description"
                      />
                      <label
                        htmlFor="isDefault"
                        className="ml-2 block text-sm font-medium text-gray-700"
                      >
                        Adresse par défaut
                      </label>
                    </div>
                    <p
                      id="isDefault-description"
                      className="text-xs text-gray-500 ml-2"
                    >
                      Utiliser comme adresse principale
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="country" className="block mb-1 font-medium">
                    Pays <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="country"
                    name="country"
                    required
                    className={getInputClassName('country')}
                    value={formState.country}
                    onChange={handleInputChange}
                    aria-invalid={!!validationErrors.country}
                    aria-describedby={
                      validationErrors.country ? 'country-error' : undefined
                    }
                  >
                    <option value="">Sélectionnez un pays</option>
                    {countriesList().map((country) => (
                      <option key={country.name} value={country.name}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  {validationErrors.country && (
                    <p id="country-error" className="mt-1 text-sm text-red-600">
                      {validationErrors.country}
                    </p>
                  )}
                </div>

                {validationErrors.general && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-400 rounded text-red-700">
                    {validationErrors.general}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (formTouched && Object.keys(validationErrors).length > 0)
                  }
                  className={`my-2 px-4 py-2 text-center w-full inline-block text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    isSubmitting ||
                    (formTouched && Object.keys(validationErrors).length > 0)
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <LoaderCircle className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                      Traitement en cours...
                    </span>
                  ) : (
                    'Ajouter cette adresse'
                  )}
                </button>
              </form>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
};

export default NewAddress;
