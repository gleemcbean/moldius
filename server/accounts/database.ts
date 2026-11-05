import pg from "pg";

export interface QueryResult<Row> {
	rows: Row[];
}

export interface Queryable {
	query<Row extends object = Record<string, unknown>>(
		text: string,
		values?: unknown[],
	): Promise<QueryResult<Row>>;
}

export interface Database extends Queryable {
	transaction<T>(work: (client: Queryable) => Promise<T>): Promise<T>;
	close(): Promise<void>;
}

export interface DatabaseOptions {
	connectionString: string;
	ssl: boolean | "no-verify";
	maxConnections: number;
}

interface PoolLike {
	query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
	connect(): Promise<ClientLike>;
	end(): Promise<void>;
}

interface ClientLike {
	query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
	release(error?: Error): void;
}

export function databaseFromPool(pool: PoolLike): Database {
	const run = async <Row>(
		target: Pick<PoolLike, "query">,
		text: string,
		values?: unknown[],
	) => {
		const result = await target.query(text, values);
		return { rows: result.rows as Row[] };
	};
	return {
		query: (text, values) => run(pool, text, values),
		transaction: async (work) => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const value = await work({
					query: (text, values) => run(client, text, values),
				});
				await client.query("COMMIT");
				client.release();
				return value;
			} catch (error) {
				await client.query("ROLLBACK").catch(() => undefined);
				client.release(error instanceof Error ? error : undefined);
				throw error;
			}
		},
		close: () => pool.end(),
	};
}

export function createDatabase(options: DatabaseOptions): Database {
	const pool = new pg.Pool({
		connectionString: options.connectionString,
		ssl:
			options.ssl === false
				? undefined
				: { rejectUnauthorized: options.ssl !== "no-verify" },
		max: options.maxConnections,
		idleTimeoutMillis: 30_000,
		connectionTimeoutMillis: 5_000,
		statement_timeout: 5_000,
		query_timeout: 8_000,
		application_name: "mycelium",
	});
	pool.on("error", (error) => {
		console.error("PostgreSQL : connexion inactive interrompue", error.message);
	});
	return databaseFromPool(pool);
}

export function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { code?: unknown }).code === "23505"
	);
}
