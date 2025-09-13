import mongoose from 'mongoose';
import { captureException } from '@/monitoring/sentry';

/**
 * Schema de validation pour les messages de contact
 * Optimisé pour la performance, la sécurité et la robustesse
 */
const contactSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, "L'identifiant utilisateur est requis"],
      index: true, // Indexation pour optimiser les requêtes par utilisateur
    },
    subject: {
      type: String,
      required: [true, 'Le sujet est requis'],
      trim: true,
      minlength: [3, 'Le sujet doit contenir au moins 3 caractères'],
      maxlength: [100, 'Le sujet ne peut pas dépasser 100 caractères'],
    },
    message: {
      type: String,
      required: [true, 'Le message est requis'],
      trim: true,
      minlength: [10, 'Le message doit contenir au moins 10 caractères'],
      maxlength: [5000, 'Le message ne peut pas dépasser 5000 caractères'],
    },
    read: {
      type: Boolean,
      default: false,
      index: true, // Indexation pour optimiser les requêtes de messages non lus
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'resolved', 'sent'],
      default: 'pending',
      index: true, // Indexation pour recherche par statut
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      referrer: String,
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true, // Indexation pour optimiser les requêtes chronologiques
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { updatedAt: 'updatedAt' }, // Mise à jour automatique de updatedAt
    toJSON: {
      transform: function (doc, ret) {
        // Sécurisation des données retournées en JSON
        delete ret.__v;
        delete ret.metadata?.ipAddress; // Protection des données sensibles
        return ret;
      },
    },
    // Optimisation des performances avec collation insensible à la casse
    collation: { locale: 'fr', strength: 2 },
  },
);

// Indexation composée pour les requêtes communes
contactSchema.index({ from: 1, createdAt: -1 });
contactSchema.index({ status: 1, priority: -1, createdAt: -1 });

// Méthode de validation avancée avant sauvegarde
contactSchema.pre('save', function (next) {
  try {
    // Validation supplémentaire pour le message (ex: détection de spam)
    if (this.isModified('message') && this.message) {
      // Sanitisation simple du message (exemple basique)
      this.message = this.message.replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        '',
      );

      // Vérification des mots interdits (exemple)
      const spamWords = ['viagra', 'pharmacy', 'loan', 'lottery', 'winner'];
      const containsSpam = spamWords.some((word) =>
        this.message.toLowerCase().includes(word),
      );

      if (containsSpam) {
        this.status = 'spam';
      }
    }

    // Valider que le sujet n'est pas identique au message (éviter spam)
    if (
      this.isModified('subject') &&
      this.isModified('message') &&
      this.subject &&
      this.message &&
      this.subject.trim() === this.message.trim()
    ) {
      const error = new Error(
        'Le sujet et le message ne peuvent pas être identiques',
      );
      error.name = 'ValidationError';
      return next(error);
    }

    next();
  } catch (error) {
    // Capturer l'exception pour monitoring
    if (
      process.env.NODE_ENV === 'production' &&
      typeof captureException === 'function'
    ) {
      captureException(error, {
        tags: { component: 'ContactModel', action: 'preSave' },
        extra: { contactId: this._id },
      });
    }
    next(error);
  }
});

// Méthode statique pour recherche avancée
contactSchema.statics.search = async function (query, options = {}) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortDirection = -1,
      status,
      userId,
      isRead,
    } = options;

    const skip = (page - 1) * limit;
    const conditions = {};

    // Construire les conditions de recherche
    if (query && query.trim()) {
      conditions.$or = [
        { subject: new RegExp(query, 'i') },
        { message: new RegExp(query, 'i') },
      ];
    }

    if (status) conditions.status = status;
    if (userId) conditions.from = userId;
    if (isRead !== undefined) conditions.read = isRead;

    // Exécuter la requête avec pagination
    const [contacts, totalCount] = await Promise.all([
      this.find(conditions)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .populate('from', 'name email')
        .lean(),
      this.countDocuments(conditions),
    ]);

    return {
      contacts,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      },
    };
  } catch (error) {
    // Journalisation et capture de l'erreur pour monitoring
    console.error('Contact search error:', error);

    if (
      process.env.NODE_ENV === 'production' &&
      typeof captureException === 'function'
    ) {
      captureException(error, {
        tags: { component: 'ContactModel', action: 'search' },
      });
    }

    throw error;
  }
};

// Méthode d'instance pour marquer comme lu avec validation
contactSchema.methods.markAsRead = async function () {
  if (!this.read) {
    this.read = true;
    this.updatedAt = new Date();
    await this.save();
    return true;
  }
  return false;
};

// Middleware pour nettoyer les données potentiellement dangereuses
contactSchema.pre('findOneAndUpdate', function (next) {
  // Empêcher certaines modifications basées sur des règles métier
  if (this._update.status === 'resolved' && !this._update.updatedAt) {
    this._update.updatedAt = new Date();
  }
  next();
});

// Optimisation de la sérialisation
contactSchema.set('toObject', {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Vérification de l'existence du modèle avant création pour éviter des erreurs
const Contact =
  mongoose.models.Contact || mongoose.model('Contact', contactSchema);

// Validation du modèle
try {
  // Vérification des index
  Contact.ensureIndexes();
} catch (error) {
  console.error('Error in Contact model index creation:', error);
  if (
    process.env.NODE_ENV === 'production' &&
    typeof captureException === 'function'
  ) {
    captureException(error, {
      tags: { component: 'ContactModel', action: 'ensureIndexes' },
    });
  }
}

export default Contact;
