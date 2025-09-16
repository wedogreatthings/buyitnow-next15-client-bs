import mongoose from 'mongoose';
import slug from 'mongoose-slug-updater';

// Initialiser le plugin de slug
mongoose.plugin(slug);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Le nom du produit est obligatoire'],
      trim: true,
      maxlength: [100, 'Le nom du produit ne peut pas dépasser 100 caractères'],
    },
    slug: {
      type: String,
      slug: 'name',
      unique: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'La description du produit est obligatoire'],
      trim: true,
      maxlength: [2000, 'La description ne peut pas dépasser 2000 caractères'],
    },
    price: {
      type: Number,
      required: [true, 'Le prix du produit est obligatoire'],
      min: [0, 'Le prix ne peut pas être négatif'],
      set: (val) => Math.round(val * 100) / 100, // Arrondir à 2 décimales
      index: true,
    },
    images: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'La catégorie du produit est obligatoire'],
      ref: 'Category',
      index: true,
    },
    stock: {
      type: Number,
      required: [true, 'Le stock du produit est obligatoire'],
      min: [0, 'Le stock ne peut pas être négatif'],
      validate: {
        validator: Number.isInteger,
        message: 'Le stock doit être un nombre entier',
      },
    },
    sold: {
      type: Number,
      min: 0,
    },
    isActive: {
      type: Boolean,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Indexer les champs fréquemment recherchés
productSchema.index({
  name: 'text',
});

// Si vous filtrez souvent par catégorie ET prix en même temps
productSchema.index({ category: 1, price: 1 });

// Si vous filtrez souvent par nom, catégorie ET prix en même temps
productSchema.index({ name: 'text', category: 1, price: 1 });

// Middleware pre-save pour mettre à jour le champ updatedAt
productSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware pour vérifier le stock avant de sauvegarder
productSchema.pre('save', function (next) {
  if (this.isModified('stock') && this.stock < 0) {
    this.stock = 0;
  }
  next();
});

// Méthode pour vérifier si un produit est en stock
productSchema.methods.isInStock = function () {
  return this.stock > 0;
};

//Methode pour recuperer les produits similaires
// Méthode statique pour trouver des produits similaires
productSchema.statics.findSimilarProductsLite = function (
  categoryId,
  limit = 5,
) {
  return this.find({ category: categoryId })
    .select('name price images')
    .slice('images', 1)
    .limit(limit)
    .lean();
};

// Assurer que les modèles ne sont pas redéfinis en cas de hot-reload
const Product =
  mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;
