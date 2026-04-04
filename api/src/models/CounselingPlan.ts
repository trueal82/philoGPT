/** CounselingPlan.ts — Session-scoped counseling plan with structured steps. */
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICounselingStep {
  stepId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  evidence?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ICounselingPlan extends Document {
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  botId: Types.ObjectId;
  title: string;
  steps: ICounselingStep[];
  createdAt: Date;
  updatedAt: Date;
}

const counselingStepSchema = new Schema<ICounselingStep>(
  {
    stepId: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 500 },
    description: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
    evidence: { type: String, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { _id: false },
);

const counselingPlanSchema = new Schema<ICounselingPlan>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'ChatSession', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true },
    title: { type: String, trim: true, maxlength: 500, default: 'Counseling Plan' },
    steps: { type: [counselingStepSchema], default: [] },
  },
  { timestamps: true },
);

counselingPlanSchema.index({ sessionId: 1, userId: 1, botId: 1 }, { unique: true });

export default mongoose.model<ICounselingPlan>('CounselingPlan', counselingPlanSchema);
