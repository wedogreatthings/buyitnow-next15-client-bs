'use client';

import { useRouter } from 'next/navigation';
import { createContext, useState } from 'react';
import { toast } from 'react-toastify';
import { useSession } from 'next-auth/react'; // ✅ AJOUT

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);

  const router = useRouter();
  // ✅ MODIFICATION: Gestion sécurisée de useSession
  const session = useSession();
  const updateSession = session?.update; // Éviter la déstructuration directe

  // ✅ NOUVELLE fonction pour synchroniser l'utilisateur avec session complète
  const syncUserWithSession = async (updatedUserData) => {
    // Récupérer les données actuelles de l'utilisateur
    const currentUser = user;

    // Créer un utilisateur complet en gardant toutes les propriétés existantes
    // et en ne mettant à jour que les champs modifiables
    const syncedUser = {
      ...currentUser, // Garder toutes les propriétés existantes
      name: updatedUserData.name || currentUser?.name,
      phone: updatedUserData.phone || currentUser?.phone,
      avatar: updatedUserData.avatar || currentUser?.avatar,
      // Garder les autres propriétés inchangées
    };

    console.log('Syncing user with session:', {
      before: currentUser,
      received: updatedUserData,
      synced: syncedUser,
    });

    // Mettre à jour l'état local
    setUser(syncedUser);

    // ✅ MODIFICATION: Vérifier que updateSession existe avant de l'utiliser
    if (updateSession && typeof updateSession === 'function') {
      try {
        await updateSession({
          user: syncedUser,
        });
        console.log('Session updated successfully');
      } catch (error) {
        console.warn('Failed to update session:', error);
        // Ne pas bloquer le processus si la mise à jour de session échoue
      }
    } else {
      console.warn('UpdateSession not available, skipping session sync');
    }

    return syncedUser;
  };

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
        console.error(httpError, 'AuthContext', 'registerUser', false);

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
        console.error(error, 'AuthContext', 'registerUser', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        // Erreur réseau critique
        console.error(error, 'AuthContext', 'registerUser', true);
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
        console.log('Le nom est obligatoire');
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
        console.error(httpError, 'AuthContext', 'updateProfile', isCritical);

        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Succès
      if (data.success) {
        console.log('User before update:', user);
        console.log('Updated user data:', data.data.updatedUser);

        // ✅ MODIFICATION: Utiliser la nouvelle fonction de synchronisation
        const syncedUser = await syncUserWithSession(data.data.updatedUser);

        console.log('User after sync:', syncedUser);

        toast.success('Profil mis à jour avec succès!');

        // ✅ AJOUT: Attendre un peu que la session soit mise à jour avant de rediriger
        setTimeout(() => {
          router.push('/me');
        }, 500);
      }
    } catch (error) {
      // Erreurs réseau/système
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps');
        console.error(error, 'AuthContext', 'updateProfile', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        console.error(error, 'AuthContext', 'updateProfile', true);
      }

      console.error('Profile update error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // ... resto des méthodes inchangées

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
        console.error(validationError, 'AuthContext', 'updatePassword', false);
        setError('Tous les champs sont obligatoires');
        setLoading(false);
        return;
      }

      if (currentPassword === newPassword) {
        const validationError = new Error(
          'Le nouveau mot de passe doit être différent',
        );
        console.error(validationError, 'AuthContext', 'updatePassword', false);
        setError('Le nouveau mot de passe doit être différent');
        setLoading(false);
        return;
      }

      if (newPassword.length < 8) {
        const validationError = new Error(
          'Minimum 8 caractères pour le nouveau mot de passe',
        );
        console.error(validationError, 'AuthContext', 'updatePassword', false);
        setError('Minimum 8 caractères pour le nouveau mot de passe');
        setLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        const validationError = new Error(
          'Le nouveau mot de passe et la confirmation ne correspondent pas',
        );
        console.error(validationError, 'AuthContext', 'updatePassword', false);
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
        console.error(httpError, 'AuthContext', 'updatePassword', isCritical);

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
        console.error(error, 'AuthContext', 'updatePassword', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        console.error(error, 'AuthContext', 'updatePassword', true);
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
        console.error(validationError, 'AuthContext', 'addNewAddress', false);
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
        console.error(httpError, 'AuthContext', 'addNewAddress', isCritical);

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
        console.error(error, 'AuthContext', 'addNewAddress', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        console.error(error, 'AuthContext', 'addNewAddress', true);
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
        console.error(validationError, 'AuthContext', 'updateAddress', false);
        setError("Identifiant d'adresse invalide");
        setLoading(false);
        return;
      }

      if (!address || Object.keys(address).length === 0) {
        const validationError = new Error("Données d'adresse invalides");
        console.error(validationError, 'AuthContext', 'updateAddress', false);
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
        console.error(httpError, 'AuthContext', 'updateAddress', isCritical);

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
        console.error(error, 'AuthContext', 'updateAddress', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        console.error(error, 'AuthContext', 'updateAddress', true);
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
        console.error(validationError, 'AuthContext', 'deleteAddress', false);
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
        console.error(httpError, 'AuthContext', 'deleteAddress', isCritical);

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
        console.error(error, 'AuthContext', 'deleteAddress', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        console.error(error, 'AuthContext', 'deleteAddress', true);
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
        console.error(validationError, 'AuthContext', 'sendEmail', false);
        setError('Le sujet est obligatoire');
        setLoading(false);
        return;
      }

      if (!message || !message.trim()) {
        const validationError = new Error('Le message est obligatoire');
        console.error(validationError, 'AuthContext', 'sendEmail', false);
        setError('Le message est obligatoire');
        setLoading(false);
        return;
      }

      if (subject.length > 200) {
        const validationError = new Error(
          'Le sujet est trop long (max 200 caractères)',
        );
        console.error(validationError, 'AuthContext', 'sendEmail', false);
        setError('Le sujet est trop long (max 200 caractères)');
        setLoading(false);
        return;
      }

      if (message.length > 5000) {
        const validationError = new Error(
          'Le message est trop long (max 5000 caractères)',
        );
        console.error(validationError, 'AuthContext', 'sendEmail', false);
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
        console.error(httpError, 'AuthContext', 'sendEmail', isCritical);

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
        console.error(error, 'AuthContext', 'sendEmail', false);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        console.error(error, 'AuthContext', 'sendEmail', true);
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
        syncUserWithSession, // ✅ AJOUT: Exposer la fonction si besoin ailleurs
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
