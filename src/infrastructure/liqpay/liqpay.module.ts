import { Module } from "@nestjs/common";

import { LiqpayCryptoProvider } from "./liqpay-crypto.provider";
import { LiqpayService } from "./liqpay.service";

@Module({
	providers: [LiqpayService, LiqpayCryptoProvider],
	exports: [LiqpayService],
})
export class LiqpayModule {}
