"""
Sentry error tracking configuration for Python services
"""
import os
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from typing import Optional, Dict, Any


def initialize_sentry(
    service_name: str,
    dsn: Optional[str] = None,
    environment: Optional[str] = None,
    release: Optional[str] = None,
    traces_sample_rate: float = 0.1,
    profiles_sample_rate: float = 0.1,
) -> None:
    """
    Initialize Sentry for error tracking and performance monitoring
    
    Args:
        service_name: Name of the service
        dsn: Sentry DSN (Data Source Name)
        environment: Environment name (development, staging, production)
        release: Release version
        traces_sample_rate: Percentage of transactions to trace (0.0 to 1.0)
        profiles_sample_rate: Percentage of transactions to profile (0.0 to 1.0)
    """
    dsn = dsn or os.getenv('SENTRY_DSN')
    
    if not dsn:
        print('Sentry DSN not provided. Error tracking disabled.')
        return
    
    environment = environment or os.getenv('ENVIRONMENT', 'development')
    release = release or f"{service_name}@1.0.0"
    
    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        release=release,
        
        # Performance monitoring
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=profiles_sample_rate,
        
        # Integrations
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            RedisIntegration(),
        ],
        
        # Add service name as tag
        before_send=lambda event, hint: _before_send(event, hint, service_name),
        
        # Send default PII (Personally Identifiable Information)
        send_default_pii=False,
        
        # Attach stack trace to messages
        attach_stacktrace=True,
    )
    
    # Set service tag
    sentry_sdk.set_tag('service', service_name)
    
    print(f'Sentry initialized for {service_name} in {environment} environment')


def _before_send(event: Dict[str, Any], hint: Dict[str, Any], service_name: str) -> Optional[Dict[str, Any]]:
    """
    Filter and sanitize events before sending to Sentry
    
    Args:
        event: Sentry event dictionary
        hint: Additional context
        service_name: Name of the service
        
    Returns:
        Modified event or None to drop the event
    """
    # Add service name
    if 'tags' not in event:
        event['tags'] = {}
    event['tags']['service'] = service_name
    
    # Remove sensitive headers
    if 'request' in event and 'headers' in event['request']:
        sensitive_headers = ['authorization', 'cookie', 'x-api-key']
        for header in sensitive_headers:
            if header in event['request']['headers']:
                event['request']['headers'][header] = '***REDACTED***'
    
    # Remove sensitive query parameters
    if 'request' in event and 'query_string' in event['request']:
        sensitive_params = ['password', 'token', 'api_key', 'otp']
        query_string = event['request']['query_string']
        for param in sensitive_params:
            if param in query_string:
                query_string = query_string.replace(
                    f'{param}=',
                    f'{param}=***REDACTED***&'
                )
        event['request']['query_string'] = query_string
    
    # Sanitize request data
    if 'request' in event and 'data' in event['request']:
        event['request']['data'] = _sanitize_data(event['request']['data'])
    
    # Sanitize extra context
    if 'extra' in event:
        event['extra'] = _sanitize_data(event['extra'])
    
    return event


def _sanitize_data(data: Any) -> Any:
    """
    Recursively sanitize sensitive data
    
    Args:
        data: Data to sanitize
        
    Returns:
        Sanitized data
    """
    if not isinstance(data, (dict, list)):
        return data
    
    sensitive_fields = [
        'password', 'token', 'api_key', 'apikey', 'secret',
        'otp', 'phone', 'email', 'authorization', 'cookie'
    ]
    
    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            if any(field in key.lower() for field in sensitive_fields):
                sanitized[key] = '***REDACTED***'
            elif isinstance(value, (dict, list)):
                sanitized[key] = _sanitize_data(value)
            else:
                sanitized[key] = value
        return sanitized
    
    elif isinstance(data, list):
        return [_sanitize_data(item) for item in data]
    
    return data


def capture_exception(
    error: Exception,
    context: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    Capture exception with additional context
    
    Args:
        error: Exception to capture
        context: Additional context (userId, requestId, endpoint, payload, etc.)
        
    Returns:
        Event ID or None
    """
    with sentry_sdk.push_scope() as scope:
        if context:
            # Add user context
            if 'userId' in context:
                scope.set_user({'id': context['userId']})
            
            # Add tags
            if 'requestId' in context:
                scope.set_tag('request_id', context['requestId'])
            if 'endpoint' in context:
                scope.set_tag('endpoint', context['endpoint'])
            
            # Add extra context
            extra_context = {k: v for k, v in context.items() 
                           if k not in ['userId', 'requestId', 'endpoint']}
            
            if 'payload' in extra_context:
                scope.set_context('payload', _sanitize_data(extra_context['payload']))
                del extra_context['payload']
            
            if extra_context:
                scope.set_context('additional', _sanitize_data(extra_context))
        
        return sentry_sdk.capture_exception(error)


def add_breadcrumb(
    message: str,
    category: str,
    level: str = 'info',
    data: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Add breadcrumb for debugging
    
    Args:
        message: Breadcrumb message
        category: Breadcrumb category
        level: Severity level (debug, info, warning, error, fatal)
        data: Additional data
    """
    sentry_sdk.add_breadcrumb(
        message=message,
        category=category,
        level=level,
        data=_sanitize_data(data) if data else None,
    )


def capture_message(
    message: str,
    level: str = 'info',
    context: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    Capture message with context
    
    Args:
        message: Message to capture
        level: Severity level (debug, info, warning, error, fatal)
        context: Additional context
        
    Returns:
        Event ID or None
    """
    with sentry_sdk.push_scope() as scope:
        if context:
            scope.set_context('message_context', _sanitize_data(context))
        
        return sentry_sdk.capture_message(message, level)


def set_user_context(user_id: str, phone: Optional[str] = None) -> None:
    """
    Set user context for error tracking
    
    Args:
        user_id: User ID
        phone: User phone number (will be redacted)
    """
    sentry_sdk.set_user({
        'id': user_id,
        'phone': '***REDACTED***' if phone else None,
    })


def set_request_context(
    request_id: str,
    method: str,
    url: str,
    endpoint: Optional[str] = None,
) -> None:
    """
    Set request context for error tracking
    
    Args:
        request_id: Request ID
        method: HTTP method
        url: Request URL
        endpoint: Endpoint path
    """
    sentry_sdk.set_tag('request_id', request_id)
    sentry_sdk.set_context('request', {
        'method': method,
        'url': url,
        'endpoint': endpoint or url,
    })


def track_crash_rate(crashed: bool) -> None:
    """
    Track crash rate metric
    
    Args:
        crashed: Whether a crash occurred
    """
    sentry_sdk.set_tag('crash_occurred', 'yes' if crashed else 'no')
    
    if crashed:
        sentry_sdk.capture_message('Application crash detected', 'fatal')


async def flush_sentry(timeout: float = 2.0) -> None:
    """
    Flush Sentry events (useful before shutdown)
    
    Args:
        timeout: Timeout in seconds
    """
    client = sentry_sdk.Hub.current.client
    if client:
        client.close(timeout=timeout)
