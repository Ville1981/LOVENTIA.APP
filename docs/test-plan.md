# Test Plan

This document describes test coverage, priorities, and test paths for the expanded QA phase.

## 1. Test Coverage

- **E2E User Flows**
  - Creating a new conversation and navigating the UI
  - Sending and receiving messages via both REST and Socket channels
  - Handling error and loading states

- **Performance Tests**
  - Testing socket disconnections and reconnections
  - Measuring page load times and API response times

- **Security Scans**
  - Detecting XSS and CSRF vulnerabilities using OWASP ZAP
  - Automating dependency scans (npm audit, Gradle DependencyCheck)

- **Dependency Vulnerability**
  - Automated scanning with GitHub Actions workflow
  - Generating and storing reports as artifacts

## 2. Priorities

| Priority | Test Type         | Description                                           |
| -------- | ----------------- | ----------------------------------------------------- |
| High     | E2E User Flows    | Ensure critical user journeys work correctly          |
| Medium   | Performance Tests | Measure application responsiveness and scalability    |
| Low      | Security Scans    | Identify vulnerabilities without blocking deployments |

## 3. Test Paths

### 3.1 E2E User Flows

1. **Conversation Creation**:
   - Navigate to `/messages`
   - Click **New Conversation**
   - Enter user ID and start conversation
   - Confirm URL changes to `/chat/:userId`

2. **Message Send & Receive**:
   - Type a message and send
   - Verify the message appears in the list
   - Simulate incoming socket message and verify rendering

3. **Error & Loading States**:
   - Simulate API delay (`res.delay`) and verify loading spinner
   - Force a 500 error and verify the error component displays
   - Simulate socket connection error and verify notification

### 3.2 Performance Tests

- **Socket Reconnect** (`performance/socket-reconnect.test.js`)
  // --- REPLACE START: socket reconnect flow description ---
  - Sends messages, disconnects socket, then tests reconnection
    // --- REPLACE END ---

- **Load Test** (`performance/load.test.js`)
  // --- REPLACE START: load test description ---
  - Measures page load time and `/api/messages/overview` response time under load
    // --- REPLACE END ---

### 3.3 Security Scans Security Scans

- **OWASP ZAP** (`security/zap-config.json`)
  - Quick scan configuration for XSS and CSRF against `http://localhost:3000`

- **Dependency Check** (`security/dependency-check.yml`)
  - Scheduled GitHub Actions workflow running `npm audit` and Gradle DependencyCheck

## 4. Reporting & Next Steps

- Store test results as CI artifacts:
  - `dependency-check-report.html` / `.xml`
  - K6 metrics and Artillery reports
  - Cypress videos and logs

- Document findings in the backlog for bug prioritization

- Address performance regressions above thresholds immediately

---

**This test plan covers QA-phase requirements before moving to the next development milestone.**
