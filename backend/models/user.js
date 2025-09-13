import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { captureException } from '@/monitoring/sentry';
import logger from '@/utils/logger';

/**
 * Schéma utilisateur avancé avec validation, indexation et méthodes d'instance
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please enter your name'],
      trim: true,
      maxLength: [50, 'Name cannot exceed 50 characters'],
      minLength: [2, 'Name should have at least 2 characters'],
      validate: {
        validator: function (v) {
          // Interdire les caractères spéciaux potentiellement dangereux
          return /^[a-zA-Z0-9\s._-]+$/.test(v);
        },
        message: (props) => `${props.value} contains invalid characters`,
      },
    },
    email: {
      type: String,
      required: [true, 'Please enter your email'],
      trim: true,
      lowercase: true, // Stocke toujours en minuscules pour éviter les doublons
      maxLength: [100, 'Email cannot exceed 100 characters'],
      validate: {
        validator: function (v) {
          // Validation basique d'email - peut être améliorée si nécessaire
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email address`,
      },
    },
    phone: {
      type: String,
      required: [true, 'Please enter your mobile number'],
      trim: true,
      validate: {
        validator: function (v) {
          // Accepte les formats internationaux avec éventuellement +, espaces, tirets, parenthèses
          return /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9}$/.test(
            v,
          );
        },
        message: (props) => `${props.value} is not a valid phone number`,
      },
    },
    // Modification de la validation du mot de passe dans le schéma
    password: {
      type: String,
      required: [true, 'Please enter your password'],
      minLength: [8, 'Password must be at least 8 characters'],
      maxLength: [100, 'Password cannot exceed 100 characters'],
      select: false, // Ne pas inclure par défaut dans les requêtes
      validate: {
        validator: function (v) {
          // Validation de force du mot de passe - exécutée uniquement lors de la création/modification
          // Au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial
          if (this.isModified('password')) {
            return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/.test(
              v,
            );
          }
          return true;
        },
        message:
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#)',
      },
    },
    avatar: {
      public_id: {
        type: String,
        default: null,
      },
      url: {
        type: String,
        default: null,
        validate: {
          validator: function (v) {
            // Valider l'URL seulement si elle existe
            if (!v) return true;
            return /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(
              v,
            );
          },
          message: 'Invalid URL format',
        },
      },
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'admin'],
        message: 'Role must be user or admin',
      },
      default: 'user',
      index: true, // Indexation pour accélérer les requêtes par rôle
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    verificationToken: String,
    verified: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true, // Une fois défini, ne peut plus être modifié
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: {
      updatedAt: 'updatedAt', // Met à jour automatiquement updatedAt
      createdAt: false, // Utilise notre champ createdAt personnalisé
    },
    toJSON: {
      transform: function (doc, ret) {
        // Supprimer les champs sensibles dans toJSON()
        delete ret.password;
        delete ret.loginAttempts;
        delete ret.lockUntil;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpire;
        delete ret.verificationToken;
        delete ret.__v;
        return ret;
      },
      virtuals: true,
    },
    toObject: { virtuals: true },
    collection: 'users', // Force le nom de la collection
  },
);

// Indexes pour optimiser les performances
userSchema.index(
  { email: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
); // Index insensible à la casse
userSchema.index({ createdAt: -1 });
userSchema.index({ updatedAt: -1 });
userSchema.index({ phone: 1 }, { sparse: true });

// Middleware avant la sauvegarde
userSchema.pre('save', async function (next) {
  try {
    // Si le mot de passe n'a pas été modifié, passer à la suite
    if (!this.isModified('password')) {
      return next();
    }

    // Enregistrer la date de changement de mot de passe
    this.passwordChangedAt = Date.now() - 1000;

    // Hasher le mot de passe avec un coût adaptatif
    // En production, on pourrait augmenter à 12 pour plus de sécurité
    const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
    this.password = await bcrypt.hash(this.password, saltRounds);

    next();
  } catch (error) {
    logger.error('Error hashing password', {
      userId: this._id,
      error: error.message,
    });
    captureException(error, {
      tags: { component: 'user-model', operation: 'password-hashing' },
    });
    next(error);
  }
});

// Middleware avant la mise à jour
userSchema.pre('findOneAndUpdate', function (next) {
  // Définir updatedAt à chaque mise à jour
  this.set({ updatedAt: Date.now() });
  next();
});

// Méthode pour comparer le mot de passe
userSchema.methods.comparePassword = async function (enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    logger.error('Error comparing password', {
      userId: this._id,
      error: error.message,
    });
    captureException(error, {
      tags: { component: 'user-model', operation: 'password-compare' },
    });
    return false;
  }
};

// Méthode pour vérifier si le compte est verrouillé
userSchema.methods.isLocked = function () {
  // Vérifier si le compte est verrouillé
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Méthode pour incrémenter les tentatives de connexion échouées
userSchema.methods.incrementLoginAttempts = async function () {
  try {
    // Incrémenter le compteur de tentatives
    this.loginAttempts += 1;

    // Verrouiller le compte après 5 tentatives échouées
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOCK_TIME = 30 * 60 * 1000; // 30 minutes

    if (this.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      this.lockUntil = Date.now() + LOCK_TIME;
      logger.info('Account locked due to multiple failed attempts', {
        userId: this._id,
      });
    }

    return await this.save();
  } catch (error) {
    logger.error('Error incrementing login attempts', {
      userId: this._id,
      error: error.message,
    });
    captureException(error);
    return this;
  }
};

// Méthode pour réinitialiser les tentatives de connexion
userSchema.methods.resetLoginAttempts = async function () {
  try {
    this.loginAttempts = 0;
    this.lockUntil = null;
    this.lastLogin = Date.now();
    return await this.save();
  } catch (error) {
    logger.error('Error resetting login attempts', {
      userId: this._id,
      error: error.message,
    });
    captureException(error);
    return this;
  }
};

// Méthode statique pour rechercher un utilisateur par email avec sensibilité à la casse
userSchema.statics.findByEmail = async function (
  email,
  includePassword = false,
) {
  try {
    // Ajouter '+password' à la sélection quand includePassword est true
    return includePassword
      ? await this.findOne({ email: email.toLowerCase() }).select('+password')
      : await this.findOne({ email: email.toLowerCase() });
  } catch (error) {
    logger.error('Error finding user by email', {
      error: error.message,
      email: email.substring(0, 3) + '***', // Anonymisation partielle
    });
    captureException(error);
    return null;
  }
};

// Méthode pour vérifier si l'utilisateur a changé son mot de passe après l'émission du token
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );
    // Retourne true si le mot de passe a été changé après l'émission du token
    return JWTTimestamp < changedTimestamp;
  }
  // Par défaut, false signifie que le mot de passe n'a pas été changé
  return false;
};

// Méthode pour générer un token de réinitialisation de mot de passe
userSchema.methods.createPasswordResetToken = async function () {
  try {
    // Créer un token aléatoire
    const resetToken = require('crypto').randomBytes(32).toString('hex');

    // Hasher le token et le stocker dans la base de données
    this.resetPasswordToken = require('crypto')
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Définir l'expiration à 10 minutes
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await this.save({ validateBeforeSave: false });

    return resetToken;
  } catch (error) {
    logger.error('Error creating password reset token', {
      userId: this._id,
      error: error.message,
    });
    captureException(error);
    throw new Error('Failed to generate reset token');
  }
};

// Virtualiser le nom complet (exemple de propriété virtuelle)
userSchema.virtual('fullName').get(function () {
  return this.name;
});

// Gestion optimisée du modèle avec vérification pour éviter les redéfinitions
const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
