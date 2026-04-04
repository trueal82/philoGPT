/** ToolCallLog.ts — Audit log for every tool invocation during chat. */
import mongoose, { Schema, Types } from 'mongoose';

export interface IToolCallLog {
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  botId: Types.ObjectId;
  botName: string;
  toolName: string;
  toolDisplayName?: string;
  inputParams: Record<string, unknown>;
  outputResult: string;
  executionTimeMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const toolCallLogSchema = new Schema<IToolCallLog>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'ChatSession', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true },
    botName: { type: String, required: true, trim: true, maxlength: 200 },
    toolName: { type: String, required: true, trim: true, maxlength: 100 },
    toolDisplayName: { type: String, trim: true, maxlength: 200 },
    inputParams: { type: Schema.Types.Mixed, default: {} },
    outputResult: { type: String, maxlength: 50000, default: '' },
    executionTimeMs: { type: Number, default: 0 },
    status: { type: String, enum: ['success', 'error'], default: 'success' },
    errorMessage: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

toolCallLogSchema.index({ createdAt: -1 });

export default mongoose.model<IToolCallLog>('ToolCallLog', toolCallLogSchema);
