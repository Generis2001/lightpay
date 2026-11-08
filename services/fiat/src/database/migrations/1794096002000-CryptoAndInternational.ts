import { MigrationInterface, QueryRunner } from 'typeorm';
export class CryptoAndInternational1794096002000 implements MigrationInterface {
 async up(runner: QueryRunner): Promise<void> {
  await runner.query("ALTER TABLE fiat.wallets ALTER COLUMN balance TYPE numeric(38,18)");
  await runner.query("ALTER TABLE fiat.wallets ALTER COLUMN ledger_balance TYPE numeric(38,18)");
  await runner.query("ALTER TABLE fiat.transactions ALTER COLUMN amount TYPE numeric(38,18)");
  await runner.query("ALTER TABLE fiat.transactions ALTER COLUMN fee TYPE numeric(38,18)");
  await runner.query("ALTER TABLE fiat.transactions ALTER COLUMN balance_before TYPE numeric(38,18)");
  await runner.query("ALTER TABLE fiat.transactions ALTER COLUMN balance_after TYPE numeric(38,18)");
  await runner.query("CREATE TABLE IF NOT EXISTS \"fiat\".\"international_quotes\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"user_id\" uuid NOT NULL, \"request\" jsonb NOT NULL, \"source_amount\" numeric(20,2) NOT NULL, \"fee\" numeric(20,2) NOT NULL, \"destination_amount\" numeric(20,2) NOT NULL, \"destination_currency\" character varying(10) NOT NULL, \"expires_at\" TIMESTAMP WITH TIME ZONE NOT NULL, \"transaction_id\" uuid, CONSTRAINT \"PK_b78e513cb72c0c82f954bbc76e4\" PRIMARY KEY (\"id\"))");
  await runner.query("CREATE TABLE IF NOT EXISTS \"fiat\".\"crypto_accounts\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"user_id\" uuid NOT NULL, \"vault_id\" character varying(100) NOT NULL, CONSTRAINT \"UQ_1ec23a1cddc89978360841cd327\" UNIQUE (\"user_id\"), CONSTRAINT \"UQ_63d947c8ed719f677f012ad1c54\" UNIQUE (\"vault_id\"), CONSTRAINT \"PK_0b77b2e19005e83579c3d4a87a6\" PRIMARY KEY (\"id\"))");
  await runner.query("CREATE TABLE IF NOT EXISTS \"fiat\".\"crypto_addresses\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"user_id\" uuid NOT NULL, \"wallet_id\" uuid NOT NULL, \"symbol\" character varying(10) NOT NULL, \"network\" character varying(50) NOT NULL, \"asset_id\" character varying(100) NOT NULL, \"address\" character varying(255) NOT NULL, \"tag\" character varying(255), CONSTRAINT \"UQ_2d7e30fc0a5e3d2913932cf84ec\" UNIQUE (\"wallet_id\"), CONSTRAINT \"PK_ef4ad64fd903d750cd400dd280b\" PRIMARY KEY (\"id\"))");
  await runner.query("CREATE UNIQUE INDEX IF NOT EXISTS \"IDX_a6e1d27e84ddfece7b85de1085\" ON \"fiat\".\"crypto_addresses\" (\"user_id\", \"symbol\", \"network\") ");
  await runner.query("CREATE TABLE IF NOT EXISTS \"fiat\".\"crypto_quotes\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"user_id\" uuid NOT NULL, \"wallet_id\" uuid NOT NULL, \"symbol\" character varying(10) NOT NULL, \"network\" character varying(50) NOT NULL, \"address\" character varying(255) NOT NULL, \"tag\" character varying(255), \"amount\" numeric(38,18) NOT NULL, \"estimated_fee\" numeric(38,18) NOT NULL, \"expires_at\" TIMESTAMP WITH TIME ZONE NOT NULL, \"transaction_id\" uuid, CONSTRAINT \"PK_2a85c6724c0eba229a31f35078d\" PRIMARY KEY (\"id\"))");
 }
 async down(): Promise<void> { throw new Error('Use a reviewed forward migration; retain ledger data'); }
}
