import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBotLocale extends Document {
  botId: Types.ObjectId;
  languageCode: string;
  name?: string;
  description?: string;
  personality?: string;
  systemPrompt: string;
  createdAt: Date;
  updatedAt: Date;
}

const botLocaleSchema = new Schema<IBotLocale>(
  {
    botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true },
    languageCode: { type: String, required: true, lowercase: true, trim: true, maxlength: 10 },
    name: { type: String, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    personality: { type: String, trim: true, maxlength: 2000 },
    systemPrompt: { type: String, required: true, maxlength: 10000 },
  },
  { timestamps: true },
);

botLocaleSchema.index({ botId: 1, languageCode: 1 }, { unique: true });

export default mongoose.model<IBotLocale>('BotLocale', botLocaleSchema);
