import mongoose, { Schema } from 'mongoose';

export interface ILLMConfig {
  name: string;
  provider: 'openai' | 'ollama' | 'huggingface' | 'custom';
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  supportsTools: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const llmConfigSchema = new Schema<ILLMConfig>(
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
    topP: { type: Number, min: 0, max: 1 },
    frequencyPenalty: { type: Number, min: -2, max: 2 },
    presencePenalty: { type: Number, min: -2, max: 2 },
    supportsTools: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model<ILLMConfig>('LLMConfig', llmConfigSchema);
