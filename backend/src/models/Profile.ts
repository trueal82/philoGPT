import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProfile extends Document {
  userId: Types.ObjectId;
  name: string;
  avatar?: string;
  bio?: string;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const profileSchema = new Schema<IProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    avatar: { type: String, maxlength: 2048 },
    bio: { type: String, trim: true, maxlength: 500 },
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto',
      },
      language: { type: String, default: 'en', maxlength: 10 },
    },
  },
  { timestamps: true },
);

export default mongoose.model<IProfile>('Profile', profileSchema);
