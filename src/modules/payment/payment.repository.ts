import { Prisma } from "@generated/client";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/infrastructure/prisma/prisma.service";

@Injectable()
export class PaymentRepository {
	public constructor(private readonly prismaService: PrismaService) {}

	public findPaymentById(id: string) {
		return this.prismaService.payment.findUnique({
			where: {
				id,
			},
		});
	}

	public findPaymentByBookingId(bookingId: string) {
		return this.prismaService.payment.findFirst({
			where: {
				bookingId,
			},
		});
	}

	public createPayment(data: Prisma.PaymentCreateInput) {
		return this.prismaService.payment.create({ data });
	}

	public updatePayment(id: string, data: Prisma.PaymentUpdateInput) {
		return this.prismaService.payment.update({
			where: {
				id,
			},
			data,
		});
	}
}
