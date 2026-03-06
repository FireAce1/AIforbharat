# KrishiAI Security Audit and Penetration Testing Guide

## Overview

This document outlines the security audit and penetration testing procedures for KrishiAI production environment before pilot launch.

## Audit Scope

### In Scope
- All backend microservices (auth, crop, market, climate, govt)
- Mobile application (Android)
- API Gateway and load balancers
- Database and caching layers
- External integrations
- Infrastructure (AWS/GCP, Kubernetes)

### Out of Scope
- Third-party services (IMD, Agmarknet, SMS gateway)
- Development and staging environments
- Internal tools and dashboards

## Security Audit Checklist

### 1. Authentication & Authorization

#### OTP System
- [ ] OTP generation uses cryptographically secure random numbers
- [ ] OTP is 6 digits and expires in exactly 5 minutes
- [ ] OTP is hashed before storage (bcrypt)
- [ ] OTP is single-use only
- [ ] Rate limiting: 5 OTP requests per hour per phone
- [ ] Resend OTP has 30-second cooldown
- [ ] Failed OTP attempts are logged
- [ ] Account lockout after 5 failed attempts

#### JWT Tokens
- [ ] JWT uses HS256 algorithm
- [ ] JWT secret is strong (256-bit minimum)
- [ ] JWT expires in 7 days
- [ ] JWT includes user ID and minimal claims
- [ ] JWT is validated on every request
- [ ] Token refresh mechanism works correctly
- [ ] Revoked tokens are blacklisted in Redis
- [ ] Token signing key is rotated regularly

#### Session Management
- [ ] Sessions are stored securely in Redis
- [ ] Session IDs are cryptographically random
- [ ] Sessions expire after inactivity
- [ ] Logout invalidates session immediately
- [ ] Concurrent session limits enforced

### 2. Data Protection

#### Encryption at Rest
- [ ] Database encryption enabled (AES-256)
- [ ] PII fields encrypted in database
- [ ] Encryption keys stored in AWS KMS/GCP KMS
- [ ] Key rotation policy defined and tested
- [ ] Backup encryption enabled
- [ ] Redis persistence encrypted

#### Encryption in Transit
- [ ] TLS 1.3 enforced for all connections
- [ ] Strong cipher suites configured
- [ ] Certificate pinning implemented (mobile)
- [ ] HSTS headers configured
- [ ] No mixed content issues
- [ ] Internal service communication encrypted

#### PII Handling
- [ ] Phone numbers encrypted
- [ ] Location data encrypted
- [ ] Farm data encrypted
- [ ] User consent recorded
- [ ] Data minimization practiced
- [ ] Data retention policies enforced

### 3. Input Validation & Sanitization

#### API Endpoints
- [ ] All inputs validated with Joi/Yup schemas
- [ ] SQL injection prevention (parameterized queries)
- [ ] NoSQL injection prevention
- [ ] XSS prevention (output encoding)
- [ ] CSRF protection implemented
- [ ] File upload validation (type, size, content)
- [ ] JSON payload size limits enforced
- [ ] Request rate limiting per endpoint

#### Mobile App
- [ ] Input validation on client side
- [ ] Server-side validation enforced
- [ ] Deep link validation
- [ ] Intent filter validation (Android)
- [ ] WebView security configured
- [ ] JavaScript interface secured

### 4. Access Control

#### API Access
- [ ] Authentication required for all protected endpoints
- [ ] Authorization checks on every request
- [ ] User can only access own data
- [ ] Admin endpoints properly protected
- [ ] Service-to-service authentication
- [ ] API key rotation for external services

#### Database Access
- [ ] Least privilege principle applied
- [ ] Application uses dedicated DB user
- [ ] No direct database access from internet
- [ ] Connection strings encrypted
- [ ] Database firewall rules configured
- [ ] Audit logging enabled

#### Infrastructure Access
- [ ] MFA enabled for all admin accounts
- [ ] SSH keys rotated regularly
- [ ] Bastion host for database access
- [ ] VPN required for internal access
- [ ] IAM roles follow least privilege
- [ ] Access logs monitored

### 5. Dependency Security

#### Backend Dependencies
- [ ] All npm packages up to date
- [ ] No critical vulnerabilities (npm audit)
- [ ] No high vulnerabilities
- [ ] Dependency scanning in CI/CD
- [ ] License compliance checked
- [ ] Private packages secured

#### Mobile Dependencies
- [ ] All React Native packages up to date
- [ ] No critical vulnerabilities
- [ ] Android SDK up to date
- [ ] Third-party libraries vetted
- [ ] ProGuard/R8 enabled for release builds

### 6. Logging & Monitoring

#### Security Logging
- [ ] Authentication attempts logged
- [ ] Authorization failures logged
- [ ] Sensitive data not logged
- [ ] Logs centralized and encrypted
- [ ] Log retention policy enforced
- [ ] Anomaly detection configured

#### Security Monitoring
- [ ] Failed login attempts monitored
- [ ] Unusual API usage detected
- [ ] DDoS protection enabled
- [ ] Intrusion detection configured
- [ ] Security alerts configured
- [ ] Incident response plan documented

### 7. Mobile App Security

#### Code Security
- [ ] Code obfuscation enabled (ProGuard/R8)
- [ ] Root detection implemented
- [ ] Debuggable flag disabled in release
- [ ] Backup flag disabled
- [ ] Secure storage for sensitive data
- [ ] No hardcoded secrets

#### Network Security
- [ ] Certificate pinning implemented
- [ ] Network security config configured
- [ ] Cleartext traffic disabled
- [ ] VPN detection (if needed)
- [ ] Man-in-the-middle protection

#### Data Storage
- [ ] Sensitive data encrypted (SQLCipher)
- [ ] Keychain/Keystore used for keys
- [ ] No sensitive data in logs
- [ ] No sensitive data in screenshots
- [ ] Secure deletion implemented

### 8. Infrastructure Security

#### Kubernetes
- [ ] RBAC configured properly
- [ ] Network policies enforced
- [ ] Pod security policies applied
- [ ] Secrets encrypted at rest
- [ ] Container images scanned
- [ ] No privileged containers
- [ ] Resource limits set

#### Cloud Security
- [ ] Security groups properly configured
- [ ] VPC isolation implemented
- [ ] S3 buckets not public
- [ ] IAM policies follow least privilege
- [ ] CloudTrail/Cloud Audit enabled
- [ ] GuardDuty/Security Command Center enabled

### 9. Compliance

#### DPDP Act 2023
- [ ] User consent mechanism implemented
- [ ] Privacy policy published
- [ ] Data deletion process working
- [ ] Data export process working
- [ ] Data breach notification plan
- [ ] Data processing agreement with vendors

#### Agricultural Compliance
- [ ] Treatment recommendations reviewed
- [ ] Pesticide recommendations compliant
- [ ] Safety warnings included
- [ ] Disclaimers added
- [ ] Agronomist approval obtained

---

## Penetration Testing

### Testing Methodology
Following OWASP Testing Guide v4.2 and OWASP Mobile Security Testing Guide

### Testing Phases

#### Phase 1: Reconnaissance (2 days)
- Information gathering
- Network mapping
- Service enumeration
- Technology stack identification
- Attack surface analysis

#### Phase 2: Vulnerability Assessment (3 days)
- Automated scanning (Nessus, OpenVAS)
- Manual vulnerability identification
- Configuration review
- Dependency analysis
- Code review (if applicable)

#### Phase 3: Exploitation (3 days)
- Attempt to exploit identified vulnerabilities
- Privilege escalation attempts
- Lateral movement attempts
- Data exfiltration attempts
- Document proof of concept

#### Phase 4: Post-Exploitation (2 days)
- Assess impact of successful exploits
- Identify additional vulnerabilities
- Test incident detection and response
- Document findings

#### Phase 5: Reporting (2 days)
- Compile findings
- Assign severity ratings
- Provide remediation recommendations
- Executive summary
- Technical details

### Testing Scope

#### Backend API Testing
```bash
# OWASP Top 10 Testing
- A01: Broken Access Control
- A02: Cryptographic Failures
- A03: Injection
- A04: Insecure Design
- A05: Security Misconfiguration
- A06: Vulnerable and Outdated Components
- A07: Identification and Authentication Failures
- A08: Software and Data Integrity Failures
- A09: Security Logging and Monitoring Failures
- A10: Server-Side Request Forgery
```

#### Mobile App Testing
```bash
# OWASP Mobile Top 10
- M1: Improper Platform Usage
- M2: Insecure Data Storage
- M3: Insecure Communication
- M4: Insecure Authentication
- M5: Insufficient Cryptography
- M6: Insecure Authorization
- M7: Client Code Quality
- M8: Code Tampering
- M9: Reverse Engineering
- M10: Extraneous Functionality
```

### Testing Tools

#### Network Scanning
- Nmap: Port scanning and service detection
- Masscan: Fast port scanner
- Wireshark: Network traffic analysis

#### Vulnerability Scanning
- Nessus: Comprehensive vulnerability scanner
- OpenVAS: Open-source vulnerability scanner
- Nikto: Web server scanner

#### Web Application Testing
- Burp Suite Professional: Web app security testing
- OWASP ZAP: Web app security scanner
- SQLMap: SQL injection testing
- XSSer: XSS testing

#### Mobile Application Testing
- MobSF: Mobile Security Framework
- Frida: Dynamic instrumentation toolkit
- Objection: Runtime mobile exploration
- APKTool: APK reverse engineering
- Jadx: Dex to Java decompiler

#### API Testing
- Postman: API testing
- curl: Command-line HTTP client
- jq: JSON processor

### Test Cases

#### Authentication Testing
```bash
# Test OTP bypass
- Brute force OTP
- OTP reuse
- OTP expiry bypass
- Rate limit bypass
- Phone number enumeration

# Test JWT vulnerabilities
- Token tampering
- Algorithm confusion
- Token expiry bypass
- Token replay
- Weak signing key
```

#### Authorization Testing
```bash
# Test access control
- Horizontal privilege escalation
- Vertical privilege escalation
- IDOR (Insecure Direct Object Reference)
- Missing function level access control
- Path traversal
```

#### Injection Testing
```bash
# SQL Injection
- Classic SQL injection
- Blind SQL injection
- Time-based SQL injection
- Union-based SQL injection

# NoSQL Injection
- MongoDB injection
- Redis injection

# Command Injection
- OS command injection
- Code injection
```

#### Data Exposure Testing
```bash
# Sensitive data exposure
- PII in logs
- PII in URLs
- PII in error messages
- Unencrypted data transmission
- Weak encryption
```

### Severity Ratings

#### Critical (P0)
- Remote code execution
- SQL injection with data access
- Authentication bypass
- Privilege escalation to admin
- Sensitive data exposure (PII)

**Action**: Fix immediately, delay launch if needed

#### High (P1)
- XSS with session hijacking
- CSRF on critical functions
- Insecure direct object references
- Weak cryptography
- Missing authentication

**Action**: Fix before launch

#### Medium (P2)
- Information disclosure
- Missing security headers
- Weak password policy
- Session fixation
- Clickjacking

**Action**: Fix within 30 days of launch

#### Low (P3)
- Verbose error messages
- Missing rate limiting (non-critical)
- Outdated dependencies (no known exploits)
- Minor configuration issues

**Action**: Fix within 90 days of launch

---

## Remediation Process

### 1. Triage (Within 24 hours)
- Review all findings
- Validate vulnerabilities
- Assign severity ratings
- Prioritize remediation

### 2. Fix Development (Variable)
- Develop fixes for critical/high issues
- Code review fixes
- Test fixes in staging
- Document changes

### 3. Deployment (Coordinated)
- Deploy fixes to production
- Verify fixes working
- Re-test vulnerabilities
- Update documentation

### 4. Verification (Within 1 week)
- Re-test all fixed vulnerabilities
- Confirm no regressions
- Update security documentation
- Close findings

---

## Security Audit Report Template

```markdown
# KrishiAI Security Audit Report

## Executive Summary
- Audit date: [Date]
- Auditor: [Name/Company]
- Scope: [Description]
- Overall risk rating: [Low/Medium/High/Critical]

## Findings Summary
- Critical: X findings
- High: X findings
- Medium: X findings
- Low: X findings

## Critical Findings

### Finding 1: [Title]
**Severity**: Critical
**CVSS Score**: X.X
**Description**: [Detailed description]
**Impact**: [What could happen]
**Affected Components**: [List]
**Proof of Concept**: [Steps to reproduce]
**Remediation**: [How to fix]
**Status**: [Open/Fixed/Accepted Risk]

[Repeat for each finding]

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]

## Conclusion
[Overall assessment]
```

---

## Pre-Launch Security Sign-off

### Required Approvals
- [ ] Security team approval
- [ ] Engineering lead approval
- [ ] Product manager approval
- [ ] Legal team approval (compliance)
- [ ] Executive sponsor approval

### Sign-off Criteria
- [ ] No critical vulnerabilities
- [ ] All high vulnerabilities fixed or accepted risk
- [ ] Penetration test completed
- [ ] Security audit report reviewed
- [ ] Remediation plan for medium/low issues
- [ ] Incident response plan tested
- [ ] Security monitoring operational

---

**Document Version**: 1.0
**Last Updated**: January 2026
**Next Audit**: 6 months post-launch
**Document Owner**: Security Team
