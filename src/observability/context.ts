import { trace } from "@opentelemetry/api";

export interface TraceContext {
    traceId: string | null;
    spanId: string | null;
}

export function getTraceContext(): TraceContext {
    const span = trace.getActiveSpan();

    if (!span) {
        return {
            traceId: null,
            spanId: null,
        };
    }

    const context = span.spanContext();

    return {
        traceId: context.traceId,
        spanId: context.spanId,
    };
}