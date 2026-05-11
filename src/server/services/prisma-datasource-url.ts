import path from "node:path";

const SQLITE_FILE_PREFIX = "file:";

function isAbsoluteSqlitePath(pathname: string) {
	return (
		path.isAbsolute(pathname) ||
		pathname.startsWith("/") ||
		/^[A-Za-z]:[\\/]/.test(pathname)
	);
}

export function resolvePrismaDatasourceUrl(
	databaseUrl: string,
	cwd = process.cwd(),
) {
	if (!databaseUrl.startsWith(SQLITE_FILE_PREFIX)) {
		return databaseUrl;
	}

	const sqlitePath = databaseUrl.slice(SQLITE_FILE_PREFIX.length);
	if (sqlitePath === ":memory:" || isAbsoluteSqlitePath(sqlitePath)) {
		return databaseUrl;
	}

	const schemaDir = path.join(cwd, "prisma");
	const resolvedPath = path.resolve(schemaDir, sqlitePath);

	return `${SQLITE_FILE_PREFIX}${resolvedPath}`;
}
