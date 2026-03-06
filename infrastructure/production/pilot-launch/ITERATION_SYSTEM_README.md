# KrishiAI Iteration Management System

Comprehensive system for managing iterations based on pilot feedback, enabling continuous improvement through systematic issue tracking, performance optimization, ML model retraining, and documentation updates.

## Overview

The Iteration Management System provides:
- **Issue Prioritization**: P0-P3 priority framework for bugs, features, and improvements
- **Bug Tracking**: Complete workflow from identification to resolution
- **Performance Monitoring**: Automatic bottleneck detection and optimization tracking
- **ML Model Retraining**: Data collection and retraining pipeline for model improvements
- **Documentation Updates**: Automated identification of documentation gaps from support questions

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Feedback Collection System                  │
│  (NPS, Feature Surveys, Pain Points, Coordinator)       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│           Iteration Management System                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │    Issue     │  │ Performance  │  │  ML Model    │ │
│  │ Prioritizer  │  │   Monitor    │  │  Retrainer   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                   │
│  │     Docs     │  │  Iteration   │                   │
│  │   Analyzer   │  │  Dashboard   │                   │
│  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Implementation & Deployment                 │
└─────────────────────────────────────────────────────────┘
```

## Requirements

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Prometheus (for performance metrics)
- SMTP server (for alerts)

## Quick Start

### 1. Install Dependencies

```bash
cd infrastructure/production/pilot-launch
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=krishiai_db
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Prometheus
PROMETHEUS_URL=http://localhost:9090

# Email Alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password
ALERT_EMAIL=support@krishiai.com

# Server
ITERATION_PORT=3102
```

### 3. Run Database Migrations

```bash
psql -U postgres -d krishiai_db -f migrations/create-iteration-tables.sql
```

### 4. Start Iteration Manager

```bash
npm run start:iteration
```

The service will be available at `http://localhost:3102`

## API Endpoints

### Issue Management

#### Create Issue
```bash
POST /api/iteration/issues
Content-Type: application/json

{
  "title": "Disease detection slow on low-end devices",
  "description": "Users with 2GB RAM report 5+ second inference times",
  "type": "performance",
  "severity": "high",
  "affectedUsers": 150,
  "impactScore": 8,
  "source": "pain_point",
  "sourceId": "uuid-of-pain-point"
}
```

Response:
```json
{
  "success": true,
  "issue": {
    "id": "uuid",
    "title": "Disease detection slow on low-end devices",
    "priority": "P1",
    "status": "open",
    "affectedUsers": 150,
    "impactScore": 8
  }
}
```

#### Get Issues
```bash
GET /api/iteration/issues?status=open&priority=P1&limit=20
```

#### Update Issue
```bash
PATCH /api/iteration/issues/:id
Content-Type: application/json

{
  "status": "in_progress",
  "assignedTo": "dev@krishiai.com"
}
```

#### Get Issue Summary
```bash
GET /api/iteration/issues/summary
```

### Performance Monitoring

#### Detect Bottlenecks
```bash
POST /api/iteration/performance/detect
```

Automatically queries Prometheus for:
- API response times > 500ms
- Error rates > 1%
- Creates P0/P1 issues for critical bottlenecks

#### Get Bottlenecks
```bash
GET /api/iteration/performance/bottlenecks
```

### ML Model Retraining

#### Queue Retraining Job
```bash
POST /api/iteration/ml/retrain
Content-Type: application/json

{
  "modelName": "disease_detector",
  "reason": "Accuracy dropped to 88% on real-world data",
  "datasetSize": 5000,
  "currentAccuracy": 0.88,
  "targetAccuracy": 0.92
}
```

#### Get Retraining Jobs
```bash
GET /api/iteration/ml/retraining-jobs?status=pending
```

#### Collect Real-World Data
```bash
POST /api/iteration/ml/collect-data
Content-Type: application/json

{
  "modelName": "disease_detector",
  "period": "7"
}
```

### Documentation Updates

#### Suggest Documentation Update
```bash
POST /api/iteration/docs/suggest
Content-Type: application/json

{
  "category": "faq",
  "question": "ऐप ऑफलाइन क्यों नहीं काम कर रहा है?",
  "answer": "ऐप ऑफलाइन काम करता है। सुनिश्चित करें कि आपने पहले डेटा डाउनलोड किया है।",
  "language": "hi",
  "frequency": 15,
  "source": "chatbot"
}
```

#### Get Documentation Suggestions
```bash
GET /api/iteration/docs/suggestions?status=pending&language=hi
```

#### Analyze Support Questions
```bash
POST /api/iteration/docs/analyze-support
Content-Type: application/json

{
  "period": "30"
}
```

Analyzes:
- Chatbot queries with low confidence (<85%)
- Pain points in usability/language categories
- Generates documentation suggestions

### Iteration Dashboard

#### Get Dashboard
```bash
GET /api/iteration/dashboard
```

Returns comprehensive overview:
```json
{
  "issues": {
    "byPriority": [
      {"priority": "P0", "count": 2},
      {"priority": "P1", "count": 5},
      {"priority": "P2", "count": 12},
      {"priority": "P3", "count": 8}
    ],
    "total": 27
  },
  "performanceBottlenecks": 3,
  "mlRetraining": {
    "byStatus": [
      {"status": "pending", "count": 2},
      {"status": "in_progress", "count": 1},
      {"status": "completed", "count": 5}
    ],
    "total": 8
  },
  "documentationSuggestions": 15,
  "recentResolutions": 12,
  "timestamp": "2026-01-15T10:30:00Z"
}
```

## Priority Framework

### P0 - Critical (Immediate Action)
- Service outages
- Data loss or corruption
- Security vulnerabilities
- Complete feature failures affecting all users
- **SLA**: Fix within 4 hours

### P1 - High (Action within 24 hours)
- Major feature broken for significant users (>100)
- Performance degradation >2x threshold
- ML model accuracy drop >5%
- Critical user workflows blocked
- **SLA**: Fix within 24 hours

### P2 - Medium (Action within 1 week)
- Minor feature issues
- Moderate performance issues
- Usability improvements
- Documentation gaps
- **SLA**: Fix within 1 week

### P3 - Low (Action within 1 month)
- Nice-to-have improvements
- Minor UI issues
- Low-impact enhancements
- **SLA**: Fix within 1 month

## Workflows

### Bug Fix Workflow

1. **Identification**
   - Automatic: Pain points, NPS feedback, performance monitoring
   - Manual: Coordinator reports, user support tickets

2. **Prioritization**
   - System calculates priority based on:
     - Severity (critical/high/medium/low)
     - Affected users count
     - Impact score (1-10)

3. **Assignment**
   - P0/P1: Automatic alert to team
   - P2/P3: Added to backlog

4. **Resolution**
   - Developer implements fix
   - Updates issue status to "in_progress"
   - Deploys fix
   - Updates status to "resolved"

5. **Verification**
   - Monitor metrics post-deployment
   - Collect user feedback
   - Close issue if verified

### Performance Optimization Workflow

1. **Detection**
   - Automatic monitoring queries Prometheus every hour
   - Detects: response time >500ms, error rate >1%

2. **Issue Creation**
   - Creates P0/P1 issue automatically
   - Includes: service, endpoint, current value, threshold

3. **Investigation**
   - Developer analyzes bottleneck
   - Identifies root cause (database, API, caching, etc.)

4. **Optimization**
   - Implements fix (add index, optimize query, add caching)
   - Deploys to production

5. **Verification**
   - Monitor metrics for 24 hours
   - Mark bottleneck as resolved if metrics improve

### ML Model Retraining Workflow

1. **Data Collection**
   - System collects real-world data continuously
   - Tracks: disease detections, crop recommendations, price forecasts

2. **Accuracy Monitoring**
   - Monitors model accuracy in production
   - Alerts if accuracy drops >5%

3. **Retraining Decision**
   - Manual: Team decides to retrain based on feedback
   - Automatic: Triggered if accuracy drops below threshold

4. **Retraining Job**
   - Queue retraining job with:
     - Model name
     - Dataset size
     - Current accuracy
     - Target accuracy

5. **Training**
   - Background worker processes job
   - Trains model on new data
   - Evaluates on validation set

6. **Deployment**
   - If new accuracy > target: deploy to production
   - If not: investigate and retry with different parameters

7. **Monitoring**
   - Monitor new model performance
   - Compare to previous version

### Documentation Update Workflow

1. **Gap Identification**
   - Analyze chatbot queries with low confidence
   - Analyze pain points in usability/language categories
   - Coordinator feedback

2. **Suggestion Creation**
   - System creates documentation suggestion
   - Includes: question, frequency, source

3. **Review**
   - Team reviews suggestions
   - Prioritizes by frequency
   - Writes/updates documentation

4. **Approval**
   - Technical writer reviews
   - Approves for publication

5. **Publication**
   - Update FAQ, troubleshooting guide, or user guide
   - Publish to website/in-app help
   - Mark suggestion as published

6. **Verification**
   - Monitor if question frequency decreases
   - Collect feedback on documentation quality

## Database Schema

### Tables

- **issues**: Bug and feature tracking
- **performance_bottlenecks**: Performance issue tracking
- **ml_retraining_jobs**: ML model retraining queue
- **documentation_updates**: Documentation gap tracking
- **issue_comments**: Discussion on issues
- **iteration_metrics**: Iteration progress tracking

### Views

- **open_issues_by_priority**: Summary of open issues
- **active_bottlenecks_summary**: Performance bottleneck summary
- **ml_retraining_progress**: ML retraining progress
- **documentation_gaps**: Frequently asked questions without answers
- **iteration_velocity**: Issues resolved per week

### Functions

- **create_issue_from_pain_point()**: Auto-creates issues from high/critical pain points
- **update_iteration_metrics()**: Calculates iteration metrics

## Integration with Feedback System

The Iteration Manager automatically integrates with the Feedback Collection System:

### Automatic Issue Creation

1. **From Pain Points**
   - High/critical pain points automatically create P1/P0 issues
   - Trigger: `create_issue_from_pain_point()` function

2. **From NPS Detractors**
   - NPS scores 0-6 trigger manual review
   - Team creates issues based on feedback reasons

3. **From Feature Surveys**
   - Features with satisfaction <3 trigger investigation
   - Team creates improvement issues

4. **From Performance Monitoring**
   - Bottlenecks automatically create P0/P1 issues
   - Includes service, endpoint, and metrics

## Monitoring & Alerts

### Email Alerts

Automatic alerts sent for:
- **P0 Issues**: Immediate alert
- **P1 Issues**: Alert within 1 hour
- **Performance Bottlenecks**: Critical/high severity
- **ML Model Accuracy Drop**: >5% decrease

### Dashboard Metrics

Track in Grafana:
- Open issues by priority
- Issue resolution time
- Performance bottleneck count
- ML retraining job status
- Documentation gap count

## Iteration Metrics

Track iteration progress with:

```sql
SELECT * FROM update_iteration_metrics(
  1,  -- iteration number
  '2026-01-01',  -- start date
  '2026-01-07'   -- end date
);
```

Metrics calculated:
- Issues opened/resolved
- Bugs fixed
- Features added
- Performance improvements
- ML models retrained
- Docs updated
- Average resolution time
- NPS score change

## Best Practices

### Issue Management

1. **Prioritize Ruthlessly**
   - Focus on P0/P1 issues first
   - Don't let P2/P3 accumulate

2. **Update Status Regularly**
   - Keep issue status current
   - Add comments for context

3. **Link to Source**
   - Always link to source (pain point, NPS feedback)
   - Provides context for resolution

### Performance Optimization

1. **Monitor Continuously**
   - Run bottleneck detection hourly
   - Set up Grafana alerts

2. **Fix Root Causes**
   - Don't just treat symptoms
   - Investigate underlying issues

3. **Verify Improvements**
   - Monitor metrics for 24 hours post-fix
   - Ensure no regressions

### ML Model Retraining

1. **Collect Quality Data**
   - Only use high-confidence predictions (>90%)
   - Validate data quality before training

2. **Set Realistic Targets**
   - Target accuracy should be achievable
   - Consider diminishing returns

3. **A/B Test New Models**
   - Deploy to 10% of users first
   - Compare metrics before full rollout

### Documentation Updates

1. **Prioritize by Frequency**
   - Focus on most-asked questions first
   - Update high-traffic documentation

2. **Keep It Simple**
   - Use plain language
   - Provide examples

3. **Multilingual Support**
   - Update Hindi and Marathi versions
   - Ensure translations are accurate

## Troubleshooting

### Issues not being created automatically

1. Check database trigger is enabled:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_create_issue_from_pain_point';
```

2. Verify pain point severity is high/critical

3. Check database logs for errors

### Performance bottlenecks not detected

1. Verify Prometheus is accessible:
```bash
curl http://localhost:9090/api/v1/query?query=up
```

2. Check service /metrics endpoints are working

3. Verify Prometheus queries are correct

### ML retraining jobs stuck in pending

1. Check Redis queue:
```bash
redis-cli LLEN ml_retraining_queue
```

2. Verify background worker is running

3. Check worker logs for errors

### Documentation suggestions not appearing

1. Verify chatbot conversations are being logged

2. Check confidence threshold (<0.85)

3. Verify frequency threshold (>=5)

## Files Structure

```
infrastructure/production/pilot-launch/
├── iteration-manager.ts                 # Main iteration service
├── migrations/
│   └── create-iteration-tables.sql     # Database schema
├── ITERATION_SYSTEM_README.md          # This file
├── package.json                         # Dependencies
└── .env.example                         # Environment template
```

## Next Steps

1. **Deploy to Production**
   - Set up environment variables
   - Run database migrations
   - Start iteration manager service

2. **Configure Monitoring**
   - Set up Grafana dashboards
   - Configure email alerts
   - Set up Prometheus queries

3. **Train Team**
   - Issue prioritization framework
   - Workflow processes
   - Dashboard usage

4. **Start Iterating**
   - Review issues daily
   - Fix P0/P1 issues immediately
   - Plan P2/P3 for sprints

## Support

For issues or questions:
- Email: support@krishiai.com
- Documentation: See TASK_19.3_IMPLEMENTATION.md

## License

MIT
