import { PROTO_PATHS } from "@cinema-platform/contracts";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type MicroserviceOptions, Transport } from "@nestjs/microservices";

export function createGrpcServer(app: INestApplication, config: ConfigService) {
	const host = config.getOrThrow<string>("GRPC_HOST");
	const port = config.getOrThrow<string>("GRPC_PORT");

	const url = `${host}:${port}`;

	app.connectMicroservice<MicroserviceOptions>({
		transport: Transport.GRPC,
		options: {
			package: ["payment.v1"],
			protoPath: [PROTO_PATHS.PAYMENT],
			url,
			loader: {
				keepCase: false,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
			},
		},
	});
}
