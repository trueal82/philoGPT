/** ChatSession.ts — A conversation session between a user and a bot, with language locking. */
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IChatSession extends Document {
  userId: Types.ObjectId;
  botId: Types.ObjectId;
  title?: string;
  lockedLanguageCode: string;
  /** Wikipedia summary for the bot's character, fetched at session creation. */
  characterBackground?: string;
  createdAt: Date;
  updatedAt: Date;
}

const chatSessionSchema = new Schema<IChatSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true },
    title: { type: String, trim: true, maxlength: 200 },
    lockedLanguageCode: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 10,
    },
    characterBackground: {
      type: String,
      trim: true,
      maxlength: 8000,
    },
  },
  { timestamps: true },
);

export default mongoose.model<IChatSession>('ChatSession', chatSessionSchema);
