import mongoose, { Document, Schema } from 'mongoose';

export interface IUserGroup extends Document {
  name: string;
  description?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userGroupSchema = new Schema<IUserGroup>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model<IUserGroup>('UserGroup', userGroupSchema);
