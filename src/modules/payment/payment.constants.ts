export const LIQPAY_SUCCESS_STATUSES = ["success", "sandbox"] as const;
export const LIQPAY_FAILURE_STATUSES = [
	"failure",
	"error",
	"reversed",
] as const;
export const LIQPAY_REFUND_SUCCESS_STATUSES = [
	"reversed",
	"success",
	"sandbox",
] as const;

export type LiqPaySuccessStatus = (typeof LIQPAY_SUCCESS_STATUSES)[number];
export type LiqPayFailureStatus = (typeof LIQPAY_FAILURE_STATUSES)[number];
export type LiqpayRefundSuccessStatus =
	(typeof LIQPAY_REFUND_SUCCESS_STATUSES)[number];

export function isSuccessStatus(status: string): status is LiqPaySuccessStatus {
	return LIQPAY_SUCCESS_STATUSES.includes(status as LiqPaySuccessStatus);
}
export function isFailureStatus(status: string): status is LiqPayFailureStatus {
	return LIQPAY_FAILURE_STATUSES.includes(status as LiqPayFailureStatus);
}
export function isRefundSuccessStatus(
	status: string,
): status is LiqpayRefundSuccessStatus {
	return LIQPAY_REFUND_SUCCESS_STATUSES.includes(
		status as LiqpayRefundSuccessStatus,
	);
}
