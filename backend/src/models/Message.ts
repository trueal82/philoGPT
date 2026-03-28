import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMessage extends Document {
  sessionId: Types.ObjectId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Map<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'ChatSession', required: true, index: true },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: { type: String, required: true, maxlength: 50000 },
    metadata: { type: Map, of: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export default mongoose.model<IMessage>('Message', messageSchema);
