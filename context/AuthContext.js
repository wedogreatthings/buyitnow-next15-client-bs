'use client';

import { useRouter } from 'next/navigation';
import { createContext, useState } from 'react';
import { toast } from 'react-toastify';
import captureClientError from '@/monitoring/sentry';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);

  const router = useRouter();

  const registerUser = async ({ name, phone, email, password }) => {
    try {
      setLoading(true);
      setError(null);

      // 3. Simple fetch avec timeout court
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s comme vos APIs

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ name, phone, email, password }),
          signal: controller.signal,
          credentials: 'include',
        },
      );

      clearTimeout(timeoutId);

      const data = await res.json();

      // 4. Gestion simple des erreurs (comme vos APIs)
      if (!res.ok) {
        let errorMessage = '';
        switch (res.status) {
          case 400:
            errorMessage = data.message || "Données d'inscription invalides";
            break;
          case 409:
            errorMessage = 'Cet email est déjà utilisé';
            break;
          case 429:
            errorMessage = 'Trop de tentatives. Réessayez plus tard.';
            break;
          default:
            errorMessage = data.message || "Erreur lors de l'inscription";
        }

        // Monitoring Sentry pour erreurs HTTP (non-critiques car attendues)
        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        captureClientError(httpError, 'AuthContext', 'registerUser', false);

        setError(errorMessage);
        setLoading(false);
        return;
      }

      // 5. Succès
      if (data.success) {
        toast.success('Inscription réussie!');
        setTimeout(() => router.push('/login'), 1000);
      }
    } catch (error) {
      // 6. Erreurs réseau/système - Monitoring critique
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps');
        captureClientError(error, 'AuthContext', 'registerUser', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        // Erreur réseau critique
        captureClientError(error, 'AuthContext', 'registerUser', true);
      }

      console.error('Registration error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async ({ name, phone, avatar }) => {
    try {
      setLoading(true);
      setError(null);

      // Validation basique côté client
      if (!name || name.trim() === '') {
        const validationError = new Error('Le nom est obligatoire');
        captureClientError(
          validationError,
          'AuthContext',
          'updateProfile',
          false,
        );
        setError('Le nom est obligatoire');
        setLoading(false);
        return;
      }

      // Simple fetch avec timeout court
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s comme vos APIs

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me/update`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            phone: phone ? phone.trim() : '',
            avatar,
          }),
          signal: controller.signal,
          credentials: 'include',
        },
      );

      clearTimeout(timeoutId);

      const data = await res.json();

      // Gestion simple des erreurs (comme registerUser)
      if (!res.ok) {
        let errorMessage = '';
        switch (res.status) {
          case 400:
            errorMessage = data.message || 'Données de profil invalides';
            break;
          case 401:
            errorMessage = 'Session expirée. Veuillez vous reconnecter';
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 429:
            errorMessage = 'Trop de tentatives. Réessayez plus tard.';
            break;
          default:
            errorMessage = data.message || 'Erreur lors de la mise à jour';
        }

        // Monitoring pour erreurs HTTP
        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = res.status === 401; // Session expirée = critique
        captureClientError(
          httpError,
          'AuthContext',
          'updateProfile',
          isCritical,
        );

        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Succès
      if (data.success) {
        setUser(data.data.updatedUser);
        toast.success('Profil mis à jour avec succès!');
        router.push('/me');
      }
    } catch (error) {
      // Erreurs réseau/système
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps');
        captureClientError(error, 'AuthContext', 'updateProfile', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        captureClientError(error, 'AuthContext', 'updateProfile', true);
      }

      console.error('Profile update error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async ({
    currentPassword,
    newPassword,
    confirmPassword,
  }) => {
    try {
      setLoading(true);
      setError(null);

      // Validation basique côté client (juste les essentiels)
      if (!currentPassword || !newPassword) {
        const validationError = new Error('Tous les champs sont obligatoires');
        captureClientError(
          validationError,
          'AuthContext',
          'updatePassword',
          false,
        );
        setError('Tous les champs sont obligatoires');
        setLoading(false);
        return;
      }

      if (currentPassword === newPassword) {
        const validationError = new Error(
          'Le nouveau mot de passe doit être différent',
        );
        captureClientError(
          validationError,
          'AuthContext',
          'updatePassword',
          false,
        );
        setError('Le nouveau mot de passe doit être différent');
        setLoading(false);
        return;
      }

      if (newPassword.length < 8) {
        const validationError = new Error(
          'Minimum 8 caractères pour le nouveau mot de passe',
        );
        captureClientError(
          validationError,
          'AuthContext',
          'updatePassword',
          false,
        );
        setError('Minimum 8 caractères pour le nouveau mot de passe');
        setLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        const validationError = new Error(
          'Le nouveau mot de passe et la confirmation ne correspondent pas',
        );
        captureClientError(
          validationError,
          'AuthContext',
          'updatePassword',
          false,
        );
        setError(
          'Le nouveau mot de passe et la confirmation ne correspondent pas',
        );
        setLoading(false);
        return;
      }

      // Simple fetch avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me/update_password`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
          signal: controller.signal,
          credentials: 'include',
        },
      );

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        let errorMessage = '';
        switch (res.status) {
          case 400:
            errorMessage = data.message || 'Mot de passe actuel incorrect';
            break;
          case 401:
            errorMessage = 'Session expirée. Veuillez vous reconnecter';
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 429:
            errorMessage = 'Trop de tentatives. Réessayez plus tard.';
            break;
          default:
            errorMessage = data.message || 'Erreur lors de la mise à jour';
        }

        // Monitoring pour erreurs HTTP - Critique si session expirée
        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = res.status === 401;
        captureClientError(
          httpError,
          'AuthContext',
          'updatePassword',
          isCritical,
        );

        setError(errorMessage);
        setLoading(false);
        return;
      }

      if (data.success) {
        toast.success('Mot de passe mis à jour avec succès!');
        router.replace('/me');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps');
        captureClientError(error, 'AuthContext', 'updatePassword', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        captureClientError(error, 'AuthContext', 'updatePassword', true);
      }
      console.error('Password update error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const addNewAddress = async (address) => {
    try {
      setLoading(true);
      setError(null);

      // Validation basique
      if (!address) {
        const validationError = new Error(
          "Les données d'adresse sont manquantes",
        );
        captureClientError(
          validationError,
          'AuthContext',
          'addNewAddress',
          false,
        );
        setError("Les données d'adresse sont manquantes");
        setLoading(false);
        return;
      }

      // Simple fetch avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/address`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(address),
          signal: controller.signal,
          credentials: 'include',
        },
      );

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        let errorMessage = '';
        switch (res.status) {
          case 400:
            errorMessage = data.message || "Données d'adresse invalides";
            break;
          case 401:
            errorMessage = 'Session expirée. Veuillez vous reconnecter';
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 409:
            errorMessage = 'Cette adresse existe déjà';
            break;
          case 429:
            errorMessage = 'Trop de tentatives. Réessayez plus tard.';
            break;
          default:
            errorMessage = data.message || "Erreur lors de l'ajout";
        }

        // Monitoring pour erreurs HTTP
        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = res.status === 401;
        captureClientError(
          httpError,
          'AuthContext',
          'addNewAddress',
          isCritical,
        );

        setError(errorMessage);
        setLoading(false);
        return;
      }

      if (data.success) {
        toast.success('Adresse ajoutée avec succès!');
        router.push('/me');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps');
        captureClientError(error, 'AuthContext', 'addNewAddress', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        captureClientError(error, 'AuthContext', 'addNewAddress', true);
      }
      console.error('Address creation error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateAddress = async (id, address) => {
    try {
      setLoading(true);
      setError(null);

      // Validation basique
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        const validationError = new Error("Identifiant d'adresse invalide");
        captureClientError(
          validationError,
          'AuthContext',
          'updateAddress',
          false,
        );
        setError("Identifiant d'adresse invalide");
        setLoading(false);
        return;
      }

      if (!address || Object.keys(address).length === 0) {
        const validationError = new Error("Données d'adresse invalides");
        captureClientError(
          validationError,
          'AuthContext',
          'updateAddress',
          false,
        );
        setError("Données d'adresse invalides");
        setLoading(false);
        return;
      }

      // Simple fetch avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/address/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(address),
          signal: controller.signal,
          credentials: 'include',
        },
      );

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        let errorMessage = '';
        switch (res.status) {
          case 400:
            errorMessage = data.message || "Données d'adresse invalides";
            break;
          case 401:
            errorMessage = 'Session expirée. Veuillez vous reconnecter';
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 403:
            errorMessage = "Vous n'avez pas l'autorisation";
            break;
          case 404:
            errorMessage = 'Adresse non trouvée';
            setTimeout(() => router.push('/me'), 2000);
            break;
          case 409:
            errorMessage = 'Cette adresse existe déjà';
            break;
          case 429:
            errorMessage = 'Trop de tentatives. Réessayez plus tard.';
            break;
          default:
            errorMessage = data.message || 'Erreur lors de la modification';
        }

        // Monitoring pour erreurs HTTP - Critique pour 401/403/404
        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = [401, 403, 404].includes(res.status);
        captureClientError(
          httpError,
          'AuthContext',
          'updateAddress',
          isCritical,
        );

        setError(errorMessage);
        setLoading(false);
        return;
      }

      if (data.success) {
        setUpdated(true);
        toast.success('Adresse modifiée avec succès!');
        router.replace(`/address/${id}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps');
        captureClientError(error, 'AuthContext', 'updateAddress', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        captureClientError(error, 'AuthContext', 'updateAddress', true);
      }
      console.error('Address update error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteAddress = async (id) => {
    try {
      setLoading(true);
      setError(null);

      // Validation basique
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        const validationError = new Error("Identifiant d'adresse invalide");
        captureClientError(
          validationError,
          'AuthContext',
          'deleteAddress',
          false,
        );
        setError("Identifiant d'adresse invalide");
        setLoading(false);
        return;
      }

      // Simple fetch avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/address/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          signal: controller.signal,
          credentials: 'include',
        },
      );

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        let errorMessage = '';
        switch (res.status) {
          case 400:
            errorMessage = data.message || 'Identifiant invalide';
            break;
          case 401:
            errorMessage = 'Session expirée. Veuillez vous reconnecter';
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 403:
            errorMessage = "Vous n'avez pas l'autorisation";
            break;
          case 404:
            errorMessage = 'Adresse non trouvée';
            setTimeout(() => router.push('/me'), 2000);
            break;
          case 429:
            errorMessage = 'Trop de tentatives. Réessayez plus tard.';
            break;
          default:
            errorMessage = data.message || 'Erreur lors de la suppression';
        }

        // Monitoring pour erreurs HTTP - Critique pour 401/403/404
        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = [401, 403, 404].includes(res.status);
        captureClientError(
          httpError,
          'AuthContext',
          'deleteAddress',
          isCritical,
        );

        setError(errorMessage);
        setLoading(false);
        return;
      }

      if (data.success) {
        toast.success('Adresse supprimée avec succès!');
        router.push('/me');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps');
        captureClientError(error, 'AuthContext', 'deleteAddress', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        captureClientError(error, 'AuthContext', 'deleteAddress', true);
      }
      console.error('Address deletion error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async ({ subject, message }) => {
    try {
      setLoading(true);
      setError(null);

      // Validation basique
      if (!subject || !subject.trim()) {
        const validationError = new Error('Le sujet est obligatoire');
        captureClientError(validationError, 'AuthContext', 'sendEmail', false);
        setError('Le sujet est obligatoire');
        setLoading(false);
        return;
      }

      if (!message || !message.trim()) {
        const validationError = new Error('Le message est obligatoire');
        captureClientError(validationError, 'AuthContext', 'sendEmail', false);
        setError('Le message est obligatoire');
        setLoading(false);
        return;
      }

      if (subject.length > 200) {
        const validationError = new Error(
          'Le sujet est trop long (max 200 caractères)',
        );
        captureClientError(validationError, 'AuthContext', 'sendEmail', false);
        setError('Le sujet est trop long (max 200 caractères)');
        setLoading(false);
        return;
      }

      if (message.length > 5000) {
        const validationError = new Error(
          'Le message est trop long (max 5000 caractères)',
        );
        captureClientError(validationError, 'AuthContext', 'sendEmail', false);
        setError('Le message est trop long (max 5000 caractères)');
        setLoading(false);
        return;
      }

      // Simple fetch avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s pour l'email

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ subject, message }),
        signal: controller.signal,
        credentials: 'include',
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        let errorMessage = '';
        switch (res.status) {
          case 400:
            errorMessage = data.message || 'Données invalides';
            break;
          case 401:
            errorMessage = 'Session expirée. Veuillez vous reconnecter';
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 404:
            errorMessage = 'Utilisateur non trouvé';
            break;
          case 429:
            errorMessage = 'Trop de tentatives. Réessayez plus tard.';
            break;
          case 503:
            errorMessage = "Service d'email temporairement indisponible";
            break;
          default:
            errorMessage = data.message || "Erreur lors de l'envoi";
        }

        // Monitoring pour erreurs HTTP - Critique pour 401/503
        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = [401, 503].includes(res.status);
        captureClientError(httpError, 'AuthContext', 'sendEmail', isCritical);

        setError(errorMessage);
        setLoading(false);
        return;
      }

      if (data.success) {
        toast.success('Message envoyé avec succès!');
        router.push('/me');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps');
        captureClientError(error, 'AuthContext', 'sendEmail', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        captureClientError(error, 'AuthContext', 'sendEmail', true);
      }
      console.error('Email send error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Ajoutez cette méthode
  const clearUser = () => {
    setUser(null);
    setError(null);
    setUpdated(false);
  };

  const clearErrors = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        error,
        loading,
        updated,
        setUpdated,
        setUser,
        setLoading,
        registerUser,
        updateProfile,
        updatePassword,
        addNewAddress,
        updateAddress,
        deleteAddress,
        sendEmail,
        clearUser,
        clearErrors,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
