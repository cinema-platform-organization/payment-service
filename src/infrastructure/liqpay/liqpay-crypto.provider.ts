import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

@Injectable()
export class LiqpayCryptoProvider {
	private readonly publicKey: string;
	private readonly privateKey: string;

	public constructor(private readonly configService: ConfigService) {
		this.publicKey =
			this.configService.getOrThrow<string>("LIQPAY_PUBLIC_KEY");
		this.privateKey =
			this.configService.getOrThrow<string>("LIQPAY_PRIVATE_KEY");
	}

	private signPayload(data: string): string {
		return crypto
			.createHash("sha1")
			.update(this.privateKey + data + this.privateKey)
			.digest("base64");
	}

	public encodeAndSign(payload: Record<string, unknown>) {
		const fullPayload = {
			public_key: this.publicKey,
			version: "3",
			...payload,
		};

		const data = Buffer.from(JSON.stringify(fullPayload)).toString(
			"base64",
		);
		const signature = this.signPayload(data);

		return { data, signature };
	}

	public verifySignature(data: string, signature: string): boolean {
		return this.signPayload(data) === signature;
	}

	public decode<T>(data: string): T {
		return JSON.parse(Buffer.from(data, "base64").toString("utf-8")) as T;
	}
}
