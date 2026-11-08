import { config } from 'dotenv';

export function databaseConnection() {
  // Hosting variables override local files; CLI migrations use the same files as Nest.
  config({ path: ['.env.local', '.env'], override: false });
  const ssl = process.env.DATABASE_SSL === 'false' ? false : process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : false;
  return {
    ...(process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : {
      host: process.env.POSTGRES_HOST ?? 'localhost', port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'lightpay', password: process.env.POSTGRES_PASSWORD ?? 'lightpay_dev_secret', database: process.env.POSTGRES_DB ?? 'lightpay',
    }), ssl,
  };
}
