import mongoose from 'mongoose';

const paymentTypeSchema = new mongoose.Schema({
  paymentName: {
    type: String,
    required: true,
  },
  paymentNumber: {
    type: String,
    required: true,
  },
});

export default mongoose.models.PaymentType ||
  mongoose.model('PaymentType', paymentTypeSchema);
