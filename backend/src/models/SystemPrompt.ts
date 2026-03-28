import mongoose, { Document, Schema, Model } from 'mongoose';
import { createLogger } from '../config/logger';

const log = createLogger('system-prompt');

export interface ISystemPrompt extends Document {
  content: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type ISystemPromptModel = Model<ISystemPrompt>;

const systemPromptSchema = new Schema<ISystemPrompt, ISystemPromptModel>(
  {
    content: { type: String, required: true, maxlength: 50000 },
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

/**
 * Seed the default system prompt if none exists.
 * Call this explicitly at startup instead of as a module-level side effect.
 */
export async function ensureDefaultSystemPrompt(): Promise<void> {
  const existing = await SystemPrompt.findOne({ isActive: true });
  if (!existing) {
    await SystemPrompt.create({
      content: 'You are a helpful AI assistant. Respond clearly and accurately to user queries.',
      isActive: true,
    });
    log.info('Default system prompt created');
  } else {
    log.debug('Active system prompt already exists');
  }
}

export default SystemPrompt;
