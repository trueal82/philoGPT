import dotenv from 'dotenv';

dotenv.config();

export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/philogpt';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nimda123';
