import mongoose from 'mongoose';
import logger from '@/utils/logger';
import { captureException } from '@/monitoring/sentry';

/**
 * Schéma détaillé pour les produits dans une commande
 * Stocke toutes les informations nécessaires pour référence historique
 */
const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'ID du produit obligatoire'],
    ref: 'Product',
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Nom du produit obligatoire'],
    trim: true,
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
  },
  category: {
    type: String,
    required: [true, 'Catégorie obligatoire'],
    trim: true,
  },
  quantity: {
    type: Number,
    required: [true, 'Quantité obligatoire'],
    min: [1, 'La quantité minimum est 1'],
    validate: {
      validator: Number.isInteger,
      message: 'La quantité doit être un nombre entier',
    },
  },
  image: {
    type: String,
    required: [true, 'Image obligatoire'],
  },
  price: {
    type: Number,
    required: [true, 'Prix unitaire obligatoire'],
    min: [0, 'Le prix ne peut pas être négatif'],
    set: (val) => Math.round(val * 100) / 100, // Arrondir à 2 décimales
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Le sous-total ne peut pas être négatif'],
    set: (val) => Math.round(val * 100) / 100, // Arrondir à 2 décimales
  },
});

/**
 * Schéma de paiement avec validation stricte
 */
const paymentInfoSchema = new mongoose.Schema({
  amountPaid: {
    type: Number,
    required: [true, 'Montant payé obligatoire'],
    min: [0, 'Le montant ne peut pas être négatif'],
    set: (val) => Math.round(val * 100) / 100, // Arrondir à 2 décimales
  },
  typePayment: {
    type: String,
    required: [true, 'Type de paiement obligatoire'],
    enum: {
      values: ['WAAFI', 'D-MONEY', 'CAC-PAY', 'BCI-PAY'],
      message: 'Type de paiement non supporté: {VALUE}',
    },
  },
  paymentAccountNumber: {
    type: String,
    required: [true, 'Numéro de compte obligatoire'],
    trim: true,
    maxlength: [50, 'Le numéro ne peut pas dépasser 50 caractères'],
    // Masquer les numéros sensibles dans les réponses
    get: function (val) {
      if (!val) return val;
      // Afficher seulement les 4 derniers caractères, masquer le reste
      return val.length > 4 ? '••••••' + val.slice(-4) : val;
    },
  },
  paymentAccountName: {
    type: String,
    required: [true, 'Nom du compte obligatoire'],
    trim: true,
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Schéma de commande complet avec validation, indexation et relations
 */
const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      index: true,
      // Généré automatiquement à la création
    },
    shippingInfo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Utilisateur obligatoire'],
      ref: 'User',
      index: true,
    },
    orderItems: [orderItemSchema],
    paymentInfo: paymentInfoSchema,
    paymentStatus: {
      type: String,
      enum: {
        values: ['unpaid', 'processing', 'paid', 'refunded', 'failed'],
        message: 'Statut de paiement non valide: {VALUE}',
      },
      default: 'unpaid',
      index: true,
    },
    orderStatus: {
      type: String,
      enum: {
        values: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
        message: 'Statut de commande non valide: {VALUE}',
      },
      default: 'Processing',
      index: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Le montant total ne peut pas être négatif'],
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'La taxe ne peut pas être négative'],
    },
    shippingAmount: {
      type: Number,
      default: 0,
      min: [0, 'Les frais de port ne peuvent pas être négatifs'],
    },
    cancelReason: {
      type: String,
      trim: true,
      maxlength: [200, 'La raison ne peut pas dépasser 200 caractères'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    paidAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: {
      updatedAt: 'updatedAt',
      createdAt: false, // On utilise notre propre champ createdAt
    },
    toJSON: {
      virtuals: true,
      getters: true,
      transform: function (doc, ret) {
        delete ret.__v;
        // Ne pas exposer les informations sensibles
        if (ret.paymentInfo && ret.paymentInfo.paymentAccountNumber) {
          // Masquer le numéro de compte en ne montrant que les 4 derniers chiffres
          const num = ret.paymentInfo.paymentAccountNumber;
          ret.paymentInfo.paymentAccountNumber =
            num.length > 4 ? '••••••' + num.slice(-4) : num;
        }
        return ret;
      },
    },
    toObject: { virtuals: true, getters: true },
  },
);

// Indexer pour les requêtes fréquentes
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

// Créer un identifiant unique au format ORD-YYYYMMDD-XXXXX
orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const date = new Date();
      const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');

      // Trouver le dernier numéro de commande pour aujourd'hui
      const lastOrder = await this.constructor
        .findOne(
          {
            orderNumber: new RegExp(`ORD-${datePart}-\\d+`),
          },
          { orderNumber: 1 },
        )
        .sort({ orderNumber: -1 });

      let sequence = 1;
      if (lastOrder && lastOrder.orderNumber) {
        const lastSequence = parseInt(
          lastOrder.orderNumber.split('-')[2] || '0',
        );
        sequence = lastSequence + 1;
      }

      // Formater avec padding à 5 chiffres (00001)
      this.orderNumber = `ORD-${datePart}-${sequence.toString().padStart(5, '0')}`;
    } catch (error) {
      logger.error('Erreur lors de la génération du numéro de commande', {
        error: error.message,
        userId: this.user,
      });

      // Fallback si la génération du numéro échoue - utiliser un timestamp unique
      const timestamp = Date.now().toString();
      this.orderNumber = `ORD-${timestamp.substring(0, 8)}-${timestamp.substring(8)}`;
    }

    // Calculer automatiquement le sous-total pour chaque article
    if (this.orderItems && this.orderItems.length > 0) {
      this.orderItems.forEach((item) => {
        if (!item.subtotal) {
          item.subtotal = item.price * item.quantity;
        }
      });
    }
  }

  // Mettre à jour le champ updatedAt
  this.updatedAt = Date.now();
  next();
});

// Vérifier la cohérence des données avant sauvegarde
orderSchema.pre('save', function (next) {
  // Vérifier que le total correspond à la somme des sous-totaux + frais
  if (
    this.isModified('orderItems') ||
    this.isModified('shippingAmount') ||
    this.isModified('taxAmount')
  ) {
    const itemsTotal = this.orderItems.reduce(
      (sum, item) => sum + (item.subtotal || item.price * item.quantity),
      0,
    );
    const calculatedTotal =
      itemsTotal + (this.shippingAmount || 0) + (this.taxAmount || 0);

    // Permettre une petite différence due aux arrondis (0.01)
    if (Math.abs(calculatedTotal - this.totalAmount) > 0.01) {
      this.totalAmount = Number(calculatedTotal.toFixed(2));
    }
  }

  // Mises à jour de dates selon le statut
  if (
    this.isModified('paymentStatus') &&
    this.paymentStatus === 'paid' &&
    !this.paidAt
  ) {
    this.paidAt = Date.now();
  }

  if (this.isModified('orderStatus')) {
    if (this.orderStatus === 'Delivered' && !this.deliveredAt) {
      this.deliveredAt = Date.now();
    } else if (this.orderStatus === 'Cancelled' && !this.cancelledAt) {
      this.cancelledAt = Date.now();
    }
  }

  next();
});

// Mettre à jour le stock après création d'une commande
orderSchema.post('save', async function () {
  try {
    if (this.isNew) {
      const Product = mongoose.model('Product');
      const bulkOps = this.orderItems.map((item) => ({
        updateOne: {
          filter: { _id: item.product },
          update: {
            $inc: {
              stock: -item.quantity,
              sold: item.quantity,
            },
          },
        },
      }));

      if (bulkOps.length > 0) {
        await Product.bulkWrite(bulkOps);
      }
    }
  } catch (error) {
    // Ne pas bloquer la création de commande, mais logger l'erreur
    logger.error('Erreur lors de la mise à jour du stock', {
      error: error.message,
      orderId: this._id,
      orderNumber: this.orderNumber,
    });

    captureException(error, {
      tags: { component: 'order-model', operation: 'update-stock' },
    });
  }
});

// Méthode pour calculer le total de la commande
orderSchema.methods.calculateTotal = function () {
  const itemsTotal = this.orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  return itemsTotal + (this.shippingAmount || 0) + (this.taxAmount || 0);
};

// Méthode statique pour trouver les commandes d'un utilisateur
orderSchema.statics.findByUser = function (userId, limit = 10, page = 1) {
  const skip = (page - 1) * limit;
  return this.find({ user: userId })
    .select('-__v')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('shippingInfo', 'street city state zipCode country')
    .lean();
};

// Méthode statique pour trouver les commandes récentes
orderSchema.statics.findRecent = function (limit = 20) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email')
    .populate('shippingInfo', 'street city state zipCode country')
    .lean();
};

// Méthode statique pour les statistiques de commandes
orderSchema.statics.getStats = async function () {
  try {
    const stats = await this.aggregate([
      {
        $facet: {
          status: [{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }],
          payment: [{ $group: { _id: '$paymentStatus', count: { $sum: 1 } } }],
          revenue: [
            { $match: { paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
          ],
          daily: [
            {
              $match: {
                createdAt: {
                  $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                orders: { $sum: 1 },
                revenue: {
                  $sum: {
                    $cond: [
                      { $eq: ['$paymentStatus', 'paid'] },
                      '$totalAmount',
                      0,
                    ],
                  },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    return stats[0];
  } catch (error) {
    logger.error('Erreur lors du calcul des statistiques de commandes', {
      error: error.message,
    });
    throw error;
  }
};

// Protection contre les recherches trop intensives
orderSchema.pre('find', function () {
  // Limiter le nombre de résultats si aucune limite n'est spécifiée
  if (!this.options.limit) {
    this.limit(100);
  }

  // Ajouter un timeout pour éviter les requêtes trop longues
  this.maxTimeMS(5000);
});

// Virtualiser le nombre d'articles
orderSchema.virtual('itemCount').get(function () {
  return this.orderItems.reduce((total, item) => total + item.quantity, 0);
});

// Gestion optimisée du modèle avec vérification pour éviter les redéfinitions
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

export default Order;
