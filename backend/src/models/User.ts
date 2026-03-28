import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export interface IUser extends Document {
  email: string;
  password?: string;
  provider: 'local' | 'google' | 'github' | 'facebook';
  providerId?: string;
  role: 'user' | 'admin';
  languageCode: string;
  userGroupId?: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  isLocked: boolean;
  lockedAt?: Date;
  lockedReason?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

type IUserModel = Model<IUser>;

const userSchema = new Schema<IUser, IUserModel>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    password: {
      type: String,
      required: function (this: IUser) {
        return this.provider === 'local';
      },
      minlength: 8,
    },
    provider: {
      type: String,
      enum: ['local', 'google', 'github', 'facebook'],
      default: 'local',
    },
    providerId: { type: String },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    languageCode: {
      type: String,
      required: true,
      default: 'en-us',
      lowercase: true,
      trim: true,
      maxlength: 10,
    },
    userGroupId: { type: Schema.Types.ObjectId, ref: 'UserGroup' },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    isLocked: { type: Boolean, default: false, index: true },
    lockedAt: { type: Date },
    lockedReason: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  this.password = await bcrypt.hash(this.password as string, salt);
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password as string);
};

// Never return password in JSON
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    return ret;
  },
});

export default mongoose.model<IUser, IUserModel>('User', userSchema);
