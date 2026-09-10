import { PrismaClient } from "@generated/client";
import {
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";

@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	private readonly logger = new Logger(PrismaService.name);

	public constructor(private readonly configService: ConfigService) {
		const adapter = new PrismaPg({
			user: configService.getOrThrow("DATABASE_USERNAME"),
			password: configService.getOrThrow("DATABASE_PASSWORD"),
			host: configService.getOrThrow("DATABASE_HOST"),
			port: configService.getOrThrow("DATABASE_PORT"),
			database: configService.getOrThrow("DATABASE_NAME"),
		});

		super({ adapter });
	}

	public async onModuleInit() {
		const start = Date.now();
		this.logger.log("Connecting to database...");

		try {
			await this.$connect();
			const ms = Date.now() - start;

			this.logger.log(`Database connection established (time=${ms}ms)`);
		} catch (error) {
			this.logger.error("Failed to connect to database: ", error);

			throw error;
		}
	}

	public onModuleDestroy() {}
}
