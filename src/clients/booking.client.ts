import { RpcStatus } from "@cinema-platform/common";
import type {
	BookingServiceClient,
	CancelBookingRequest,
	ConfirmBookingRequest,
	CreateReservationRequest,
} from "@cinema-platform/contracts/gen/ts/booking";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { RpcException } from "@nestjs/microservices";
import { PinoLogger } from "nestjs-pino";
import { lastValueFrom } from "rxjs";

@Injectable()
export class BookingClientGrpc implements OnModuleInit {
	private bookingService!: BookingServiceClient;

	public constructor(
		private readonly logger: PinoLogger,
		@Inject("BOOKING_PACKAGE") private readonly client: ClientGrpc,
	) {
		this.logger.setContext(BookingClientGrpc.name);
	}

	public onModuleInit() {
		this.bookingService =
			this.client.getService<BookingServiceClient>("BookingService");
	}

	public async createReservation(request: CreateReservationRequest) {
		try {
			return await lastValueFrom(
				this.bookingService.createReservation(request),
			);
		} catch (error) {
			if (error instanceof RpcException) {
				throw error;
			}

			this.logger.error("Failed to create reservation:", error);
			throw new RpcException({
				code: RpcStatus.INTERNAL,
				details: "Failed to create reservation",
			});
		}
	}

	public async confirmBooking(data: ConfirmBookingRequest) {
		try {
			return await lastValueFrom(
				this.bookingService.confirmBooking(data),
			);
		} catch (error) {
			if (error instanceof RpcException) {
				throw error;
			}

			this.logger.error("Failed to confirm booking:", error);
			throw new RpcException({
				code: RpcStatus.INTERNAL,
				details: "Failed to confirm booking",
			});
		}
	}

	public async cancelBooking(data: CancelBookingRequest) {
		try {
			return await lastValueFrom(this.bookingService.cancelBooking(data));
		} catch (error) {
			if (error instanceof RpcException) {
				throw error;
			}

			this.logger.error("Failed to cancel booking:", error);
			throw new RpcException({
				code: RpcStatus.INTERNAL,
				details: "Failed to cancel booking",
			});
		}
	}
}
