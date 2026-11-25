import type { Client, ClientPvTemplate, Project, Task } from "@/lib/types"

export const DEFAULT_PV_TEMPLATE: ClientPvTemplate = {
  headerNote: "",
  defaultWorkDone: "",
  defaultMaterials: "",
  defaultObservations: "",
  representativeRole: "",
  customFields: [],
}

export function normalizeClientKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase()
}

/**
 * Baseline scaffold resolver (exact clientId only); normalized Romanian company
 * name matching is implemented in clients-pv-reports.
 */
export function resolveClient(
  clients: Client[],
  ref: { clientId?: string | null; clientName?: string | null } | null | undefined,
): Client | null {
  if (!ref?.clientId) return null
  return clients.find((client) => client.id === ref.clientId) ?? null
}

export function tasksForClient(
  client: Client,
  tasks: Task[],
  _allClients: Client[],
): Task[] {
  return tasks.filter((task) => task.clientId === client.id)
}

export function projectsForClient(
  client: Client,
  projects: Project[],
  _allClients: Client[],
): Project[] {
  return projects.filter((project) => project.clientId === client.id)
}

export function hasCustomPvTemplate(_template: ClientPvTemplate): boolean {
  return false
}
