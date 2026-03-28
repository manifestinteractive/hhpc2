# Functional Requirements

## 1. System Overview

The system shall provide an end-to-end pipeline for ingesting, normalizing, analyzing, and visualizing physiological and activity-based data to support crew readiness evaluation.

The system shall operate on simulated sensor data designed to replicate real-world characteristics, including noise, inconsistency, and failure conditions.

---

## 2. Data Simulation Layer (Sensor Emulation)

### 2.1 Purpose

The system shall include a data simulation layer capable of generating realistic physiological and activity signals in the absence of real hardware sensors.

### 2.2 Capabilities

The simulation layer shall:

- Generate time-series data for multiple signal types:
  - Heart rate (BPM)
  - Heart rate variability (HRV)
  - Activity level (derived motion)
  - Skin/body temperature
  - Sleep duration/quality (derived)
- Support multiple simulated "crew members" with distinct baselines

- Produce data at configurable sampling intervals

### 2.3 Data Realism Requirements

The simulation layer shall mimic real-world data characteristics, including:

- Missing data points
- Sensor dropout (flatline or null values)
- Irregular sampling intervals
- Random noise and signal jitter
- Sudden spikes or drops
- Conflicting signals across data sources

### 2.4 Scenario Injection

The system shall support predefined and configurable test scenarios, including:

- Gradual fatigue trend (declining sleep, rising resting heart rate)
- Acute stress event (sudden HR spike, elevated activity)
- Sensor malfunction (flatline, intermittent gaps)
- Recovery period (improving signals over time)

The system shall allow toggling or scheduling of these scenarios.

---

## 3. Data Ingestion

### 3.1 Input Handling

The system shall:

- Accept data via API and/or file-based ingestion
- Support multiple input schemas
- Accept batched and streaming-like inputs

### 3.2 Data Validation

The system shall:

- Validate schema and required fields
- Handle out-of-order timestamps
- Detect and log invalid or malformed records

### 3.3 Data Persistence

The system shall:

- Store raw data separately from processed data
- Preserve original values for traceability

---

## 4. Data Normalization & Processing

### 4.1 Normalization

The system shall:

- Normalize timestamps to a consistent timezone (UTC)
- Standardize units across all signals
- Align data into consistent time windows

### 4.2 Noise Reduction

The system shall apply:

- Rolling averages or smoothing functions
- Optional filtering strategies for signal stabilization

### 4.3 Data Quality Assessment

The system shall:

- Assign confidence scores to data segments
- Detect and flag:
  - Missing data windows
  - Sensor dropouts
  - Unreliable readings

---

## 5. Event Detection & Classification

### 5.1 Event Detection

The system shall detect:

- Sudden spikes or drops in signals
- Sustained deviations from baseline
- Data gaps or anomalies in signal continuity

### 5.2 Event Classification

Events shall be categorized by:

- Type (e.g., anomaly, dropout, trend deviation)
- Severity (low, medium, high)
- Confidence level

### 5.3 Baseline Comparison

The system shall:

- Establish per-user baselines
- Compare current values against baseline trends
- Detect deviations relative to individual norms (not global thresholds)

---

## 6. Readiness Scoring

### 6.1 Score Calculation

The system shall compute a readiness score based on weighted inputs, including:

- Sleep quality/duration
- HRV trends
- Resting heart rate deviations
- Activity vs fatigue indicators

### 6.2 Transparency

The system shall:

- Expose contributing factors to the score
- Allow users to understand how the score was derived

### 6.3 Dynamic Updates

The system shall update readiness scores as new data is ingested.

---

## 7. AI-Assisted Insights (Secondary Layer)

### 7.1 Summary Generation

The system shall:

- Generate natural language summaries of recent data windows
- Include references to detected events and trends

### 7.2 Insight Suggestions

The system shall:

- Highlight potential concerns or areas for review
- Suggest patterns observed across time-series data

### 7.3 Constraints

The system shall:

- Require human validation of AI outputs
- Provide traceability from summary to underlying data
- Avoid autonomous decision-making

---

## 8. Visualization & User Interface

### 8.1 Multi-Crew Dashboard

The system shall:

- Display a list of crew members
- Show readiness status and risk indicators
- Highlight individuals requiring attention

### 8.2 Individual Crew View

The system shall:

- Provide detailed time-series charts
- Overlay detected events and anomalies
- Display readiness score and contributing factors

### 8.3 Navigation

The system shall:

- Allow switching between multi-crew and individual views
- Maintain context when navigating between views

### 8.4 Data Transparency

The system shall:

- Allow users to inspect raw vs normalized data
- Display confidence levels and data quality indicators

---

## 9. Data Trust & Quality Evaluation

The system shall:

- Surface data reliability indicators
- Highlight when data should not be trusted for decision-making
- Differentiate between physiological anomalies and sensor issues

---

## 10. Admin & Observability

### 10.1 Ingestion Monitoring

The system shall:

- Display ingestion status and throughput
- Highlight failed or delayed data inputs

### 10.2 Error Tracking

The system shall:

- Log processing failures
- Provide visibility into normalization or detection issues

### 10.3 System Health

The system shall:

- Expose basic performance and processing metrics
- Indicate system degradation or bottlenecks

---

## 11. User Interaction & Control

The system shall:

- Allow users to filter data by time range and signal type
- Enable review and acknowledgment of flagged events
- Allow validation or dismissal of AI-generated summaries

---

## 12. Extensibility

The system shall be designed to support:

- Additional signal types
- New anomaly detection rules
- Integration of more advanced analytics or models
- Expansion to additional mission-support workflows

---

## 13. Non-Functional Behavioral Expectations

- The system shall prioritize clarity and explainability over complexity
- The system shall support rapid iteration and modification of rules
- The system shall maintain traceability from input to output
- The system shall operate reliably under imperfect data conditions
