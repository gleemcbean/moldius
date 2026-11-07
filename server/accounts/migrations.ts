import type { Database } from "./database.js";

const MIGRATION_LOCK = 72_019_331;

export const MIGRATIONS: { version: number; statements: string[] }[] = [
	{
		version: 1,
		statements: [
			`CREATE TABLE accounts (
        id uuid PRIMARY KEY,
        username text NOT NULL,
        username_key text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        display_name text NOT NULL,
        hat_color integer NOT NULL,
        games_played integer NOT NULL DEFAULT 0,
        wins integer NOT NULL DEFAULT 0,
        best_score integer NOT NULL DEFAULT 0,
        total_score integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        password_changed_at timestamptz NOT NULL DEFAULT now(),
        last_login_at timestamptz,
        CHECK (char_length(username) BETWEEN 3 AND 24),
        CHECK (char_length(display_name) BETWEEN 2 AND 18)
      )`,
			`CREATE TABLE auth_sessions (
        token_hash text PRIMARY KEY,
        account_id uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_used_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      )`,
			`CREATE INDEX auth_sessions_account_idx ON auth_sessions (account_id)`,
			`CREATE INDEX auth_sessions_expiry_idx ON auth_sessions (expires_at)`,
			`CREATE TABLE match_history (
        id uuid PRIMARY KEY,
        account_id uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        match_id text NOT NULL,
        played_at timestamptz NOT NULL,
        duration_ms integer NOT NULL,
        visibility text NOT NULL,
        player_name text NOT NULL,
        color integer NOT NULL,
        rank integer NOT NULL,
        player_count integer NOT NULL,
        score integer NOT NULL,
        captures integer NOT NULL,
        deaths integer NOT NULL,
        won boolean NOT NULL,
        UNIQUE (account_id, match_id)
      )`,
			`CREATE INDEX match_history_account_idx ON match_history (account_id, played_at DESC)`,
		],
	},
	{
		version: 2,
		statements: [
			`ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_username_key_key`,
			`ALTER TABLE accounts ALTER COLUMN username DROP NOT NULL`,
			`ALTER TABLE accounts ALTER COLUMN username_key DROP NOT NULL`,
			`ALTER TABLE accounts ADD COLUMN email text`,
			`ALTER TABLE accounts ADD COLUMN email_key text`,
			`ALTER TABLE accounts ADD COLUMN email_verified_at timestamptz`,
			`CREATE UNIQUE INDEX accounts_email_key_idx ON accounts (email_key)`,
			`CREATE TABLE pending_registrations (
        token_hash text PRIMARY KEY,
        email text NOT NULL,
        email_key text NOT NULL,
        password_hash text NOT NULL,
        display_name text NOT NULL,
        hat_color integer NOT NULL,
        created_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        CHECK (char_length(email) <= 254)
      )`,
			`CREATE INDEX pending_registrations_email_idx ON pending_registrations (email_key)`,
			`CREATE TABLE password_resets (
        token_hash text PRIMARY KEY,
        account_id uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL
      )`,
			`CREATE INDEX password_resets_account_idx ON password_resets (account_id)`,
		],
	},
	{
		version: 3,
		statements: [
			`DROP INDEX IF EXISTS accounts_email_key_idx`,
			`CREATE UNIQUE INDEX accounts_email_key_idx ON accounts (email_key) WHERE email_key IS NOT NULL`,
			`ALTER TABLE accounts ALTER COLUMN password_hash DROP NOT NULL`,
			`ALTER TABLE accounts ADD COLUMN discord_id text`,
			`ALTER TABLE accounts ADD COLUMN discord_username text`,
			`ALTER TABLE accounts ADD COLUMN discord_avatar text`,
			`CREATE UNIQUE INDEX accounts_discord_id_idx ON accounts (discord_id) WHERE discord_id IS NOT NULL`,
		],
	},
	{
		version: 4,
		statements: [
			`ALTER TABLE accounts ADD COLUMN hat_pattern text NOT NULL DEFAULT 'spots'`,
			`ALTER TABLE pending_registrations ADD COLUMN hat_pattern text NOT NULL DEFAULT 'spots'`,
		],
	},
	{
		version: 5,
		statements: [
			`ALTER TABLE accounts ADD COLUMN language text NOT NULL DEFAULT 'fr'`,
			`ALTER TABLE pending_registrations ADD COLUMN language text NOT NULL DEFAULT 'fr'`,
		],
	},
	{
		version: 6,
		statements: [
			`ALTER TABLE accounts ADD COLUMN friend_code text`,
			`CREATE UNIQUE INDEX accounts_friend_code_idx ON accounts (friend_code)`,
			`ALTER TABLE accounts ADD COLUMN appear_offline boolean NOT NULL DEFAULT false`,
			`ALTER TABLE accounts ADD COLUMN last_seen_at timestamptz`,
			`CREATE TABLE friendships (
        account_low uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        account_high uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        requester_id uuid NOT NULL,
        status text NOT NULL,
        created_at timestamptz NOT NULL,
        accepted_at timestamptz,
        PRIMARY KEY (account_low, account_high)
      )`,
			`CREATE INDEX friendships_high_idx ON friendships (account_high)`,
			`CREATE TABLE presence_samples (
        sampled_at timestamptz PRIMARY KEY,
        connected integer NOT NULL,
        signed_in integer NOT NULL,
        in_match integer NOT NULL
      )`,
		],
	},
	{
		version: 7,
		statements: [
			`ALTER TABLE accounts ADD COLUMN terms_accepted_at timestamptz`,
		],
	},
	{
		version: 8,
		statements: [
			`ALTER TABLE accounts ADD COLUMN total_captures integer NOT NULL DEFAULT 0`,
			`ALTER TABLE accounts ADD COLUMN awards_earned integer NOT NULL DEFAULT 0`,
			`ALTER TABLE accounts ADD COLUMN dailies_played integer NOT NULL DEFAULT 0`,
			`ALTER TABLE accounts ADD COLUMN lantern_tint text NOT NULL DEFAULT 'amber'`,
			`CREATE TABLE daily_scores (
        challenge_date text NOT NULL,
        account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        player_name text NOT NULL,
        color integer NOT NULL,
        pattern text NOT NULL,
        best_score integer NOT NULL,
        captures integer NOT NULL,
        deaths integer NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (challenge_date, account_id)
      )`,
			`CREATE INDEX daily_scores_rank ON daily_scores (challenge_date, best_score DESC, updated_at ASC)`,
		],
	},
	{
		version: 9,
		statements: [
			`ALTER TABLE accounts ADD COLUMN challenge_progress jsonb NOT NULL DEFAULT '{}'`,
			`UPDATE accounts SET challenge_progress = (
        '{"games":{"total":' || games_played::text || ',"best":' || LEAST(games_played, 1)::text ||
        '},"wins":{"total":' || wins::text || ',"best":' || LEAST(wins, 1)::text ||
        '},"captures":{"total":' || total_captures::text || ',"best":' || LEAST(total_captures, 1)::text ||
        '},"dailies":{"total":' || dailies_played::text || ',"best":' || LEAST(dailies_played, 1)::text || '}}'
      )::jsonb`,
		],
	},
];

export async function migrate(database: Database): Promise<number> {
	await database.query(
		`CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`,
	);
	return database.transaction(async (client) => {
		await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK]);
		const { rows } = await client.query<{ version: number }>(
			"SELECT version FROM schema_migrations",
		);
		const applied = new Set(rows.map((row) => Number(row.version)));
		let count = 0;
		for (const migration of MIGRATIONS) {
			if (applied.has(migration.version)) {
				continue;
			}
			for (const statement of migration.statements) {
				await client.query(statement);
			}
			await client.query(
				"INSERT INTO schema_migrations (version) VALUES ($1)",
				[migration.version],
			);
			count += 1;
		}
		return count;
	});
}
