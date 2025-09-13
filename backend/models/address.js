import mongoose from 'mongoose';
import logger from '@/utils/logger';

/**
 * Schéma d'adresse avancé avec validation, indexation et méthodes d'instance
 */
const addressSchema = new mongoose.Schema(
  {
    street: {
      type: String,
      required: [true, "L'adresse est obligatoire"],
      trim: true,
      maxLength: [100, "L'adresse ne peut pas dépasser 100 caractères"],
      validate: {
        validator: function (v) {
          // Validation basique pour éviter les caractères dangereux
          return /^[a-zA-Z0-9\s,.'°-]+$/.test(v);
        },
        message: (props) =>
          `${props.value} contient des caractères non autorisés`,
      },
    },
    additionalInfo: {
      type: String,
      trim: true,
      maxLength: [
        100,
        'Les informations complémentaires ne peuvent pas dépasser 100 caractères',
      ],
      default: null,
    },
    city: {
      type: String,
      required: [true, 'La ville est obligatoire'],
      trim: true,
      maxLength: [50, 'Le nom de la ville ne peut pas dépasser 50 caractères'],
      validate: {
        validator: function (v) {
          return /^[a-zA-Z\s'-]+$/.test(v);
        },
        message: (props) => `${props.value} n'est pas un nom de ville valide`,
      },
    },
    state: {
      type: String,
      required: [true, 'La région/département est obligatoire'],
      trim: true,
      maxLength: [50, 'Le nom de la région ne peut pas dépasser 50 caractères'],
    },
    zipCode: {
      type: String,
      required: [true, 'Le code postal est obligatoire'],
      trim: true,
      validate: {
        validator: function (v) {
          // Validation adaptée aux codes postaux internationaux
          return /^[0-9A-Z]{2,10}$/.test(v.replace(/\s/g, ''));
        },
        message: (props) => `${props.value} n'est pas un code postal valide`,
      },
    },
    country: {
      type: String,
      required: [true, 'Le pays est obligatoire'],
      trim: true,
      maxLength: [50, 'Le nom du pays ne peut pas dépasser 50 caractères'],
      index: true, // Indexation pour faciliter les recherches par pays
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true, // Indexation pour trouver rapidement l'adresse par défaut
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "L'utilisateur est obligatoire"],
      ref: 'User',
      index: true, // Indexation pour optimiser les recherches par utilisateur
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true, // Une fois définie, ne peut plus être modifiée
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
        // Supprimer les champs sensibles ou inutiles
        delete ret.__v;
        return ret;
      },
      virtuals: true,
    },
    toObject: { virtuals: true },
    collection: 'addresses', // Force le nom de la collection
  },
);

// Indexes composés pour optimiser les performances
addressSchema.index({ user: 1, isDefault: 1 });

// Middleware avant la sauvegarde pour mettre à jour updatedAt
addressSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Si une adresse est définie comme par défaut, désactiver les autres adresses par défaut
addressSchema.pre('save', async function (next) {
  try {
    if (this.isDefault && this.isModified('isDefault')) {
      await this.constructor.updateMany(
        { user: this.user, _id: { $ne: this._id }, isDefault: true },
        { isDefault: false },
      );
    }
    next();
  } catch (error) {
    logger.error('Erreur lors de la mise à jour des adresses par défaut', {
      userId: this.user,
      addressId: this._id,
      error: error.message,
    });
    next(error);
  }
});

// Middleware avant la mise à jour
addressSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Méthode statique pour trouver toutes les adresses d'un utilisateur
addressSchema.statics.findByUser = function (userId) {
  return this.find({ user: userId }).sort({
    isDefault: -1,
    createdAt: -1,
  });
};

// Méthode statique pour trouver l'adresse par défaut d'un utilisateur
addressSchema.statics.findDefaultAddress = function (userId) {
  return this.findOne({
    user: userId,
    isDefault: true,
  });
};

// Méthode d'instance pour formater l'adresse complète
addressSchema.methods.getFormattedAddress = function () {
  const parts = [this.street];

  if (this.additionalInfo) {
    parts.push(this.additionalInfo);
  }

  parts.push(`${this.zipCode} ${this.city}`);
  parts.push(this.state);
  parts.push(this.country);

  return parts.join(', ');
};

// Virtualiser un identifiant lisible (exemple de propriété virtuelle)
addressSchema.virtual('addressId').get(function () {
  return `ADR-${this._id.toString().substring(0, 8).toUpperCase()}`;
});

// Gestion optimisée du modèle avec vérification pour éviter les redéfinitions
const Address =
  mongoose.models.Address || mongoose.model('Address', addressSchema);

export default Address;
