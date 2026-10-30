export const MIN_CREW_SIZE = 3;
export const MAX_CREW_SIZE = 8;

export function canAddCrewParticipant(count: number): boolean {
  return Number.isInteger(count) && count < MAX_CREW_SIZE;
}

export function canRemoveCrewParticipant(count: number): boolean {
  return Number.isInteger(count) && count > MIN_CREW_SIZE;
}

export function validateCrewParticipants(value: unknown): string | null {
  if (!Array.isArray(value) || value.length < MIN_CREW_SIZE || value.length > MAX_CREW_SIZE) {
    return `Crew sessions need ${MIN_CREW_SIZE} to ${MAX_CREW_SIZE} participants.`;
  }
  if (value.some((person) => !person || typeof person.name !== "string" || !person.name.trim() || person.name.length > 80)) {
    return "Every participant needs a name of 1 to 80 characters.";
  }
  return null;
}
