import type { Employee, Project, SkillLevel, Task } from "@/lib/types"

export interface Eligibility {
  ranked: Employee[]
  onCall: Employee[]
  unqualifiedCount: number
}

export function activeProjectFor(
  _employeeId: string,
  _projects: Project[],
  _now = Date.now(),
): Project | null {
  return null
}

export function skillFit(
  _task: Pick<Task, "skillArea" | "severity">,
  _employee: Pick<Employee, "skills">,
): { qualified: boolean; skillLevel: SkillLevel | null; needsSupport: boolean } {
  return { qualified: true, skillLevel: null, needsSupport: false }
}

/**
 * Baseline scaffold filter (location-only); trade qualification, active-project
 * exclusion, on-call separation, and needsSupport are implemented in skills-matching.
 */
export function eligibleFor(
  _task: Pick<Task, "skillArea" | "severity">,
  employees: Employee[],
  _projects: Project[],
  _now = Date.now(),
): Eligibility {
  return {
    ranked: employees.filter(
      (e) => e.status === "available" && e.lat !== null && e.lng !== null,
    ),
    onCall: [],
    unqualifiedCount: 0,
  }
}
