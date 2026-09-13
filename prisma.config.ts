import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { defineConfig } from "prisma/config";

const isProduction = process.env.NODE_ENV === "production";

if (!isProduction) {
	const envName = process.env.NODE_ENV || "development";
	const envFileName = `.env.${envName}.local`;
	const envPath = path.resolve(process.cwd(), envFileName);

	if (fs.existsSync(envPath)) {
		dotenv.config({ path: envPath });
		console.log(`[Prisma Config] Loaded environment from ${envFileName}`);
	} else {
		const fallbackPath = path.resolve(process.cwd(), ".env");
		if (fs.existsSync(fallbackPath)) {
			dotenv.config({ path: fallbackPath });
			console.log(
				`[Prisma Config] Loaded fallback environment from .env`,
			);
		}
	}
} else {
	console.log(
		"[Prisma Config] Running in production. Using system environment variables.",
	);
}

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: process.env["DATABASE_URI"]!,
	},
});
