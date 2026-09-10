import type {
	CreatePaymentRequest,
	CreatePaymentResponse,
	ProcessPaymentEventRequest,
	ProcessPaymentEventResponse,
	RawCallbackRequest,
	RefundPaymentRequest,
	RefundPaymentResponse,
} from "@cinema-platform/contracts/gen/ts/payment";
import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";

import { PaymentService } from "./payment.service";

@Controller()
export class PaymentController {
	public constructor(private readonly paymentService: PaymentService) {}

	@GrpcMethod("PaymentService", "CreatePayment")
	public async createPayment(
		data: CreatePaymentRequest,
	): Promise<CreatePaymentResponse> {
		return this.paymentService.createPayment(data);
	}

	@GrpcMethod("PaymentService", "VerifyPaymentCallback")
	public async verifyPaymentCallback(
		data: RawCallbackRequest,
	): Promise<ProcessPaymentEventResponse> {
		return this.paymentService.verifyCallback(data);
	}

	@GrpcMethod("PaymentService", "ProcessPaymentEvent")
	public async processPaymentEvent(
		data: ProcessPaymentEventRequest,
	): Promise<ProcessPaymentEventResponse> {
		return this.paymentService.processEvent(data);
	}

	@GrpcMethod("PaymentService", "RefundPayment")
	public async refundPayment(
		data: RefundPaymentRequest,
	): Promise<RefundPaymentResponse> {
		return this.paymentService.refundPayment(data);
	}
}
