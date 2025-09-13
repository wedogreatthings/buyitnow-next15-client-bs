import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true, // Indexer pour des recherches plus rapides
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'La quantité ne peut pas être inférieure à 1'],
      default: 1,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Indexer pour des recherches plus rapides
    },
    price: {
      type: Number,
      required: true, // Stocker le prix au moment de l'ajout au panier
      min: [0, 'Le prix ne peut pas être négatif'],
    },
    productName: {
      type: String,
      required: true, // Garder une copie du nom pour référence historique
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true, // Ne peut pas être modifié après création
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 7 * 24 * 60 * 60 * 1000), // Expire après 7 jours par défaut
      index: true, // Indexer pour faciliter le nettoyage
    },
  },
  {
    timestamps: true, // Ajoute et gère automatiquement createdAt et updatedAt
    validateBeforeSave: true, // Validation stricte avant enregistrement
  },
);

// Index composé pour rechercher rapidement les articles du panier d'un utilisateur
cartSchema.index({ user: 1, product: 1 }, { unique: true });

// Méthode virtuelle pour calculer le sous-total
cartSchema.virtual('subtotal').get(function () {
  return this.price * this.quantity;
});

// Méthode d'instance pour mettre à jour la quantité
cartSchema.methods.updateQuantity = function (newQuantity) {
  if (newQuantity < 1) {
    throw new Error('La quantité doit être au moins 1');
  }
  this.quantity = newQuantity;
  this.updatedAt = Date.now();
  return this.save();
};

// Méthode statique pour trouver tous les articles du panier d'un utilisateur
cartSchema.statics.findByUser = function (userId) {
  return this.find({ user: userId })
    .populate('product', 'name price stock images')
    .sort({ createdAt: -1 });
};

// Middleware pre-save pour valider la disponibilité du stock
cartSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('quantity')) {
    // Vous pourriez vérifier ici si le stock est suffisant
    // Ce code dépend de votre modèle Product
    try {
      const Product = mongoose.model('Product');
      const product = await Product.findById(this.product);

      if (!product) {
        return next(new Error('Produit non trouvé'));
      }

      if (product.stock < this.quantity) {
        return next(
          new Error(`Stock insuffisant. Disponible: ${product.stock}`),
        );
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Middleware pour mettre à jour le champ updatedAt automatiquement
cartSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware pour supprimer les articles expirés
cartSchema.statics.removeExpiredItems = function () {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Configurer le modèle pour qu'il utilise les options de toJSON
cartSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.__v; // Supprimer la version interne de mongoose
    return ret;
  },
});

// Créer le modèle
const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);

export default Cart;
