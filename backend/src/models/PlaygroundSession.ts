import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPlaygroundSession extends Document {
  userId: Types.ObjectId;
  botId: Types.ObjectId;
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;
}

const playgroundSessionSchema = new Schema<IPlaygroundSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true },
    sessionId: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export default mongoose.model<IPlaygroundSession>('PlaygroundSession', playgroundSessionSchema);
