<!--
Path: docs/test-plan.md
-->

# Test Plan

This document describes test coverage, priorities, and test paths for the expanded QA phase.

<!-- --- REPLACE START: normalize structure + clarify scope/prereqs (docs/test-plan.md) --- -->

## 0. Purpose & Scope

This plan focuses on:

- Critical **end-to-end user flows** (Messages/Conversations, auth/session continuity)
- **Reliability** of REST + Socket behavior (reconnect, error states)
- Basic **security hygiene** (XSS/CSRF checks, dependency vulnerability scans)
- Basic **performance checks** (latency, reconnect, load)

**Out of scope (for now):** full penetration testing, formal threat modeling, and production-scale load testing.

## 0.1 Environments & Prerequisites

- Local dev server running (API + client) in a known-good state.
- A minimum set of test users exists (or seeded fixtures).
- You can observe:
  - Browser DevTools (Network + Console)
  - Server logs
  - Optional: CI artifacts (reports, logs)

> **Note on ports/URLs:** replace any localhost port below with your actual dev port(s).

<!-- --- REPLACE END --- -->

## 1. Test Coverage

### 1.1 E2E User Flows

- Creating a new conversation and navigating the UI
- Sending and receiving messages via both REST and Socket channels
- Handling error and loading states

### 1.2 Performance Tests (Baseline)

- Testing socket disconnections and reconnections
- Measuring page load times and API response times

### 1.3 Security Scans (Baseline)

- Detecting XSS and CSRF vulnerabilities using OWASP ZAP
- Automating dependency scans (e.g., `npm audit`)

### 1.4 Dependency Vulnerability

- Automated scanning with GitHub Actions workflow
- Generating and storing reports as artifacts

## 2. Priorities

| Priority | Test Type           | Description                                        |
| -------- | ------------------- | -------------------------------------------------- |
| High     | E2E User Flows      | Ensure critical user journeys work correctly       |
| Medium   | Performance Tests   | Measure responsiveness and reconnection stability  |
| Low      | Security Scans      | Identify vulnerabilities without blocking deploys  |

## 3. Test Paths

### 3.1 E2E User Flows

1. **Conversation Creation**
   - Navigate to `/messages`
   - Click **New Conversation**
   - Enter user ID and start conversation
   - Confirm URL changes to `/chat/:userId`

2. **Message Send & Receive**
   - Type a message and send
   - Verify the message appears in the thread
   - Simulate an incoming socket message and verify rendering

3. **Error & Loading States**
   - Simulate API delay (e.g., `res.delay`) and verify loading spinner
   - Force a 500 error and verify the error component displays
   - Simulate socket connection error and verify user notification

<!-- --- REPLACE START: performance section cleanup (remove inline REPLACE markers inside bullets) --- -->

### 3.2 Performance Tests

- **Socket Reconnect** (`performance/socket-reconnect.test.js`)
  - Sends a message, disconnects the socket, then verifies reconnection behavior
  - Verifies: message delivery after reconnect, UI state consistency, no duplicate events

- **Load Test** (`performance/load.test.js`)
  - Measures page load time and `/api/messages/overview` response time under load
  - Verifies: API stays responsive, error rate acceptable, no timeouts beyond thresholds

> Adjust file paths above to match the repository layout (these are logical placeholders if paths differ).

<!-- --- REPLACE END --- -->

<!-- --- REPLACE START: fix duplicated heading + make security section consistent --- -->

### 3.3 Security Scans

- **OWASP ZAP** (`security/zap-config.json`)
  - Quick scan configuration for XSS and CSRF against `http://localhost:<PORT>`
  - Run mode: baseline scan first; expand rules only if false positives are manageable

- **Dependency Check** (`security/dependency-check.yml`)
  - Scheduled GitHub Actions workflow
  - Runs `npm audit` and stores reports as CI artifacts
  - If the project contains non-Node components (e.g., Java/Gradle), include those scans **only if applicable**

<!-- --- REPLACE END --- -->

## 4. Reporting & Next Steps

- Store test results as CI artifacts:
  - Dependency scan reports (e.g., `npm-audit.json`, HTML/XML if generated)
  - Load/performance reports (K6 metrics, Artillery reports) if used
  - E2E logs and videos (e.g., Cypress/Playwright) if used

- Document findings in the backlog for bug prioritization
- Address performance regressions above thresholds immediately

---

**This test plan covers QA-phase requirements before moving to the next development milestone.**

