import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { LiqpayModule } from "@/infrastructure/liqpay/liqpay.module";
import { PrismaModule } from "@/infrastructure/prisma/prisma.module";
import { PaymentModule } from "@/modules/payment/payment.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		PrismaModule,
		PaymentModule,
		LiqpayModule,
	],
})
export class AppModule {}
