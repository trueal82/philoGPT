/** SeedVersion.ts — Tracks which seed data patches have been applied. */
import mongoose, { Schema } from 'mongoose';

export interface ISeedVersion {
  version: string;
  description: string;
  appliedAt: Date;
}

const seedVersionSchema = new Schema<ISeedVersion>(
  {
    version: { type: String, required: true, unique: true, trim: true, maxlength: 20 },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    appliedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

export default mongoose.model<ISeedVersion>('SeedVersion', seedVersionSchema);
