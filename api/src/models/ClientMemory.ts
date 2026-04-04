/** ClientMemory.ts — Key-value memory store per user-bot pair, managed by the client_memory tool. */
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IClientMemory extends Document {
  userId: Types.ObjectId;
  botId: Types.ObjectId;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const clientMemorySchema = new Schema<IClientMemory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

clientMemorySchema.index({ userId: 1, botId: 1 }, { unique: true });

export default mongoose.model<IClientMemory>('ClientMemory', clientMemorySchema);
