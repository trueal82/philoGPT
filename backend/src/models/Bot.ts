/** Bot.ts — Mongoose model for philosopher bots (avatar, subscriptions). Localizable fields live in BotLocale. */
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBot extends Document {
  avatar?: string;
  availableToSubscriptionIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const botSchema = new Schema<IBot>(
  {
    avatar: { type: String, maxlength: 2048, default: '🧠' },
    availableToSubscriptionIds: [
      { type: Schema.Types.ObjectId, ref: 'Subscription' },
    ],
  },
  { timestamps: true },
);

export default mongoose.model<IBot>('Bot', botSchema);
