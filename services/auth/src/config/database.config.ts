import { registerAs } from '@nestjs/config';
import { databaseConnection } from '../database/connection';
export default registerAs('database', () => ({ type: 'postgres', ...databaseConnection(), schema: 'auth', synchronize: false }));
