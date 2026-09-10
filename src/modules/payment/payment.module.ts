import { Module } from "@nestjs/common";

import { LiqpayModule } from "@/infrastructure/liqpay/liqpay.module";

import { PaymentController } from "./payment.controller";
import { PaymentRepository } from "./payment.repository";
import { PaymentService } from "./payment.service";

@Module({
	imports: [LiqpayModule],
	controllers: [PaymentController],
	providers: [PaymentService, PaymentRepository],
})
export class PaymentModule {}
