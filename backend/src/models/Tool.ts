import mongoose, { Document, Schema } from 'mongoose';

export interface ITool extends Document {
  name: string;
  displayName: string;
  description: string;
  type: 'wikipedia' | 'client_memory';
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const toolSchema = new Schema<ITool>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    displayName: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    type: {
      type: String,
      required: true,
      enum: ['wikipedia', 'client_memory'],
    },
    enabled: { type: Boolean, default: false },
    config: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default mongoose.model<ITool>('Tool', toolSchema);
