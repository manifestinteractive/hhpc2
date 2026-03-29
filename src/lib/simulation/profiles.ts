import type { SimulationCrewProfile } from "@/lib/simulation/types";

export const defaultSimulationCrewProfiles: SimulationCrewProfile[] = [
  {
    activityTarget: 0.68,
    baselineBodyTemperatureC: 36.7,
    callSign: "Northstar",
    crewCode: "CRW-001",
    displayName: "Dr. Maya Chen",
    heartRateVariabilityMs: 72,
    restingHeartRateBpm: 56,
    sleepTargetHours: 8,
    stressSensitivity: 0.92,
  },
  {
    activityTarget: 0.71,
    baselineBodyTemperatureC: 36.8,
    callSign: "Sable",
    crewCode: "CRW-002",
    displayName: "Commander Elena Alvarez",
    heartRateVariabilityMs: 66,
    restingHeartRateBpm: 58,
    sleepTargetHours: 7.5,
    stressSensitivity: 1,
  },
  {
    activityTarget: 0.74,
    baselineBodyTemperatureC: 36.75,
    callSign: "Harbor",
    crewCode: "CRW-003",
    displayName: "Amina Okafor",
    heartRateVariabilityMs: 64,
    restingHeartRateBpm: 60,
    sleepTargetHours: 7.8,
    stressSensitivity: 1.04,
  },
  {
    activityTarget: 0.65,
    baselineBodyTemperatureC: 36.65,
    callSign: "Vector",
    crewCode: "CRW-004",
    displayName: "Jordan Brooks",
    heartRateVariabilityMs: 69,
    restingHeartRateBpm: 62,
    sleepTargetHours: 7.2,
    stressSensitivity: 0.98,
  },
  {
    activityTarget: 0.61,
    baselineBodyTemperatureC: 36.6,
    callSign: "Circuit",
    crewCode: "CRW-005",
    displayName: "Priya Raman",
    heartRateVariabilityMs: 74,
    restingHeartRateBpm: 57,
    sleepTargetHours: 8.1,
    stressSensitivity: 0.88,
  },
  {
    activityTarget: 0.67,
    baselineBodyTemperatureC: 36.72,
    callSign: "Solstice",
    crewCode: "CRW-006",
    displayName: "Sofia Martinez",
    heartRateVariabilityMs: 78,
    restingHeartRateBpm: 55,
    sleepTargetHours: 8.3,
    stressSensitivity: 0.9,
  },
];

export function getDefaultSimulationCrewProfiles(count = 4) {
  return defaultSimulationCrewProfiles.slice(0, count);
}
