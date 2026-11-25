import type { Skill, SkillArea, SkillLevel, TaskSeverity } from "@/lib/types"

/**
 * Placeholder trade metadata — to be completed by the skills & matching module.
 */
export const SKILL_AREAS: { id: SkillArea; label: string; short: string }[] = []

export const SKILL_LEVELS: { id: SkillLevel; label: string }[] = []

export const SEVERITIES: { id: TaskSeverity; label: string; hint: string }[] = []

export function skillAreaLabel(
  area: SkillArea | null,
  _variant: "label" | "short" = "label",
): string {
  return area ?? "Orice meserie"
}

export function levelLabel(level: SkillLevel): string {
  return level
}

export function skillLabel(skill: Skill): string {
  return `${skill.area}:${skill.level}`
}

export function levelIn(_skills: Skill[], _area: SkillArea): SkillLevel | null {
  return null
}
