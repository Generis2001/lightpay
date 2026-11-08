import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseConnection } from './connection';

export const createDatabaseSource = (connection = databaseConnection()) => new DataSource({
  type: 'postgres', ...connection, schema: 'auth',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'], migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false, migrationsRun: false,
});
export default createDatabaseSource;
