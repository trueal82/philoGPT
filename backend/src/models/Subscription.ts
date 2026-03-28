/** Subscription.ts — Subscription tiers with feature flags. */
import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscription extends Document {
  name: string;
  description?: string;
  active: boolean;
  featureFlags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    active: { type: Boolean, default: true },
    featureFlags: { type: [String], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model<ISubscription>('Subscription', subscriptionSchema);
