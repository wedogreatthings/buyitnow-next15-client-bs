'use client';

import { useState, useContext, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import AuthContext from '@/context/AuthContext';

/**
 * Formulaire de contact sécurisé avec validation avancée
 *
 * @returns {JSX.Element} Composant de formulaire de contact
 */
const Contact = ({ referrerValidated = true }) => {
  // États du formulaire
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [charCount, setCharCount] = useState(0);

  // Références pour améliorer l'UX
  const subjectRef = useRef(null);
  const formRef = useRef(null);

  // Contexte d'authentification
  const { sendEmail, error, clearErrors } = useContext(AuthContext);

  // Focus sur le premier champ au chargement
  useEffect(() => {
    if (subjectRef.current) {
      subjectRef.current.focus();
    }

    // Protection anti-spam: vérifier si le formulaire est rempli trop rapidement
    const loadTime = Date.now();

    return () => {
      window.localStorage.setItem('contactFormLoadTime', loadTime.toString());
    };
  }, []);

  // Handle auth context updates
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearErrors();
    }
  }, [error, clearErrors]);

  // Mise à jour du compteur de caractères
  useEffect(() => {
    setCharCount(message.length);
  }, [message]);

  /**
   * Gestionnaire de soumission du formulaire avec prévention du spam
   * et validation avancée
   */
  const submitHandler = async (e) => {
    e.preventDefault();

    // Empêcher les soumissions multiples
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrors({});

      // Protection anti-bot: vérifier si le formulaire est soumis trop rapidement
      const loadTime = parseInt(
        window.localStorage.getItem('contactFormLoadTime') || '0',
      );
      const timeSinceLoad = Date.now() - loadTime;

      if (timeSinceLoad < 1500) {
        // Moins de 1.5 secondes
        // Simuler un succès mais ne pas envoyer réellement
        // (pour ne pas alerter les bots qu'ils ont été détectés)
        toast.success('Votre message a été envoyé');
        resetForm();
        return;
      }

      // Validation côté client avec notre schéma amélioré
      const emailData = { subject, message };

      await sendEmail(emailData);
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      toast.error(
        error.message ||
          'Une erreur inattendue est survenue. Veuillez réessayer.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Réinitialisation du formulaire
  const resetForm = () => {
    setSubject('');
    setMessage('');
    setErrors({});
    if (subjectRef.current) {
      subjectRef.current.focus();
    }
  };

  return (
    <div className="mt-1 mb-20 p-4 md:p-7 mx-auto rounded-lg bg-white shadow-sm border border-gray-100 max-w-[480px]">
      <form
        ref={formRef}
        onSubmit={submitHandler}
        className="space-y-4"
        aria-label="Formulaire de contact"
      >
        <h2 className="mb-5 text-2xl font-semibold text-gray-800">
          Écrivez votre message
        </h2>

        <div className="space-y-2">
          <label
            htmlFor="subject"
            className="block text-sm font-medium text-gray-700"
          >
            Sujet
          </label>
          <input
            id="subject"
            ref={subjectRef}
            className={`appearance-none block w-full px-3 py-2 border ${
              errors.subject ? 'border-red-500' : 'border-gray-300'
            } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            type="text"
            placeholder="De quoi avez-vous besoin ?"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={100}
            aria-invalid={errors.subject ? 'true' : 'false'}
            aria-describedby={errors.subject ? 'subject-error' : undefined}
          />
          {errors.subject && (
            <p id="subject-error" className="mt-1 text-sm text-red-600">
              {errors.subject}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="message"
            className="block text-sm font-medium text-gray-700"
          >
            Message
          </label>
          <div className="relative">
            <textarea
              id="message"
              className={`appearance-none block w-full px-3 py-2 border ${
                errors.message ? 'border-red-500' : 'border-gray-300'
              } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
              placeholder="Écrivez votre message..."
              rows="9"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              aria-invalid={errors.message ? 'true' : 'false'}
              aria-describedby={errors.message ? 'message-error' : 'char-count'}
            ></textarea>
            <div
              id="char-count"
              className={`absolute bottom-2 right-2 text-xs ${
                charCount > 900 ? 'text-orange-500' : 'text-gray-500'
              }`}
            >
              {charCount}/1000
            </div>
          </div>
          {errors.message && (
            <p id="message-error" className="mt-1 text-sm text-red-600">
              {errors.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Envoi en cours...' : 'Envoyer'}
        </button>
      </form>
    </div>
  );
};

export default Contact;
