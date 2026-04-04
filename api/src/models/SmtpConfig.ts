/** SmtpConfig.ts — SMTP provider configuration (host, port, TLS, credentials, sender). */
import mongoose, { Schema, Model } from 'mongoose';

export interface ISmtpConfig {
  name: string;
  smtpHost: string;
  smtpPort: number;
  tlsMode: 'none' | 'starttls' | 'ssl';
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type ISmtpConfigModel = Model<ISmtpConfig>;

const smtpConfigSchema = new Schema<ISmtpConfig, ISmtpConfigModel>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    smtpHost: { type: String, required: true, trim: true, maxlength: 500 },
    smtpPort: { type: Number, required: true, min: 1, max: 65535 },
    tlsMode: {
      type: String,
      required: true,
      enum: ['none', 'starttls', 'ssl'],
      default: 'starttls',
    },
    smtpUser: { type: String, trim: true, maxlength: 500, default: '' },
    smtpPassword: { type: String, trim: true, maxlength: 500, default: '' },
    fromEmail: { type: String, required: true, trim: true, maxlength: 254 },
    fromName: { type: String, trim: true, maxlength: 200, default: 'PhiloGPT' },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true },
);

smtpConfigSchema.pre('save', async function () {
  if (this.isActive) {
    await SmtpConfig.updateMany({ _id: { $ne: (this as any)._id }, isActive: true }, { isActive: false });
  }
});

const SmtpConfig = mongoose.model<ISmtpConfig, ISmtpConfigModel>('SmtpConfig', smtpConfigSchema);

export default SmtpConfig;
