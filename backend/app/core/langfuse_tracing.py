"""
Langfuse OpenTelemetry Tracing Setup

Instruments the application with OpenTelemetry to send LLM traces to Langfuse.
This enables full observability of all OpenAI API calls including:
- Token usage tracking
- Latency measurements
- Request/response logging
- Cost tracking
- Prompt/completion analysis

Usage:
    Call `init_langfuse_tracing()` early in your application startup,
    before any OpenAI clients are created.
"""

import base64
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

_tracing_initialized = False


def init_langfuse_tracing() -> bool:
    """
    Initialize OpenTelemetry tracing with Langfuse exporter.

    Must be called before creating any OpenAI clients to ensure
    all LLM calls are properly instrumented.

    Returns:
        True if tracing was successfully initialized, False otherwise.
    """
    global _tracing_initialized

    if _tracing_initialized:
        logger.debug("Langfuse tracing already initialized")
        return True

    # Check for required keys
    if not settings.LANGFUSE_SECRET_KEY or not settings.LANGFUSE_PUBLIC_KEY:
        logger.warning(
            "Langfuse keys not configured. Tracing disabled. "
            "Set LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY in .env"
        )
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME

        # Create auth header for Langfuse
        # Format: "public_key:secret_key" base64 encoded
        auth_token = base64.b64encode(
            f"{settings.LANGFUSE_PUBLIC_KEY}:{settings.LANGFUSE_SECRET_KEY}".encode()
        ).decode()

        # Determine Langfuse host
        langfuse_host = settings.LANGFUSE_BASE_URL or settings.LANGFUSE_HOST
        if not langfuse_host:
            langfuse_host = "https://cloud.langfuse.com"

        # OTLP endpoint for Langfuse
        otlp_endpoint = f"{langfuse_host}/api/public/otel/v1/traces"

        # Create resource with service name
        resource = Resource.create({
            SERVICE_NAME: "headwayhq-backend",
            "service.version": "1.0.0",
            "deployment.environment": settings.ENVIRONMENT,
        })

        # Create tracer provider
        provider = TracerProvider(resource=resource)

        # Create OTLP exporter with Langfuse authentication
        exporter = OTLPSpanExporter(
            endpoint=otlp_endpoint,
            headers={
                "Authorization": f"Basic {auth_token}",
            },
        )

        # Add batch processor for efficient trace export
        provider.add_span_processor(BatchSpanProcessor(exporter))

        # Set as global tracer provider
        trace.set_tracer_provider(provider)

        # Instrument OpenAI SDK
        _instrument_openai()

        _tracing_initialized = True
        logger.info(f"Langfuse tracing initialized (endpoint: {otlp_endpoint})")
        return True

    except ImportError as e:
        logger.error(
            f"OpenTelemetry packages not installed: {e}. "
            "Run: pip install opentelemetry-sdk opentelemetry-exporter-otlp opentelemetry-instrumentation-openai"
        )
        return False

    except Exception as e:
        logger.error(f"Failed to initialize Langfuse tracing: {e}")
        return False


def _instrument_openai():
    """Instrument the OpenAI SDK to capture all LLM calls."""
    try:
        from opentelemetry.instrumentation.openai import OpenAIInstrumentor

        # Instrument OpenAI with trace content enabled for full visibility
        OpenAIInstrumentor().instrument(
            # Capture prompts and completions in traces
            capture_content=True,
        )
        logger.info("OpenAI SDK instrumented for tracing")

    except ImportError:
        logger.warning(
            "opentelemetry-instrumentation-openai not installed. "
            "OpenAI calls will not be traced. "
            "Run: pip install opentelemetry-instrumentation-openai"
        )
    except Exception as e:
        logger.error(f"Failed to instrument OpenAI SDK: {e}")


def shutdown_tracing():
    """Shutdown tracing and flush any pending spans."""
    global _tracing_initialized

    if not _tracing_initialized:
        return

    try:
        from opentelemetry import trace

        provider = trace.get_tracer_provider()
        if hasattr(provider, 'shutdown'):
            provider.shutdown()
            logger.info("Langfuse tracing shut down")

    except Exception as e:
        logger.error(f"Error shutting down tracing: {e}")

    _tracing_initialized = False


def get_tracer(name: str = "headwayhq"):
    """
    Get a tracer for custom span creation.

    Args:
        name: Name for the tracer (usually module name)

    Returns:
        OpenTelemetry tracer instance
    """
    from opentelemetry import trace
    return trace.get_tracer(name)


def create_span(name: str, attributes: Optional[dict] = None):
    """
    Create a custom span for tracing non-LLM operations.

    Usage:
        with create_span("my-operation", {"key": "value"}):
            # do work
            pass

    Args:
        name: Span name
        attributes: Optional attributes to attach to span

    Returns:
        Context manager for the span
    """
    tracer = get_tracer()
    span = tracer.start_as_current_span(name)
    if attributes:
        span.set_attributes(attributes)
    return span
