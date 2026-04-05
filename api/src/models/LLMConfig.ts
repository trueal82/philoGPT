/** LLMConfig.ts — LLM provider configuration (model, API URL, temperature, tool support, etc.). */
import mongoose, { Schema, Model } from 'mongoose';

export interface ILLMConfig {
  name: string;
  provider: 'openai' | 'ollama' | 'huggingface' | 'custom';
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  contextWindow?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  supportsTools: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type ILLMConfigModel = Model<ILLMConfig>;

const llmConfigSchema = new Schema<ILLMConfig, ILLMConfigModel>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    provider: {
      type: String,
      required: true,
      enum: ['openai', 'ollama', 'huggingface', 'custom'],
    },
    apiKey: { type: String, trim: true, maxlength: 500 },
    apiUrl: { type: String, trim: true, maxlength: 2048 },
    model: { type: String, trim: true, maxlength: 100 },
    temperature: { type: Number, min: 0, max: 2 },
    maxTokens: { type: Number, min: 1, max: 128000 },
    contextWindow: { type: Number, min: 1, max: 10000000 },
    topP: { type: Number, min: 0, max: 1 },
    frequencyPenalty: { type: Number, min: -2, max: 2 },
    presencePenalty: { type: Number, min: -2, max: 2 },
    supportsTools: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true },
);

llmConfigSchema.pre('save', async function () {
  if (this.isActive) {
    await LLMConfig.updateMany({ _id: { $ne: (this as any)._id }, isActive: true }, { isActive: false });
  }
});

const LLMConfig = mongoose.model<ILLMConfig, ILLMConfigModel>('LLMConfig', llmConfigSchema);

export default LLMConfig;
