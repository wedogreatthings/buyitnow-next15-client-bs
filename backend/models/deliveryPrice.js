import mongoose from 'mongoose';

const deliveryPriceSchema = new mongoose.Schema({
  deliveryPrice: {
    type: Number,
    required: [true, 'Please enter a price'],
  },
});

export default mongoose.models.DeliveryPrice ||
  mongoose.model('DeliveryPrice', deliveryPriceSchema);
