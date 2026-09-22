import { NodeSDK } from "@opentelemetry/sdk-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { resourceFromAttributes, defaultResource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { createRequire } from "node:module";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";

const require = createRequire(import.meta.url);
const FastifyOtelInstrumentation = require("@fastify/otel");
const serviceName =
    process.env.OTEL_SERVICE_NAME ?? "redmesh-api";

const prometheusExporter = new PrometheusExporter({
    port: Number(process.env.OTEL_METRICS_PORT ?? 9464),
});

const sdk = new NodeSDK({
    resource: defaultResource().merge(
        resourceFromAttributes({
            [ATTR_SERVICE_NAME]: serviceName,
        }),
    ),

    metricReader: prometheusExporter,
    
    traceExporter: new ConsoleSpanExporter(),

    instrumentations: [
        new HttpInstrumentation(),
        new PgInstrumentation(),
        new FastifyOtelInstrumentation({
            registerOnInitialization: true,
            instrumentHooks: false,
            instrumentHandler: true,
        }),
    ],
});

sdk.start();

async function shutdown(): Promise<void> {
    try {
        await sdk.shutdown();
    } catch (error) {
        console.error("OpenTelemetry shutdown failed", error);
    }
}

process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
});

process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
});