import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./core/app.module";
import { createGrpcServer } from "./core/bootstrap/grpc";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	const config = app.get(ConfigService);

	createGrpcServer(app, config);

	await app.startAllMicroservices();
	await app.init();
}
bootstrap();
