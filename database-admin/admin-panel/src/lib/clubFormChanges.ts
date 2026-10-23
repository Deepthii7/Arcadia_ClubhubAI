import type { Club, ClubInput } from "@/types";

export function getChangedClubFields(
  form: ClubInput,
  initial: Club | undefined,
  categoryTouched: boolean
): Partial<ClubInput> {
  const changedFields: Partial<ClubInput> = {};
  if (!initial) return changedFields;

  for (const key of Object.keys(form) as (keyof ClubInput)[]) {
    if (key === "category" && !categoryTouched) continue;
    if (JSON.stringify(form[key]) !== JSON.stringify(initial[key])) {
      Object.assign(changedFields, { [key]: form[key] });
    }
  }

  return changedFields;
}
