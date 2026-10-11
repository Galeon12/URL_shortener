import mongoose from 'mongoose';
import config from 'config';
const db = config.get('mongoURI');

let isConnected = false;

const connectDB = async () => {
  try {
    await mongoose.connect(db, {
      serverSelectionTimeoutMS: 5000
    });

    isConnected = true;
    console.log('MongoDB Connected successfully...');
  } catch (err) {
    isConnected = false;
    console.warn(`MongoDB Atlas connection warning: ${err.message}`);
    console.warn('Falling back to local persistent storage mode for seamless operation.');
  }
};

export const getDBStatus = () => isConnected;
export default connectDB;
