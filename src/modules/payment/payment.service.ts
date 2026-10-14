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
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";

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
	private readonly logger = new Logger(PaymentService.name);

	private readonly HOSTS_APP: string;
	private readonly API_URL: string;
	private readonly SANDBOX: 0 | 1 | undefined;

	public constructor(
		private readonly repository: PaymentRepository,
		private readonly configService: ConfigService,
		private readonly liqpayService: LiqpayService,
		private readonly bookingClient: BookingClientGrpc,
	) {
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

		this.logger.log(
			{
				paymentId: transaction.id,
				bookingId: reservation.orderId,
				userId,
				amount: transaction.amount,
			},
			"Payment created",
		);

		return { url };
	}

	public async verifyCallback(
		data: RawCallbackRequest,
	): Promise<ProcessPaymentEventResponse> {
		const { data: rawData, signature } = data;

		if (!this.liqpayService.verifyCallback(rawData, signature)) {
			this.logger.warn("Invalid LiqPay callback signature");

			throw new RpcException({
				code: RpcStatus.UNAUTHENTICATED,
				details: "Invalid LiqPay signature",
			});
		}

		const decoded = this.liqpayService.decodeCallback(rawData);

		this.logger.log(
			{
				paymentId: decoded.order_id,
				status: decoded.status,
				errCode: decoded.err_code,
			},
			"LiqPay callback received",
		);

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
			this.logger.warn({ paymentId }, "Callback for unknown payment");

			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: "Payment not found",
			});
		}

		if (payment.status === PaymentStatus.SUCCESS) {
			this.logger.log({ paymentId }, "Payment already processed");

			return { ok: true };
		}

		if (isSuccessStatus(status)) {
			if (!bookingId) {
				this.logger.error(
					{ paymentId },
					"Successful payment has no booking reference",
				);

				throw new RpcException({
					code: RpcStatus.INVALID_ARGUMENT,
					details: "Payment callback has no booking reference",
				});
			}

			try {
				await this.bookingClient.confirmBooking({
					bookingId,
					userId,
				});
			} catch (error) {
				this.logger.error(
					{ err: error as Error, paymentId, bookingId, userId },
					"Payment succeeded but booking confirmation failed",
				);

				await this.refundUnconfirmedPayment(
					payment.id,
					payment.amount,
					bookingId,
					userId,
				);

				return { ok: true };
			}

			const updateData: Prisma.PaymentUpdateInput = {
				status: PaymentStatus.SUCCESS,
				bookingId,
			};

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

			this.logger.log({ paymentId, bookingId }, "Payment succeeded");
		} else if (isFailureStatus(status)) {
			await this.repository.updatePayment(payment.id, {
				status: PaymentStatus.FAILED,
			});

			this.logger.warn({ paymentId, status }, "Payment failed");
		}

		return { ok: true };
	}

	private async refundUnconfirmedPayment(
		paymentId: string,
		amount: number,
		bookingId: string,
		userId: string,
	) {
		let response: Awaited<ReturnType<LiqpayService["refundPayment"]>>;

		try {
			response = await this.liqpayService.refundPayment({
				orderId: paymentId,
				amount,
			});
		} catch (error) {
			this.logger.error(
				{ err: error as Error, paymentId, bookingId, amount },
				"Auto-refund request failed, manual refund needed",
			);
			throw new RpcException({
				code: RpcStatus.UNAVAILABLE,
				details: "Booking confirmation and auto-refund both failed",
			});
		}

		if (!isRefundSuccessStatus(response.status)) {
			this.logger.error(
				{
					paymentId,
					bookingId,
					amount,
					liqpayStatus: response.status,
					errCode: response.err_code,
					errDescription: response.err_description,
				},
				"LiqPay rejected auto-refund, manual refund needed",
			);
			throw new RpcException({
				code: RpcStatus.INTERNAL,
				details: "Booking confirmation and auto-refund both failed",
			});
		}

		await this.repository.updatePayment(paymentId, {
			status: PaymentStatus.REFUNDED,
			bookingId,
		});

		this.logger.warn(
			{ paymentId, bookingId, amount },
			"Payment auto-refunded after failed booking confirmation",
		);

		try {
			await this.bookingClient.cancelBooking({ bookingId, userId });
		} catch (error) {
			this.logger.warn(
				{ err: error as Error, paymentId, bookingId },
				"Could not cancel booking after auto-refund",
			);
		}
	}

	public async refundPayment(
		data: RefundPaymentRequest,
	): Promise<RefundPaymentResponse> {
		const { bookingId, userId } = data;

		const payment = await this.repository.findPaymentByBookingId(bookingId);

		if (!payment) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: "Payment not found",
			});
		}

		if (payment.userId !== userId) {
			this.logger.warn(
				{ paymentId: payment.id, bookingId, userId },
				"User tried to refund someone else's booking",
			);

			throw new RpcException({
				code: RpcStatus.PERMISSION_DENIED,
				details: "You have no rights to refund this booking",
			});
		}

		if (payment.status !== PaymentStatus.SUCCESS) {
			throw new RpcException({
				code: RpcStatus.FAILED_PRECONDITION,
				details: "Only successful payments can be refunded",
			});
		}

		if (!payment.bookingId || !payment.userId) {
			this.logger.error(
				{ paymentId: payment.id },
				"Payment is missing booking or user reference",
			);

			throw new RpcException({
				code: RpcStatus.FAILED_PRECONDITION,
				details: "Payment is missing booking or user reference",
			});
		}

		await this.bookingClient.cancelBooking({
			bookingId: payment.bookingId,
			userId: payment.userId,
		});

		let response: Awaited<ReturnType<LiqpayService["refundPayment"]>>;

		try {
			response = await this.liqpayService.refundPayment({
				orderId: payment.id,
				amount: payment.amount,
			});
		} catch (error) {
			this.logger.error(
				{
					err: error as Error,
					paymentId: payment.id,
					bookingId: payment.bookingId,
					amount: payment.amount,
				},
				"Booking canceled but LiqPay refund request failed",
			);

			throw new RpcException({
				code: RpcStatus.UNAVAILABLE,
				details:
					"Booking was canceled, but the refund could not be processed. Please try again.",
			});
		}

		if (isRefundSuccessStatus(response.status)) {
			await this.repository.updatePayment(payment.id, {
				status: PaymentStatus.REFUNDED,
			});

			this.logger.log(
				{
					paymentId: payment.id,
					bookingId: payment.bookingId,
					amount: payment.amount,
				},
				"Payment refunded",
			);

			return { ok: true };
		}

		this.logger.error(
			{
				paymentId: payment.id,
				bookingId: payment.bookingId,
				amount: payment.amount,
				liqpayStatus: response.status,
				errCode: response.err_code,
				errDescription: response.err_description,
			},
			"Booking canceled but LiqPay rejected the refund",
		);

		throw new RpcException({
			code: RpcStatus.INTERNAL,
			details: response.err_description || "LiqPay refund failed",
		});
	}
}
