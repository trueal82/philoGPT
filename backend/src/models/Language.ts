import mongoose, { Document, Schema } from 'mongoose';

export interface ILanguage extends Document {
  code: string;
  name: string;
  nativeName: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const languageSchema = new Schema<ILanguage>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 10,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nativeName: { type: String, required: true, trim: true, maxlength: 100 },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model<ILanguage>('Language', languageSchema);
