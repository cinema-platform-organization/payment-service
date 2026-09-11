import type {
	BookingServiceClient,
	CancelBookingRequest,
	ConfirmBookingRequest,
	CreateReservationRequest,
} from "@cinema-platform/contracts/gen/ts/booking";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";

@Injectable()
export class BookingClientGrpc implements OnModuleInit {
	private bookingService!: BookingServiceClient;

	public constructor(
		@Inject("BOOKING_PACKAGE") private readonly client: ClientGrpc,
	) {}

	public onModuleInit() {
		this.bookingService =
			this.client.getService<BookingServiceClient>("BookingService");
	}

	public createReservation(request: CreateReservationRequest) {
		return this.bookingService.createReservation(request);
	}

	public confirmBooking(data: ConfirmBookingRequest) {
		return this.bookingService.confirmBooking(data);
	}

	public cancelBooking(data: CancelBookingRequest) {
		return this.bookingService.cancelBooking(data);
	}
}
