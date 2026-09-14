import { RpcStatus } from "@cinema-platform/common";
import type {
	CreatePaymentRequest,
	CreatePaymentResponse,
	ProcessPaymentEventRequest,
	ProcessPaymentEventResponse,
	RawCallbackRequest,
	RefundPaymentRequest,
	RefundPaymentResponse,
} from "@cinema-platform/contracts/gen/ts/payment";
import { Prisma } from "@generated/client";
import { PaymentStatus } from "@generated/enums";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import { PinoLogger } from "nestjs-pino";

import { BookingClientGrpc } from "@/clients/booking.client";
import { LiqpayService } from "@/infrastructure/liqpay/liqpay.service";

import {
	isFailureStatus,
	isRefundSuccessStatus,
	isSuccessStatus,
} from "./payment.constants";
import { PaymentRepository } from "./payment.repository";

@Injectable()
export class PaymentService {
	private readonly HOSTS_APP: string;
	private readonly API_URL: string;
	private readonly SANDBOX: 0 | 1 | undefined;

	public constructor(
		private readonly logger: PinoLogger,
		private readonly repository: PaymentRepository,
		private readonly configService: ConfigService,
		private readonly liqpayService: LiqpayService,
		private readonly bookingClient: BookingClientGrpc,
	) {
		this.logger.setContext(PaymentService.name);
		this.HOSTS_APP = this.configService.getOrThrow<string>("HOSTS_APP");
		this.API_URL = this.configService.getOrThrow<string>("API_URL");
		this.SANDBOX =
			this.configService.get("NODE_ENV") === "production" ? 0 : 1;
	}

	public async createPayment(
		data: CreatePaymentRequest,
	): Promise<CreatePaymentResponse> {
		const { userId, screeningId, seats, savePaymentMethod } = data;

		const reservation = await this.bookingClient.createReservation({
			userId,
			screeningId,
			seats,
		});

		const transaction = await this.repository.createPayment({
			amount: reservation.amount,
			userId,
			providerId: "LIQPAY",
		});

		const url = this.liqpayService.createPaymentUrl({
			amount: transaction.amount,
			currency: "UAH",
			description: `Payment for tickets to screening ${screeningId}`,
			order_id: transaction.id,
			customer: userId,
			info: reservation.orderId,
			server_url: `${this.API_URL}/webhook/liqpay`,
			result_url: `${this.HOSTS_APP}/account/tickets`,
			sandbox: this.SANDBOX,
			...(savePaymentMethod ? { recurringbytoken: "1" } : {}),
		});

		return { url };
	}

	public async verifyCallback(
		data: RawCallbackRequest,
	): Promise<ProcessPaymentEventResponse> {
		const { data: rawData, signature } = data;

		if (!this.liqpayService.verifyCallback(rawData, signature)) {
			throw new RpcException({
				code: RpcStatus.UNAUTHENTICATED,
				details: "Invalid LiqPay signature",
			});
		}

		const decoded = this.liqpayService.decodeCallback(rawData);

		return this.processEvent({
			paymentId: decoded.order_id,
			status: decoded.status,
			bookingId: decoded.info ?? "",
			userId: decoded.customer ?? "",
			savePaymentMethod: Boolean(decoded.card_token || decoded.token),
			providerMethodId: decoded.payment_id
				? String(decoded.payment_id)
				: "",
			cardMask:
				decoded.sender_card_mask ?? decoded.sender_card_mask2 ?? "",
			cardToken: decoded.card_token ?? decoded.token ?? "",
		});
	}

	public async processEvent(
		data: ProcessPaymentEventRequest,
	): Promise<ProcessPaymentEventResponse> {
		const {
			paymentId,
			status,
			bookingId,
			providerMethodId,
			cardMask,
			cardToken,
			userId,
		} = data;

		const payment = await this.repository.findPaymentById(paymentId);

		if (!payment) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: "Payment not found",
			});
		}

		if (isSuccessStatus(status)) {
			const updateData: Prisma.PaymentUpdateInput = {
				status: PaymentStatus.SUCCESS,
			};

			if (bookingId) {
				updateData.bookingId = bookingId;
			}
			if (providerMethodId) {
				updateData.providerMethodId = providerMethodId;
			}
			if (cardMask) {
				updateData.cardMask = cardMask;
			}
			if (cardToken) {
				updateData.cardToken = cardToken;
			}

			await this.repository.updatePayment(payment.id, updateData);

			await this.bookingClient.confirmBooking({
				bookingId,
				userId,
			});
		} else if (isFailureStatus(status)) {
			await this.repository.updatePayment(payment.id, {
				status: PaymentStatus.FAILED,
			});
		}

		return { ok: true };
	}

	public async refundPayment(
		data: RefundPaymentRequest,
	): Promise<RefundPaymentResponse> {
		const { bookingId } = data;

		const payment = await this.repository.findPaymentByBookingId(bookingId);

		if (!payment) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: "Payment not found",
			});
		}

		if (payment.status !== PaymentStatus.SUCCESS) {
			throw new RpcException({
				code: RpcStatus.FAILED_PRECONDITION,
				details: "Only successful payments can be refunded",
			});
		}

		if (!payment.bookingId || !payment.userId) {
			throw new RpcException({
				code: RpcStatus.FAILED_PRECONDITION,
				details: "Payment is missing booking or user reference",
			});
		}

		await this.bookingClient.cancelBooking({
			bookingId: payment.bookingId,
			userId: payment.userId,
		});

		const response = await this.liqpayService.refundPayment({
			orderId: payment.id,
			amount: payment.amount,
		});

		if (isRefundSuccessStatus(response.status)) {
			await this.repository.updatePayment(payment.id, {
				status: PaymentStatus.REFUNDED,
			});

			return { ok: true };
		}

		throw new RpcException({
			code: RpcStatus.INTERNAL,
			details: response.err_description || "LiqPay refund failed",
		});
	}
}
