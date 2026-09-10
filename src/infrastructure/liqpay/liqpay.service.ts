import { Injectable } from "@nestjs/common";

import { LiqpayCryptoProvider } from "./liqpay-crypto.provider";

interface LiqpayCreateParams {
	amount: number;
	currency: string;
	description: string;
	order_id: string;
	customer?: string;
	info?: string;
	server_url: string;
	result_url?: string;
	sandbox?: 0 | 1;
	recurringbytoken?: "1";
}

export interface LiqpayCallbackData {
	status: string;
	payment_id: number;
	order_id: string;
	amount: number;
	currency: string;
	customer?: string;
	info?: string;
	sender_card_mask?: string;
	sender_card_mask2?: string;
	card_token?: string;
	token?: string;
	err_code?: string;
	err_description?: string;
}

interface LiqpayRefundResponse {
	status: string;
	payment_id?: number;
	err_code?: string;
	err_description?: string;
}

@Injectable()
export class LiqpayService {
	private readonly checkoutUrl = "https://www.liqpay.ua/api/3/checkout";
	private readonly apiUrl = "https://www.liqpay.ua/api/request";

	public constructor(private readonly crypto: LiqpayCryptoProvider) {}

	public createPaymentUrl(params: LiqpayCreateParams): string {
		const { data, signature } = this.crypto.encodeAndSign({
			action: "pay",
			...params,
		});

		const query = new URLSearchParams({ data, signature });
		return `${this.checkoutUrl}?${query.toString()}`;
	}

	public async refundPayment(params: {
		orderId: string;
		amount: number;
	}): Promise<LiqpayRefundResponse> {
		return this.requestApi<LiqpayRefundResponse>({
			action: "refund",
			order_id: params.orderId,
			amount: params.amount,
		});
	}

	public verifyCallback(data: string, signature: string): boolean {
		return this.crypto.verifySignature(data, signature);
	}

	public decodeCallback<T = LiqpayCallbackData>(data: string): T {
		return this.crypto.decode<T>(data);
	}

	private async requestApi<T>(payload: Record<string, unknown>): Promise<T> {
		const { data, signature } = this.crypto.encodeAndSign(payload);

		const formData = new URLSearchParams();
		formData.append("data", data);
		formData.append("signature", signature);

		const response = await fetch(this.apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: formData.toString(),
		});

		return (await response.json()) as T;
	}
}
