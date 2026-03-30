# Demo Scenario Walkthroughs

This document defines the four scripted demo scenarios for the Crew Readiness Platform and the specific system behavior each one is meant to demonstrate.

Use these walkthroughs as the operator script during demos and as the qualitative validation checklist after simulation or scoring changes.

---

## 1. Acute Stress Event

### Goal

Demonstrate a sudden, physiologically credible strain event that pushes one crew member into a higher-risk state.

### How To Trigger

1. Open the home dashboard.
2. Open `Mission feed control`.
3. Select `Acute stress`.
4. Start `Live feed` or run a few single cycles.

### Expected Home-Page Behavior

- One crew member should rise toward the top of the `Crew board`.
- Their readiness should move into `Watch` or `Critical`.
- The `AI summary` column should describe acute strain or elevated cardiovascular pressure rather than a generic score recap.
- `Event watch` may surface cardiovascular or readiness-relevant activity if detection thresholds are crossed.

### Expected Crew-Page Behavior

- `Live feed` should show:
  - higher heart rate
  - lower HRV
  - elevated activity
  - slight temperature increase
- `Readiness profile` should contract most clearly in `Cardiovascular` and possibly `Thermal stability`.
- `What is driving this score` should explain acute physiological strain, not data loss.

### Demo Narrative

\"This scenario shows a short-lived operational strain event. The key signal is cardiovascular: heart rate rises, HRV drops, and readiness falls quickly enough to surface this crew member for review.\"

---

## 2. Fatigue Trend

### Goal

Demonstrate gradual deterioration rather than a sudden spike.

### How To Trigger

1. Open the home dashboard.
2. Open `Mission feed control`.
3. Select `Fatigue trend`.
4. Start `Live feed` and let it run for a few cycles.

### Expected Home-Page Behavior

- One crew member should gradually drift upward in risk ranking.
- Readiness should degrade more slowly than `Acute stress`.
- Confidence should generally remain actionable unless another data-quality issue is also present.
- The `AI summary` should frame the issue as accumulating fatigue or weak recovery.

### Expected Crew-Page Behavior

- `Live feed` should show:
  - lower sleep duration
  - lower sleep quality
  - lower activity balance
  - suppressed HRV
  - higher resting heart rate
- `Readiness profile` should compress most in `Recovery` and `Cardiovascular`.
- `What is driving this score` should describe cumulative fatigue, not a sudden incident.

### Demo Narrative

\"This scenario is about trend detection. Nothing collapses instantly, but recovery markers slide over time and the score responds before the crew member would look obviously impaired from a single point-in-time value.\"

---

## 3. Sensor Failure

### Goal

Demonstrate that the platform can distinguish telemetry trust problems from true physiological deterioration.

### How To Trigger

1. Open the home dashboard.
2. Open `Mission feed control`.
3. Select `Sensor dropout`.
4. Start `Live feed`.

### Expected Home-Page Behavior

- One crew member should show a drop in confidence or remain in a provisional readiness state.
- The `AI summary` should call out sensor reliability or degraded telemetry trust.
- `Event watch` should show `Sensor Reliability Issue` entries.

### Expected Crew-Page Behavior

- `Live feed` should show one or more of:
  - missing points
  - flatlines
  - low-confidence values
- `Readiness profile` should contract most in `Data quality`.
- `What is driving this score` should explicitly caution that the problem is data trust, not only physiology.

### Demo Narrative

\"This is the guardrail scenario. The system should not overstate physiological conclusions when the telemetry itself is failing. Confidence drops, reliability issues surface, and the summary should tell the operator to verify sensors before acting.\"

---

## 4. Recovery Period

### Goal

Demonstrate that the system recognizes improving conditions and not just decline.

### How To Trigger

1. Open the home dashboard.
2. Open `Mission feed control`.
3. Select `Recovery`.
4. Start `Live feed` or run a few cycles.

### Expected Home-Page Behavior

- The targeted crew member should stabilize or improve relative to recent conditions.
- Readiness should move upward or hold in a healthier band.
- The `AI summary` should describe improving recovery markers or rebound conditions.

### Expected Crew-Page Behavior

- `Live feed` should show:
  - lower heart rate
  - higher HRV
  - improved sleep metrics
  - steadier activity balance
- `Readiness profile` should expand outward in `Cardiovascular` and `Recovery`.
- `What is driving this score` should communicate improvement, not just the current score.

### Demo Narrative

\"This scenario shows that the platform is not only tuned for failure. It can also recognize rebound conditions and make visible that readiness is improving because cardiovascular and recovery signals are returning toward baseline.\"

---

## Operator Notes

- For the clearest demos, use the home dashboard first to identify the targeted crew member, then open that crew page.
- `Start live feed` is better for storytelling than isolated single-cycle runs because the scenario progression is easier to see.
- `Readiness profile` is the fastest holistic explanation tab.
- `Live feed` is the best evidence tab when someone asks what specifically changed.
- `AI summary` should reinforce the structured evidence, not contradict it.
