/** SystemPrompt.ts — Global system prompt injected into every LLM conversation. */
import mongoose, { Document, Schema, Model } from 'mongoose';
import { createLogger } from '../config/logger';

const log = createLogger('system-prompt');

export interface ISystemPrompt extends Document {
  content: string;
  locales: Map<string, string>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type ISystemPromptModel = Model<ISystemPrompt>;

const systemPromptSchema = new Schema<ISystemPrompt, ISystemPromptModel>(
  {
    content: { type: String, required: true, maxlength: 50000 },
    locales: { type: Map, of: { type: String, maxlength: 50000 }, default: new Map() },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Ensure only one active system prompt exists
systemPromptSchema.pre('save', async function () {
  if (this.isActive) {
    await SystemPrompt.updateMany({ _id: { $ne: this._id }, isActive: true }, { isActive: false });
  }
});

const SystemPrompt = mongoose.model<ISystemPrompt, ISystemPromptModel>(
  'SystemPrompt',
  systemPromptSchema,
);

export default SystemPrompt;
