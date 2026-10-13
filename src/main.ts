// sort-imports-ignore
import "./core/bootstrap/tracing";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";

import { AppModule } from "./core/app.module";
import { createGrpcServer } from "./core/bootstrap/grpc";

async function bootstrap() {
	const app = await NestFactory.create(AppModule, { bufferLogs: true });

	app.useLogger(app.get(Logger));

	const config = app.get(ConfigService);

	createGrpcServer(app, config);

	await app.startAllMicroservices();
	await app.listen(process.env.METRICS_PORT ?? 9104);
}
bootstrap();
