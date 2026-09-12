import { PROTO_PATHS } from "@cinema-platform/contracts";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { LoggerModule } from "nestjs-pino";

import { LiqpayModule } from "@/infrastructure/liqpay/liqpay.module";
import { PrismaModule } from "@/infrastructure/prisma/prisma.module";
import { PaymentModule } from "@/modules/payment/payment.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		ClientsModule.registerAsync([
			{
				name: "BOOKING_PACKAGE",
				useFactory: (configService: ConfigService) => ({
					transport: Transport.GRPC,
					options: {
						package: "booking.v1",
						protoPath: PROTO_PATHS.BOOKING,
						url: configService.getOrThrow<string>(
							"BOOKING_GRPC_URL",
						),
					},
				}),
				inject: [ConfigService],
			},
		]),
		LoggerModule.forRoot(),
		PrismaModule,
		PaymentModule,
		LiqpayModule,
	],
})
export class AppModule {}
