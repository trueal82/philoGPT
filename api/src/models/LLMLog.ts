/** LLMLog.ts — Persists every LLM request/response pair for admin review. */
import mongoose, { Schema, Types } from 'mongoose';

export interface ILLMLog {
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  botId: Types.ObjectId;
  botName: string;
  model: string;
  provider: string;
  toolRound: number;
  requestMessages: unknown[];
  responseType: 'response' | 'tool_calls';
  responseContent: string;
  responseToolCalls: unknown[];
  thinkingContent: string;
  stats: Record<string, unknown>;
  expireAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const llmLogSchema = new Schema<ILLMLog>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'ChatSession', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true, index: true },
    botName: { type: String, required: true, trim: true, maxlength: 200 },
    model: { type: String, required: true, trim: true, maxlength: 200 },
    provider: { type: String, required: true, trim: true, maxlength: 50 },
    toolRound: { type: Number, default: 0 },
    requestMessages: { type: Schema.Types.Mixed, default: [] },
    responseType: { type: String, enum: ['response', 'tool_calls'], required: true },
    responseContent: { type: String, default: '' },
    responseToolCalls: { type: Schema.Types.Mixed, default: [] },
    thinkingContent: { type: String, default: '' },
    stats: { type: Schema.Types.Mixed, default: {} },
    expireAt: { type: Date, default: null },
  },
  { timestamps: true },
);

llmLogSchema.index({ createdAt: -1 });
// TTL index: MongoDB auto-deletes docs when expireAt is reached.
// Documents with expireAt=null are skipped by the TTL thread.
llmLogSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<ILLMLog>('LLMLog', llmLogSchema);
