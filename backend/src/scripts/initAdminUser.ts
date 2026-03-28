import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createLogger } from '../config/logger';
import { ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI } from '../config/seedConfig';

const log = createLogger('init-admin');

async function initAdmin(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    log.info('Connected to MongoDB');

    const db = mongoose.connection;
    const usersCollection = db.collection('users');

    const existingAdmin = await usersCollection.findOne({ email: ADMIN_EMAIL });
    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);
      await usersCollection.insertOne({
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        provider: 'local',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      log.info({ email: ADMIN_EMAIL }, 'Created default admin user');
    } else {
      log.info('Admin user already exists');
    }
  } finally {
    await mongoose.connection.close();
    log.info('Database connection closed');
  }
}

initAdmin().catch((err: Error) => {
  log.error({ err }, 'Init admin failed');
  process.exit(1);
});
