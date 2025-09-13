# Security & Anti-Abuse Documentation

This document outlines the comprehensive security and anti-abuse measures implemented across the platform.

## Privacy-Preserving Identity Signals

### Salted Hashing
All IP addresses and User-Agent strings are processed using privacy-preserving salted hashing:

- **IP Addresses**: Hashed using HMAC-SHA256 with `ABUSE_IP_SALT`
- **User-Agent Strings**: Normalized and hashed using HMAC-SHA256 with `ABUSE_UA_SALT`
- **No Raw Storage**: Raw IP addresses and User-Agent strings are never stored in databases or logs
- **Consistent Hashing**: Same inputs always produce same hashes for deduplication

### Data Retention
- **Hash Retention**: Only salted hashes are retained for abuse prevention
- **Audit Logs**: Contain only hashed identifiers, never raw PII
- **Automatic Cleanup**: In-memory caches expire automatically (10 minutes to 24 hours)
- **No Cross-Reference**: Hashes cannot be reverse-engineered to original values

## Rate Limiting System

### Multi-Layer Protection
1. **Client-Side Deduplication**: Prevents duplicate requests using cookies/localStorage
2. **Application Layer**: tRPC middleware with user/IP-based limits
3. **Service Layer**: Hono middleware with IP-based limits and circuit breakers
4. **Database Layer**: Idempotency keys prevent duplicate operations

### Rate Limit Configuration
```typescript
// Per-user limits (authenticated)
commentsPerUserPerMin: 6
votesPerUserPerMin: 20
rulesCreatePerUserPerMin: 10
donationsCreatePerUserPerMin: 10

// Per-IP limits (unauthenticated)
eventsPerIpPerMin: 60
searchPerIpPerMin: 120
suggestionsPerIpPerMin: 60
```

### Response Headers
Rate-limited endpoints return standard headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: When the limit resets
- `Retry-After`: Seconds to wait before retrying (on 429)

## Circuit Breaker Protection

### IP-Based Circuit Breaking
- **QPS Threshold**: 25 requests/second triggers circuit open
- **Ban Duration**: 5 minutes (300 seconds)
- **Recovery**: Automatic after ban expires
- **Monitoring**: Real-time statistics via admin endpoints

### Adaptive Thresholds
Circuit breakers can adjust thresholds based on system load:
- **High Load**: Lower thresholds to protect system
- **Normal Load**: Standard thresholds for user experience
- **Gradual Recovery**: Smooth transition between states

## Anomaly Detection

### Multi-Factor Scoring
Anomaly detection combines multiple signals:
- **Burst Detection**: Unusual spikes in activity (40% weight)
- **Duplication**: High ratio of identical events (30% weight)
- **Entropy Analysis**: User-Agent diversity patterns (10% weight)
- **Velocity**: Acceleration of request patterns (20% weight)

### Thresholds
- **Warning Level**: 0.5 score triggers logging
- **Action Level**: 0.8 score triggers additional scrutiny
- **Automatic Response**: High scores may trigger temporary restrictions

## Shadow Banning

### Configuration
```bash
SHADOW_BAN_ENABLED=true
SHADOW_BANNED_USER_IDS=user1,user2,user3
```

### Behavior
- **Content Creation**: Shadow banned users can create content
- **Visibility**: Their content is hidden from other users
- **User Experience**: Shadow banned users see their own content normally
- **Audit Trail**: All shadow ban interactions are logged

## Deduplication Systems

### View Events (Cookie-based)
- **Window**: 10 minutes deduplication window
- **Storage**: First-party HTTP-only cookies
- **Capacity**: Up to 100 entries per cookie
- **Privacy**: Only rule IDs stored, no personal data

### User Actions (localStorage-based)
- **Window**: 10 minutes deduplication window
- **Storage**: Browser localStorage
- **Capacity**: Up to 500 entries
- **Cleanup**: Automatic cleanup of expired entries

### Server-Side Burst Protection
- **Identical Events**: Maximum 20 identical events per minute
- **View Caps**: Maximum 5 views per IP per rule per day
- **Sliding Windows**: Real-time burst detection and mitigation

## Idempotency Protection

### Key Generation
Idempotency keys are generated from:
- User ID (for authenticated operations)
- Operation type (create, update, delete)
- Target resource ID
- Request parameters hash

### Storage
- **TTL**: 10 minutes default
- **Collision Handling**: SHA-256 hashing prevents collisions
- **Memory Efficient**: Automatic cleanup of expired keys

## Error Handling & User Experience

### Rate Limit Responses
```json
{
  "error": "too_many_requests",
  "message": "Rate limit exceeded. Try again in 30 seconds.",
  "retryAfter": 30
}
```

### Client-Side Backoff
- **Exponential Backoff**: 1s, 2s, 4s, 8s... up to 60s maximum
- **Jitter**: Random variation to prevent thundering herd
- **User Feedback**: Clear messaging about wait times
- **Graceful Degradation**: Non-blocking UI where possible

## Monitoring & Administration

### Real-Time Statistics
Admin endpoints provide comprehensive monitoring:
- `/admin/abuse/stats` - Overall system statistics
- `/admin/abuse/banned-ips` - Currently banned IP addresses
- `/admin/abuse/anomalies` - Anomaly detection insights
- `/admin/abuse/health` - System health check

### Administrative Actions
- **Unban IPs**: Manual override of circuit breaker bans
- **Clear Rate Limits**: Reset rate limits for specific patterns
- **Update Configuration**: Runtime configuration changes
- **View Audit Logs**: Complete audit trail of all actions

## Security Best Practices

### Environment Variables
```bash
# Required in production
ABUSE_IP_SALT="your-cryptographically-secure-salt-here"
ABUSE_UA_SALT="your-different-secure-salt-here"

# Optional features
SHADOW_BAN_ENABLED="false"
CHALLENGE_ENABLED="false"
```

### Salt Generation
Generate cryptographically secure salts:
```bash
# Generate secure salts (32+ characters)
openssl rand -base64 32
```

### Network Security
- **Reverse Proxy**: Use behind reverse proxy (nginx, Cloudflare)
- **IP Extraction**: Properly configure X-Forwarded-For headers
- **TLS Termination**: Ensure HTTPS for all endpoints
- **CORS Policy**: Strict CORS for browser requests

## Compliance & Privacy

### GDPR Compliance
- **No PII Storage**: Only salted hashes stored
- **Right to Erasure**: Clear user data on account deletion
- **Data Minimization**: Collect only necessary identifiers
- **Retention Limits**: Automatic expiry of cached data

### Audit Requirements
- **Complete Logging**: All rate limit violations logged
- **Anonymized Data**: Logs contain only hashed identifiers
- **Retention Policy**: 30-day default retention for audit logs
- **Export Capability**: Admin can export audit data

## Incident Response

### Automated Responses
1. **Rate Limit Exceeded**: Automatic 429 responses with retry guidance
2. **Circuit Breaker Open**: Temporary IP blocking with automatic recovery
3. **Anomaly Detection**: Logging and optional notification
4. **Burst Activity**: Automatic throttling and event dropping

### Manual Interventions
1. **IP Unbanning**: Admin can manually unban legitimate traffic
2. **Configuration Tuning**: Runtime adjustment of thresholds
3. **Shadow Banning**: Manual addition/removal of problematic users
4. **Emergency Shutdown**: Circuit breaker can be manually triggered

## Testing & Validation

### Acceptance Criteria
- Rate limits properly enforce configured thresholds
- Circuit breakers activate and recover automatically  
- Deduplication prevents spam without blocking legitimate use
- Anomaly detection identifies suspicious patterns
- Privacy measures prevent PII exposure
- Admin tools provide necessary visibility and control

### Load Testing
Regular load testing should validate:
- Rate limiting under high traffic
- Circuit breaker behavior during attacks
- Memory usage under sustained load
- Recovery time after incidents
- Admin endpoint responsiveness

## Future Enhancements

### Phase 2 Features
- **Redis Backend**: Distributed rate limiting and caching
- **Machine Learning**: Advanced anomaly detection models
- **Geographic Analysis**: Location-based abuse patterns
- **Device Fingerprinting**: Privacy-aware device identification
- **Automated Quarantine**: Automatic rule hiding for suspicious content

### Integration Opportunities
- **CDN Integration**: Edge-based rate limiting
- **SIEM Integration**: Security information and event management
- **Alerting Systems**: Real-time notifications for incidents
- **Threat Intelligence**: External threat feed integration
