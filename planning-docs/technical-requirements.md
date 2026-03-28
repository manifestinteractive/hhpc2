# Technical Requirements

## 1. Overview

The Crew Readiness Platform shall be implemented as a near real-time, internal decision-support web application designed to ingest, normalize, analyze, and visualize simulated physiological and activity-based sensor data for multiple crew members.

The technical design shall prioritize:

- rapid prototyping with a clear path to production-quality architecture
- near real-time data processing using a single deployable application
- explainability, auditability, and human-in-the-loop workflows
- low operational complexity suitable for a demo or skunkworks-style internal tool
- a modern, maintainable full-stack TypeScript architecture

This system is intended to simulate the kind of internal tooling that could support human performance scientists, flight surgeons, and mission support personnel operating in mission-critical environments.

---

## 2. Technical Goals

### 2.1 Primary Goals

- Deliver a working end-to-end platform using a single-service architecture
- Simulate realistic physiological data conditions without requiring physical hardware
- Support near real-time ingestion, processing, scoring, and visualization
- Provide a dashboard-oriented user experience optimized for internal operational review
- Preserve traceability from raw data to derived outputs and AI-assisted summaries

### 2.2 Secondary Goals

- Minimize infrastructure overhead for local development and deployment
- Support rapid iteration of UI, business logic, and detection rules
- Establish technical patterns that could scale into a more distributed architecture if needed

---

## 3. Architecture

### 3.1 Architectural Style

The system shall use a modular monolithic architecture implemented within a single Next.js application.

This architecture is intentionally selected to balance:

- rapid development speed
- low deployment complexity
- maintainability
- clear separation of responsibilities within a single codebase

The system shall be logically divided into the following layers:

- Presentation Layer
- Application Layer
- Data Access Layer
- Processing and Simulation Layer
- AI Integration Layer

Although deployed as a single application, internal boundaries shall be maintained to ensure future extensibility.

### 3.2 High-Level Flow

1. Simulated sensor data is generated according to predefined crew baselines and scenarios
2. Data is ingested into the application via internal API routes or scheduled server-side processes
3. Raw data is persisted unchanged for traceability
4. Normalization and processing logic produces derived metrics, quality indicators, and events
5. Readiness scoring is computed based on defined heuristics and baseline deviations
6. AI-assisted summaries are generated from structured system outputs
7. Users review results through dashboard interfaces for multi-crew and individual analysis

### 3.3 System Boundaries

The demo system shall not require:

- separate worker services
- external queue infrastructure
- multiple deployments
- direct integration with physical devices or NASA systems

The system shall be designed so these can be added later without major rework.

---

## 4. Technology Stack

### 4.1 Core Application Framework

- Next.js
- React
- TypeScript

### 4.2 UI and Design System

- ShadCN UI
- Radix UI primitives
- Tailwind CSS

### 4.3 Data Layer

- Supabase PostgreSQL
- Supabase authentication
- Optional Supabase Row Level Security for role-based controls

### 4.4 AI Integration

- OpenAI API
- Provider abstraction layer within the codebase

### 4.5 Tooling

- ESLint
- Prettier
- TypeScript strict mode
- npm or pnpm
- Environment variable management for local and hosted environments

### 4.6 Deployment

- Local development environment for all engineering work
- Vercel for hosted deployment
- Supabase as managed backend data platform

---

## 5. Technology Selection Rationale

### 5.1 Next.js

Next.js shall be used as the full-stack application framework because it supports:

- a single-service delivery model
- server-side processing and API routes within the same application
- rapid development of internal dashboards
- production-ready deployment on Vercel
- straightforward local development with minimal operational burden

This aligns with the requirement to move quickly while still producing a system that feels production-capable.

### 5.2 ShadCN UI + Radix + Tailwind CSS

ShadCN UI shall be used as the primary UI component foundation because it supports:

- rapid assembly of dashboard-style internal tools
- accessible UI primitives through Radix
- composability and low lock-in
- visual consistency across operational workflows
- full control over source code and component behavior

Tailwind CSS shall be used for styling because it enables:

- fast iteration
- predictable design tokens
- consistent layout patterns
- maintainable utility-first styling within a dashboard-heavy application

This stack is especially appropriate for an internal decision-support tool where clarity, speed, and component flexibility matter more than brand-heavy design customization.

### 5.3 Supabase

Supabase shall be used as the data platform because it provides:

- managed PostgreSQL
- authentication
- developer-friendly local and hosted workflows
- low operational complexity
- a clear path to more advanced data and access-control patterns if needed

Supabase is appropriate for this demo because it reduces backend infrastructure overhead while still supporting strong relational modeling and auditability.

### 5.4 OpenAI API

The OpenAI API shall be used for AI-assisted summarization because it enables rapid implementation of:

- operator-facing summaries
- anomaly explanation assistance
- early warning text generation for human review

However, AI integration shall be abstracted behind an internal provider interface so that the application does not tightly couple business logic to a single AI vendor.

In this project, "keep abstracted" means:

- the application should call an internal summary service or utility
- that internal layer is responsible for formatting prompts and invoking OpenAI
- future provider changes or mock providers can be introduced without rewriting core application logic

---

## 6. Application Structure

### 6.1 Required Logical Modules

The application shall be organized into modules that separate concerns clearly, including:

- `app/` or `src/app/` for routes and UI composition
- `components/` for reusable presentational and interactive components
- `lib/` for shared utilities, helpers, and infrastructure code
- `lib/simulation/` for signal generation, scenario injection, and baseline configuration
- `lib/processing/` for normalization, smoothing, scoring, and event detection
- `lib/ai/` for provider abstraction, prompt construction, and summary generation
- `lib/db/` for Supabase access and query helpers
- `types/` for shared domain types and interfaces

### 6.2 Domain-Oriented Organization

The codebase should emphasize domain-driven grouping where practical, such as:

- crew members
- signals
- events
- readiness scoring
- summaries
- admin monitoring

This structure shall make it easy for reviewers to understand how the system maps from domain concepts to code.

---

## 7. Data Architecture

### 7.1 Data Model Principles

The system shall preserve explicit separation between:

- raw ingested data
- normalized data
- derived events
- readiness assessments
- AI-generated summaries

This separation is required to support:

- auditability
- explainability
- debugging
- confidence scoring
- future recalculation of outputs without losing original inputs

### 7.2 Core Entities

The platform shall include, at minimum, the following core entities:

- `crew_members`
- `sensor_streams`
- `raw_readings`
- `normalized_readings`
- `detected_events`
- `readiness_scores`
- `ai_summaries`
- `summary_reviews`
- `ingestion_runs`
- `system_logs`

### 7.3 Raw Data Preservation

Raw readings shall be stored as close to the original payload as possible, including:

- source identifier
- timestamp
- signal type
- original value
- raw metadata
- ingestion batch or run identifier

The system shall never overwrite raw inputs during normalization.

### 7.4 Normalized Data

Normalized readings shall include:

- standardized timestamp
- canonical signal type
- normalized numeric value
- confidence score
- processing metadata
- relation to original raw input or input window

### 7.5 Event Records

Detected events shall include:

- event type
- severity
- confidence
- affected crew member
- time range
- contributing signals
- human-readable explanation
- source rule or logic identifier

### 7.6 Readiness Scores

Readiness score records shall include:

- crew member
- time window
- composite score
- sub-factor scores
- confidence or quality modifier
- score explanation metadata

### 7.7 AI Summary Records

AI summary records shall include:

- crew member or dashboard scope
- summary text
- structured input context
- generation timestamp
- provider/model metadata
- approval or dismissal state
- reviewer metadata if reviewed

---

## 8. Simulation Layer Requirements

### 8.1 Role of Simulation

Because the demo will not use physical sensors, the simulation layer shall be treated as a first-class subsystem rather than a placeholder.

It shall be capable of generating realistic physiological signal patterns and operational data anomalies.

### 8.2 Supported Signal Types

The simulation layer shall support generation of:

- heart rate
- heart rate variability
- body or skin temperature
- activity or motion-derived values
- sleep duration and quality indicators

### 8.3 Scenario System

The simulation subsystem shall support scenario-driven behavior, including:

- normal baseline operation
- gradual fatigue or recovery patterns
- acute stress events
- data gaps
- sensor dropouts
- conflicting or low-confidence data
- irregular sampling windows

### 8.4 Crew Baselines

The simulation layer shall allow different crew members to have distinct baselines and response patterns.

This is required to support per-user deviation analysis rather than simplistic universal thresholds.

### 8.5 Controllability

The simulation subsystem shall allow:

- manual scenario selection
- parameterized run durations
- seeded deterministic playback when needed
- repeatable test conditions for demos and regression testing

---

## 9. Processing Pipeline

### 9.1 Processing Strategy

The application shall use an internal processing pipeline implemented within the single Next.js service.

This pipeline may be triggered by:

- ingestion requests
- scheduled jobs
- user-initiated scenario runs
- server-side actions

### 9.2 Processing Steps

The minimum processing pipeline shall include:

1. payload validation
2. raw persistence
3. normalization
4. quality assessment
5. anomaly detection
6. readiness scoring
7. summary context generation
8. optional AI summarization

### 9.3 Near Real-Time Behavior

Although true streaming infrastructure is out of scope, the system shall simulate near real-time processing by:

- generating or ingesting readings in short intervals
- processing new data on frequent cadence
- refreshing dashboard state at a user-appropriate interval

The user experience should feel operationally live even if internally implemented using lightweight polling or scheduled updates.

### 9.4 Reprocessing

The architecture shall allow derived outputs to be recomputed from stored raw or normalized data if scoring rules or thresholds change.

---

## 10. API and Server-Side Design

### 10.1 API Style

The system shall use internal Next.js route handlers and server-side functions as the primary application API surface.

The API layer shall expose endpoints or server actions for:

- simulation control
- ingestion
- crew list and overview retrieval
- individual crew detail retrieval
- event retrieval
- readiness score retrieval
- summary generation and review
- admin and ingestion monitoring

### 10.2 API Design Principles

The API shall be designed to support:

- predictable payloads
- strong typing
- role-aware access control
- separation between internal processing concerns and UI concerns

### 10.3 Internal vs Public Access

The system shall not expose unrestricted public endpoints for simulation, AI generation, or operational data.

Access to these capabilities shall be gated behind authenticated, role-aware controls.

---

## 11. Authentication and Authorization

### 11.1 Authentication

The system shall use Supabase Authentication for user sign-in and session management.

### 11.2 Authorization

The system shall implement simple role-based access controls, with roles such as:

- admin
- analyst
- viewer

### 11.3 Access Expectations

At a minimum:

- only authenticated users may access the dashboard
- only authorized users may trigger simulation runs
- only authorized users may invoke AI summary generation
- only authorized users may review or approve AI summaries
- admin users may access ingestion and system health views

### 11.4 Purpose

Role-based access is required primarily to:

- limit public access to system capabilities
- reduce accidental or abusive API and AI usage
- better simulate realistic internal-tool usage patterns

---

## 12. AI Integration Requirements

### 12.1 Scope of AI Use

AI shall be used only as a secondary assistive layer.

It may be used for:

- summarizing recent operational state
- describing anomalies in plain language
- flagging areas that may warrant human attention

It shall not be used for:

- autonomous readiness decisions
- medical conclusions
- hidden or opaque scoring logic

### 12.2 Provider Abstraction

AI access shall be wrapped in an internal abstraction layer that isolates:

- provider-specific request logic
- prompt construction
- output normalization
- retry and error handling

This design is required to:

- reduce coupling
- simplify testing
- allow mock or fallback behavior
- support future provider changes without broad refactoring

### 12.3 Summary Inputs

AI summaries should be generated from structured system outputs, such as:

- recent score trends
- detected events
- confidence flags
- relevant signal windows

This ensures the AI layer operates on curated facts rather than raw uncontrolled data.

### 12.4 Reviewability

All AI outputs shall remain reviewable and dismissible by human users.

---

## 13. User Interface Requirements

### 13.1 Interface Type

The application shall provide an internal dashboard-style interface optimized for desktop operational review.

### 13.2 Dashboard Modes

The UI shall support at least two primary modes:

- Multi-crew overview
- Individual crew deep-dive

### 13.3 ShadCN Usage

ShadCN UI components shall be used as the primary interface foundation, especially for:

- dashboard shell layout
- data tables
- filters
- navigation
- cards
- dialogs
- form controls
- chart containers and supporting UI chrome

### 13.4 Charting

The application shall use a charting approach compatible with the selected ShadCN-based dashboard design.

Charts shall support:

- time-series visualization
- event overlays
- quality and confidence indicators
- clear axis labeling and legends

### 13.5 Design Priorities

The UI shall prioritize:

- quick interpretation
- visual hierarchy
- consistency across pages
- low cognitive load
- clear distinction between data quality issues and physiological concerns

---

## 14. Local Development Requirements

### 14.1 Local-First Development

The project shall be fully runnable in a local development environment.

Developers shall be able to:

- run the Next.js application locally
- connect to local or hosted Supabase environments
- execute simulation scenarios locally
- test ingestion, scoring, and summary flows without requiring production deployment

### 14.2 Environment Management

The application shall use environment variables for:

- Supabase configuration
- OpenAI configuration
- feature flags
- simulation defaults
- environment-specific settings

### 14.3 Developer Experience

The local setup should be optimized for minimal friction and fast iteration.

---

## 15. Deployment Requirements

### 15.1 Hosting

The production demo shall be deployable to Vercel.

### 15.2 Backend Services

The application shall avoid dependence on separately managed backend services where possible.

### 15.3 Managed Data Platform

Supabase shall provide the persistent data layer and authentication services in the hosted environment.

### 15.4 Deployment Simplicity

The architecture shall be deployable with minimal environment-specific customization.

---

## 16. Security Requirements

### 16.1 General Security Posture

The system shall follow a reasonable internal-tool security posture appropriate for a restricted demo environment.

### 16.2 Input Protection

The application shall validate and sanitize all inbound payloads, especially for:

- simulation parameters
- ingestion endpoints
- AI generation requests
- admin actions

### 16.3 Secret Management

API keys and credentials shall never be exposed to the client and shall be managed through secure environment variables.

### 16.4 Role Protection

Privileged operations shall be server-side only and protected by authentication and role checks.

### 16.5 Data Exposure

The system shall avoid exposing unnecessary raw internal metadata in public-facing responses.

---

## 17. Observability Requirements

### 17.1 Logging

The application shall log key operational events, including:

- simulation runs
- ingestion attempts
- processing failures
- summary generation requests
- review actions

### 17.2 Monitoring Views

The UI shall include basic observability views for:

- ingestion health
- failed records
- processing errors
- data quality issues

### 17.3 Auditability

The system shall preserve enough metadata to explain:

- where a readiness score came from
- which events influenced it
- what structured context was passed into AI summaries
- who reviewed or dismissed AI outputs

---

## 18. Performance Requirements

### 18.1 Dashboard Responsiveness

Dashboard views shall load quickly enough to feel operationally responsive for demo use.

### 18.2 Efficient Queries

The data model and queries shall support efficient retrieval of:

- recent multi-crew summaries
- individual signal windows
- event lists by time range
- latest readiness states

### 18.3 Update Cadence

The application shall support frequent updates suitable for near real-time simulation without requiring full page reloads.

### 18.4 Scope Awareness

Performance optimization shall focus on operational realism and clarity rather than premature distributed-system complexity.

---

## 19. Quality Requirements

### 19.1 Code Quality

The codebase shall enforce:

- TypeScript strict typing
- ESLint linting
- Prettier formatting
- reusable domain-level abstractions
- separation of UI code from processing logic

### 19.2 Maintainability

The application shall be structured so that scoring rules, event detection logic, and simulation scenarios can be updated without broad architectural changes.

### 19.3 Testability

Core business logic should be designed to support targeted testing, especially for:

- normalization
- anomaly detection
- readiness scoring
- scenario simulation
- AI summary input construction

---

## 20. Tradeoffs and Intentional Decisions

### 20.1 Single-Service Architecture

The project intentionally uses a modular monolith rather than multiple services in order to:

- reduce deployment complexity
- speed up development
- keep the demo self-contained
- preserve a clear path to future decomposition if needed

### 20.2 Simulated Near Real-Time Instead of True Streaming

The project intentionally simulates near real-time behavior without standing up dedicated streaming infrastructure in order to:

- preserve realism in the user experience
- avoid unnecessary operational overhead
- keep the build aligned with demo scope

### 20.3 AI as Secondary Layer

The project intentionally keeps AI assistive rather than authoritative in order to:

- preserve explainability
- reflect human-in-the-loop operational requirements
- avoid overstating AI confidence in mission-critical contexts

### 20.4 ShadCN-Centered UI

The project intentionally uses ShadCN UI as the dashboard foundation in order to:

- move quickly
- maintain accessibility and consistency
- keep full code ownership
- produce an internal-tool experience that feels polished without excessive front-end overhead

---

## 21. Future Technical Evolution

The architecture should allow future evolution toward:

- externalized ingestion services
- background job queues
- more advanced analytics pipelines
- additional role types
- richer simulation engines
- support for real sensor integrations
- multi-system interoperability with external mission-support tools
