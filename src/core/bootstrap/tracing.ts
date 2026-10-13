import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const otelSdk = new NodeSDK({
	traceExporter: new OTLPTraceExporter({
		url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://jaeger:4317",
	}),
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: "payment-service",
	}),
	instrumentations: [
		getNodeAutoInstrumentations({
			"@opentelemetry/instrumentation-fs": { enabled: false },
			"@opentelemetry/instrumentation-http": {
				ignoreIncomingRequestHook: req => req.url === "/metrics",
			},
		}),
	],
});

otelSdk.start();

process.on("SIGTERM", () => {
	void otelSdk.shutdown().finally(() => process.exit(0));
});
