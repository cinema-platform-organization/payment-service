import { toRpcException } from "@cinema-platform/common";
import type {
	BookingServiceClient,
	CancelBookingRequest,
	ConfirmBookingRequest,
	CreateReservationRequest,
} from "@cinema-platform/contracts/gen/ts/booking";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";

@Injectable()
export class BookingClientGrpc implements OnModuleInit {
	private readonly logger = new Logger(BookingClientGrpc.name);

	private bookingService!: BookingServiceClient;

	public constructor(
		@Inject("BOOKING_PACKAGE") private readonly client: ClientGrpc,
	) {}

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
			this.logger.error(
				{
					err: error as Error,
					userId: request.userId,
					screeningId: request.screeningId,
				},
				"Failed to create reservation",
			);

			throw toRpcException(error, "Failed to create reservation");
		}
	}

	public async confirmBooking(data: ConfirmBookingRequest) {
		try {
			return await lastValueFrom(
				this.bookingService.confirmBooking(data),
			);
		} catch (error) {
			this.logger.error(
				{ err: error as Error, bookingId: data.bookingId },
				"Failed to confirm booking",
			);

			throw toRpcException(error, "Failed to confirm booking");
		}
	}

	public async cancelBooking(data: CancelBookingRequest) {
		try {
			return await lastValueFrom(this.bookingService.cancelBooking(data));
		} catch (error) {
			this.logger.error(
				{ err: error as Error, bookingId: data.bookingId },
				"Failed to cancel booking",
			);

			throw toRpcException(error, "Failed to cancel booking");
		}
	}
}
