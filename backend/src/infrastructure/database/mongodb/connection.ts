import mongoose from 'mongoose';
import { env } from '../../../config/env';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

mongoose.set('strictQuery', true);

export async function connectMongoDB(): Promise<typeof mongoose> {
  if (!env.mongoUri) {
    throw new Error(
      'MONGO_URI no está definida. Configure la cadena de conexión de MongoDB Atlas en .env',
    );
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 20,
      });

      console.log('[MongoDB] Conexión establecida con Atlas');

      mongoose.connection.on('error', (error) => {
        console.error('[MongoDB] Error de conexión:', error);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('[MongoDB] Desconectado de Atlas');
      });

      return mongoose;
    } catch (error) {
      lastError = error;
      console.error(
        `[MongoDB] Intento ${attempt}/${MAX_RETRIES} fallido:`,
        error instanceof Error ? error.message : error,
      );

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw new Error(
    `No se pudo conectar a MongoDB Atlas tras ${MAX_RETRIES} intentos: ${
      lastError instanceof Error ? lastError.message : 'Error desconocido'
    }`,
  );
}

export async function disconnectMongoDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[MongoDB] Conexión cerrada');
  }
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
