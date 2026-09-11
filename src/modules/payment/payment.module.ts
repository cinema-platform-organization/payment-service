import { PROTO_PATHS } from "@cinema-platform/contracts";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";

import { BookingClientGrpc } from "@/clients/booking.client";
import { LiqpayModule } from "@/infrastructure/liqpay/liqpay.module";

import { PaymentController } from "./payment.controller";
import { PaymentRepository } from "./payment.repository";
import { PaymentService } from "./payment.service";

@Module({
	imports: [
		LiqpayModule,
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
	],
	controllers: [PaymentController],
	providers: [PaymentService, PaymentRepository, BookingClientGrpc],
})
export class PaymentModule {}
