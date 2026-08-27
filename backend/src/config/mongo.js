import mongoose from 'mongoose';

export async function connectMongo() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/resumematch';
  
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ MongoDB connected successfully (Mongoose)');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.warn('⚠️ Server will run, but document features requiring MongoDB may fail until database is up.');
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected.');
  });
}

export default mongoose;
