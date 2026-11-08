import { MigrationInterface, QueryRunner } from 'typeorm';
export class IdentityChecks1794096003000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('CREATE TABLE IF NOT EXISTS auth.identity_checks (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL, type varchar(10) NOT NULL, identity_hash varchar(64) UNIQUE NOT NULL, last_digits varchar(4) NOT NULL, evidence jsonb NOT NULL DEFAULT \'{}\', consented_at timestamptz NOT NULL, verified_at timestamp NOT NULL DEFAULT now())');
    await runner.query('CREATE UNIQUE INDEX IF NOT EXISTS identity_check_user_type_unique ON auth.identity_checks (user_id, type)');
  }
  async down(): Promise<void> { throw new Error('Use a reviewed forward migration'); }
}
