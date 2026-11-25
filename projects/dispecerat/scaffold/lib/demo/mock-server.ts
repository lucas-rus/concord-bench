import { activeProjectFor } from "@/lib/matching"
import { resolveClient } from "@/lib/clients"
import type {
  Client,
  Employee,
  OpsState,
  Project,
  Task,
  TaskPriority,
} from "@/lib/types"
import { buildFixture, conversationFor } from "./fixture"

export { activeProjectFor, conversationFor, resolveClient }

export class DemoBackend {
  employees: Employee[] = []
  tasks: Task[] = []
  projects: Project[] = []
  clients: Client[] = []
  now: number = Date.now()
  protected nextRef = 2414
  protected nextProject = 106

  constructor(now: number = Date.now()) {
    this.reset(now)
  }

  reset(now: number = Date.now()): void {
    this.now = now
    const fixture = buildFixture(now)
    this.employees = fixture.employees
    this.tasks = fixture.tasks
    this.projects = fixture.projects
    this.clients = fixture.clients
    this.nextRef = 2414
    this.nextProject = 106
    this.sync(now)
  }

  /**
   * Synchronize employee activeTask and busy/available status from open tasks
   * and active projects. Implemented by dispatch-lifecycle.
   */
  protected sync(_now: number = this.now): void {
    // Baseline no-op stub in scaffold.
  }

  private priorityRank(priority: TaskPriority): number {
    return priority === "emergency" ? 0 : priority === "urgent" ? 1 : 2
  }

  state(now: number = this.now): OpsState {
    this.sync(now)
    const tasks = [...this.tasks].sort((a, b) => {
      const p = this.priorityRank(a.priority) - this.priorityRank(b.priority)
      if (p !== 0) return p
      return Date.parse(b.createdAt) - Date.parse(a.createdAt)
    })
    return structuredClone({
      employees: this.employees,
      tasks,
      projects: this.projects,
      clients: this.clients,
      meta: {
        generatedAt: new Date(now).toISOString(),
        mode: "live",
        whatsappConfigured: true,
        routesProvider: "estimated",
        geocoder: "local",
        authEnabled: false,
        pollMs: 2000,
        appUrl: null,
        dispatchWhatsapp: null,
        capabilities: {
          skills: true,
          onCall: true,
          projects: true,
          workReports: true,
          clients: true,
        },
      },
    }) as OpsState
  }

  task(id: string): Task | null {
    return this.tasks.find((task) => task.id === id) ?? null
  }

  employee(id: string): Employee | null {
    return this.employees.find((employee) => employee.id === id) ?? null
  }

  client(id: string): Client | null {
    return this.clients.find((client) => client.id === id) ?? null
  }

  project(id: string): Project | null {
    return this.projects.find((project) => project.id === id) ?? null
  }
}
