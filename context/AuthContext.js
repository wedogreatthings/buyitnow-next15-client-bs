'use client';

import { useRouter } from 'next/navigation';
import { createContext, useState } from 'react';
import { toast } from 'react-toastify';

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
        switch (res.status) {
          case 400:
            setError(data.message || "Données d'inscription invalides");
            break;
          case 409:
            setError('Cet email est déjà utilisé');
            break;
          case 429:
            setError('Trop de tentatives. Réessayez plus tard.');
            break;
          default:
            setError(data.message || "Erreur lors de l'inscription");
        }
        setLoading(false);
        return;
      }

      // 5. Succès
      if (data.success) {
        toast.success('Inscription réussie!');
        setTimeout(() => router.push('/login'), 1000);
      }
    } catch (error) {
      // 6. Erreurs réseau uniquement - PAS de Sentry ici
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps');
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
      }

      // L'API capturera les vraies erreurs serveur
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
        switch (res.status) {
          case 400:
            setError(data.message || 'Données de profil invalides');
            break;
          case 401:
            setError('Session expirée. Veuillez vous reconnecter');
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 429:
            setError('Trop de tentatives. Réessayez plus tard.');
            break;
          default:
            setError(data.message || 'Erreur lors de la mise à jour');
        }
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
      // Erreurs réseau uniquement - PAS de Sentry ici
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps');
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
      }

      // L'API capturera les vraies erreurs serveur
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
        setError('Tous les champs sont obligatoires');
        setLoading(false);
        return;
      }

      if (currentPassword === newPassword) {
        setError('Le nouveau mot de passe doit être différent');
        setLoading(false);
        return;
      }

      if (newPassword.length < 8) {
        setError('Minimum 8 caractères pour le nouveau mot de passe');
        setLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
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
        switch (res.status) {
          case 400:
            setError(data.message || 'Mot de passe actuel incorrect');
            break;
          case 401:
            setError('Session expirée. Veuillez vous reconnecter');
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 429:
            setError('Trop de tentatives. Réessayez plus tard.');
            break;
          default:
            setError(data.message || 'Erreur lors de la mise à jour');
        }
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
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
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
        switch (res.status) {
          case 400:
            setError(data.message || "Données d'adresse invalides");
            break;
          case 401:
            setError('Session expirée. Veuillez vous reconnecter');
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 409:
            setError('Cette adresse existe déjà');
            break;
          case 429:
            setError('Trop de tentatives. Réessayez plus tard.');
            break;
          default:
            setError(data.message || "Erreur lors de l'ajout");
        }
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
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
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
        setError("Identifiant d'adresse invalide");
        setLoading(false);
        return;
      }

      if (!address || Object.keys(address).length === 0) {
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
        switch (res.status) {
          case 400:
            setError(data.message || "Données d'adresse invalides");
            break;
          case 401:
            setError('Session expirée. Veuillez vous reconnecter');
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 403:
            setError("Vous n'avez pas l'autorisation");
            break;
          case 404:
            setError('Adresse non trouvée');
            setTimeout(() => router.push('/me'), 2000);
            break;
          case 409:
            setError('Cette adresse existe déjà');
            break;
          case 429:
            setError('Trop de tentatives. Réessayez plus tard.');
            break;
          default:
            setError(data.message || 'Erreur lors de la modification');
        }
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
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
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
        switch (res.status) {
          case 400:
            setError(data.message || 'Identifiant invalide');
            break;
          case 401:
            setError('Session expirée. Veuillez vous reconnecter');
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 403:
            setError("Vous n'avez pas l'autorisation");
            break;
          case 404:
            setError('Adresse non trouvée');
            setTimeout(() => router.push('/me'), 2000);
            break;
          case 429:
            setError('Trop de tentatives. Réessayez plus tard.');
            break;
          default:
            setError(data.message || 'Erreur lors de la suppression');
        }
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
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
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
        setError('Le sujet est obligatoire');
        setLoading(false);
        return;
      }

      if (!message || !message.trim()) {
        setError('Le message est obligatoire');
        setLoading(false);
        return;
      }

      if (subject.length > 200) {
        setError('Le sujet est trop long (max 200 caractères)');
        setLoading(false);
        return;
      }

      if (message.length > 5000) {
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
        switch (res.status) {
          case 400:
            setError(data.message || 'Données invalides');
            break;
          case 401:
            setError('Session expirée. Veuillez vous reconnecter');
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 404:
            setError('Utilisateur non trouvé');
            break;
          case 429:
            setError('Trop de tentatives. Réessayez plus tard.');
            break;
          case 503:
            setError("Service d'email temporairement indisponible");
            break;
          default:
            setError(data.message || "Erreur lors de l'envoi");
        }
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
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
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
