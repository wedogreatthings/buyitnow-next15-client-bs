import mongoose from 'mongoose';
import slug from 'mongoose-slug-updater';

// Initialiser le plugin de slug
mongoose.plugin(slug);

const categorySchema = new mongoose.Schema(
  {
    categoryName: {
      type: String,
      required: [true, 'Le nom de la catégorie est obligatoire'],
      trim: true,
      maxlength: [
        50,
        'Le nom de la catégorie ne peut pas dépasser 50 caractères',
      ],
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      slug: 'categoryName',
      unique: true,
      index: true,
    },
    sold: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
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
    // toJSON: { virtuals: true },
    // toObject: { virtuals: true },
  },
);

// Index pour la recherche textuelle
categorySchema.index({ categoryName: 'text' });

// Virtual pour récupérer les produits dans cette catégorie
// categorySchema.virtual('products', {
//   ref: 'Product',
//   localField: '_id',
//   foreignField: 'category',
// });

// Middleware pre-save pour mettre à jour le champ updatedAt
categorySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Assurer que les modèles ne sont pas redéfinis en cas de hot-reload
const Category =
  mongoose.models.Category || mongoose.model('Category', categorySchema);

export default Category;
