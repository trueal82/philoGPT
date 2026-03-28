/** Bot.ts — Mongoose model for philosopher bots (avatar, personality, system prompt, LLM config). */
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBot extends Document {
  name: string;
  description?: string;
  personality?: string;
  systemPrompt: string;
  avatar?: string;
  llmConfigId?: Types.ObjectId;
  availableToSubscriptionIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const botSchema = new Schema<IBot>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    personality: { type: String, trim: true, maxlength: 2000 },
    systemPrompt: { type: String, required: true, maxlength: 10000 },
    avatar: { type: String, maxlength: 2048, default: '🧠' },
    llmConfigId: { type: Schema.Types.ObjectId, ref: 'LLMConfig' },
    availableToSubscriptionIds: [
      { type: Schema.Types.ObjectId, ref: 'Subscription' },
    ],
  },
  { timestamps: true },
);

export default mongoose.model<IBot>('Bot', botSchema);
