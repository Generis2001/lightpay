import { MigrationInterface, QueryRunner } from 'typeorm';
export class OtpChallenges1794096001000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('CREATE TABLE IF NOT EXISTS auth.otp_challenges (key varchar(64) PRIMARY KEY, code_hash varchar(64) NOT NULL, expires_at timestamptz NOT NULL, attempts smallint NOT NULL DEFAULT 0, used_at timestamptz)');
  }
  async down(): Promise<void> { throw new Error('Use a reviewed forward migration'); }
}
