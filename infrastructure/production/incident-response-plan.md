# KrishiAI Incident Response Plan

## Overview

This document outlines the incident response procedures for the KrishiAI production environment. All team members must be familiar with these procedures.

## Incident Severity Levels

### P0 - Critical (Response Time: 15 minutes)
- Complete service outage affecting all users
- Data breach or security incident
- Database corruption or data loss
- Payment system failure

### P1 - High (Response Time: 1 hour)
- Partial service outage affecting >50% of users
- Critical feature unavailable (disease detection, crop recommendations)
- Performance degradation >50%
- External API failures (IMD, Agmarknet)

### P2 - Medium (Response Time: 4 hours)
- Non-critical feature unavailable
- Performance degradation 20-50%
- Isolated user reports of issues
- Monitoring alerts triggered

### P3 - Low (Response Time: 24 hours)
- Minor bugs or UI issues
- Documentation errors
- Feature requests
- Performance optimization opportunities

## Incident Response Team

### On-Call Rotation
- **Primary On-Call**: Responds to all incidents
- **Secondary On-Call**: Backup for P0/P1 incidents
- **Manager On-Call**: Escalation point for P0 incidents

### Contact Information
```
Primary On-Call: +91-XXXX-XXXXXX (WhatsApp, Phone)
Secondary On-Call: +91-XXXX-XXXXXX (WhatsApp, Phone)
Manager On-Call: +91-XXXX-XXXXXX (WhatsApp, Phone)
Support Email: support@krishiai.in
Emergency Hotline: 1800-XXX-XXXX
```

## Incident Response Workflow

### 1. Detection
Incidents can be detected through:
- Automated monitoring alerts (Prometheus, Grafana)
- User reports (WhatsApp, phone, email)
- Manual discovery during routine checks
- External monitoring services (UptimeRobot)

### 2. Triage (5 minutes)
1. Acknowledge the incident
2. Assess severity level
3. Create incident ticket in tracking system
4. Notify relevant team members
5. Start incident war room (if P0/P1)

### 3. Investigation (15-60 minutes)
1. Check monitoring dashboards
2. Review recent deployments
3. Examine error logs (Sentry, ELK)
4. Check external dependencies
5. Identify root cause

### 4. Mitigation (Immediate)
1. Implement temporary fix if available
2. Roll back recent deployment if needed
3. Scale resources if capacity issue
4. Failover to backup systems
5. Communicate status to users

### 5. Resolution (Variable)
1. Implement permanent fix
2. Test thoroughly in staging
3. Deploy to production
4. Verify resolution
5. Monitor for recurrence

### 6. Post-Incident Review (Within 48 hours)
1. Document timeline of events
2. Identify root cause
3. Document lessons learned
4. Create action items to prevent recurrence
5. Update runbooks and documentation

## Communication Protocols

### Internal Communication
- **P0/P1**: Create Slack/WhatsApp war room immediately
- **P2/P3**: Use standard support channels
- **Updates**: Every 30 minutes for P0, hourly for P1

### External Communication
- **Status Page**: Update status.krishiai.in
- **WhatsApp Groups**: Notify village coordinators
- **SMS**: Send to affected users (P0 only)
- **Email**: Post-incident summary

### Communication Templates

#### P0 Incident Notification
```
🚨 CRITICAL INCIDENT - P0

Service: [Service Name]
Impact: [Description of impact]
Affected Users: [Number/Percentage]
Status: Investigating/Mitigating/Resolved
ETA: [Estimated time to resolution]

We are actively working on this issue. Updates every 30 minutes.

- KrishiAI Team
```

#### Resolution Notification
```
✅ INCIDENT RESOLVED

Service: [Service Name]
Duration: [Start time - End time]
Root Cause: [Brief description]
Resolution: [What was done]

All services are now operating normally. We apologize for the inconvenience.

Post-incident report: [Link]

- KrishiAI Team
```

## Common Incident Scenarios

### Scenario 1: Complete Service Outage

**Symptoms**: All API endpoints returning 503, no user can access app

**Immediate Actions**:
1. Check Kubernetes cluster health: `kubectl get nodes`
2. Check pod status: `kubectl get pods -n krishiai-prod`
3. Check ingress controller: `kubectl get ingress -n krishiai-prod`
4. Check AWS/GCP console for infrastructure issues
5. Review recent deployments

**Runbook**: See `runbooks/service-outage.md`

### Scenario 2: Database Connection Failure

**Symptoms**: Services reporting database connection errors

**Immediate Actions**:
1. Check RDS/database status in AWS console
2. Verify security group rules
3. Check connection pool exhaustion
4. Review database logs
5. Check for long-running queries

**Runbook**: See `runbooks/database-issues.md`

### Scenario 3: High Error Rate

**Symptoms**: Sentry showing spike in errors, Grafana alerts

**Immediate Actions**:
1. Check Sentry for error patterns
2. Review recent code deployments
3. Check external API status (IMD, Agmarknet)
4. Review application logs
5. Check resource utilization

**Runbook**: See `runbooks/high-error-rate.md`

### Scenario 4: Performance Degradation

**Symptoms**: Slow response times, timeout errors

**Immediate Actions**:
1. Check Grafana performance dashboards
2. Review database query performance
3. Check Redis cache hit rate
4. Review resource utilization (CPU, memory)
5. Check for DDoS or unusual traffic patterns

**Runbook**: See `runbooks/performance-issues.md`

### Scenario 5: Security Incident

**Symptoms**: Suspicious activity, unauthorized access attempts

**Immediate Actions**:
1. **DO NOT** shut down systems immediately
2. Preserve logs and evidence
3. Isolate affected systems if confirmed breach
4. Notify security team and management
5. Follow security incident runbook

**Runbook**: See `runbooks/security-incident.md`

## Escalation Matrix

### P0 Incidents
- **0-15 min**: Primary on-call investigates
- **15-30 min**: Engage secondary on-call
- **30-60 min**: Escalate to manager on-call
- **60+ min**: Engage external support (AWS, vendors)

### P1 Incidents
- **0-1 hour**: Primary on-call investigates
- **1-2 hours**: Engage secondary on-call
- **2-4 hours**: Escalate to manager on-call

## Tools and Access

### Monitoring & Alerting
- Grafana: https://grafana.krishiai.in
- Prometheus: https://prometheus.krishiai.in
- Sentry: https://sentry.io/krishiai
- UptimeRobot: https://uptimerobot.com

### Infrastructure
- AWS Console: https://console.aws.amazon.com
- Kubernetes Dashboard: `kubectl proxy`
- Database: Via bastion host

### Communication
- Slack: #incidents channel
- WhatsApp: Support group
- Email: support@krishiai.in
- Status Page: https://status.krishiai.in

## Post-Incident Review Template

```markdown
# Incident Post-Mortem: [Incident Title]

## Incident Summary
- **Date**: [Date]
- **Duration**: [Start - End time]
- **Severity**: [P0/P1/P2/P3]
- **Impact**: [Description of user impact]

## Timeline
- **HH:MM** - [Event description]
- **HH:MM** - [Event description]
- **HH:MM** - [Event description]

## Root Cause
[Detailed explanation of what caused the incident]

## Resolution
[What was done to resolve the incident]

## What Went Well
- [Item 1]
- [Item 2]

## What Could Be Improved
- [Item 1]
- [Item 2]

## Action Items
- [ ] [Action item 1] - Owner: [Name] - Due: [Date]
- [ ] [Action item 2] - Owner: [Name] - Due: [Date]

## Lessons Learned
[Key takeaways from this incident]
```

## Training and Drills

### Quarterly Incident Response Drills
- Simulate P0 incident scenarios
- Practice communication protocols
- Test failover procedures
- Review and update runbooks

### New Team Member Onboarding
- Review incident response plan
- Shadow on-call rotation
- Practice using monitoring tools
- Review past incident reports

## Document Maintenance

This document should be reviewed and updated:
- After every P0/P1 incident
- Quarterly as part of regular review
- When team structure changes
- When infrastructure changes

**Last Updated**: January 2026
**Next Review**: April 2026
**Document Owner**: DevOps Team
