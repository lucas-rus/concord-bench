/**
 * available = on shift, free · busy = on a job · on_call = "de gardă":
 * reachable on WhatsApp but no location · offline = off shift
 */
export type EmployeeStatus = "available" | "busy" | "on_call" | "offline"
export type LocationSource = "whatsapp_pin" | "live_beacon" | "manual"
export type TaskPriority = "normal" | "urgent" | "emergency"
export type TaskStatus =
  | "unassigned"
  | "pending_acceptance"
  | "in_progress"
  | "completed"
  | "cancelled"

/** Trade / intervention area. Labels and metadata live in lib/skills.ts. */
export type SkillArea = "electric" | "sanitare" | "termice" | "climatizare" | "frigorific"
export type SkillLevel = "incepator" | "avansat"

export interface Skill {
  area: SkillArea
  level: SkillLevel
}

/** minor = e.g. a socket to replace · major = e.g. a failed switchboard */
export type TaskSeverity = "minor" | "major"

export interface TrackPoint {
  lat: number
  lng: number
  accuracyM: number | null
  source: LocationSource
  recordedAt: string
}

export interface ActiveTaskSummary {
  id: string
  reference: string
  title: string
  status: TaskStatus
  priority: TaskPriority
}

export interface ShiftSchedule {
  start: string
  end: string
  /** ISO weekdays, 1 = Monday … 7 = Sunday */
  days: number[]
}

export interface Employee {
  id: string
  fullName: string
  phone: string
  role: string
  status: EmployeeStatus
  lat: number | null
  lng: number | null
  accuracyM: number | null
  locationSource: LocationSource | null
  locationUpdatedAt: string | null
  whatsappWindowExpiresAt: string | null
  activeTask: ActiveTaskSummary | null
  track: TrackPoint[]
  shift: ShiftSchedule | null
  skills: Skill[]
}

export interface PvCustomField {
  label: string
  defaultValue: string
}

export interface PvCustomValue {
  label: string
  value: string
}

/**
 * Per-client Proces Verbal (PV) template, automatically pre-filled whenever
 * a task belonging to this Client is closed or drafted.
 */
export interface ClientPvTemplate {
  headerNote: string
  defaultWorkDone: string
  defaultMaterials: string
  defaultObservations: string
  representativeRole: string
  customFields: PvCustomField[]
}

export interface Client {
  id: string
  name: string
  cui: string | null
  contactName: string | null
  phone: string | null
  email: string | null
  addressText: string
  sector: string | null
  lat: number | null
  lng: number | null
  contractNumber: string | null
  notes: string | null
  pvTemplate: ClientPvTemplate
  createdAt: string
}

export interface ChatMessage {
  at: string
  direction: "in" | "out"
  kind: "text" | "button" | "location" | "job_card"
  text: string
}

export interface WorkReport {
  number: string
  createdAt: string
  technician: string
  workDone: string
  materials: string
  observations: string
  contractNumber?: string
  representativeRole?: string
  customValues?: PvCustomValue[]
}

export interface Task {
  id: string
  reference: string
  title: string
  notes: string | null
  clientId?: string | null
  clientName: string
  clientPhone: string | null
  addressText: string
  sector: string | null
  lat: number
  lng: number
  priority: TaskPriority
  status: TaskStatus
  assignedEmployeeId: string | null
  assignedEmployeeName: string | null
  assignedEmployeeRole: string | null
  createdAt: string
  assignedAt: string | null
  acceptedAt: string | null
  arrivedAt: string | null
  completedAt: string | null
  skillArea: SkillArea | null
  severity: TaskSeverity
  conversation: ChatMessage[]
  report: WorkReport | null
}

/** Multi-person job lasting hours to weeks, with a site on the map. */
export interface Project {
  id: string
  reference: string
  name: string
  clientId?: string | null
  clientName: string
  addressText: string
  lat: number
  lng: number
  startsAt: string
  endsAt: string
  employeeIds: string[]
  notes: string | null
}

export interface OpsCapabilities {
  skills: boolean
  onCall: boolean
  projects: boolean
  workReports: boolean
  clients: boolean
}

export interface OpsMeta {
  generatedAt: string
  mode: "live" | "simulation"
  whatsappConfigured: boolean
  routesProvider: "google_routes" | "estimated"
  geocoder: "google" | "photon" | "local"
  authEnabled: boolean
  pollMs: number
  appUrl: string | null
  dispatchWhatsapp: string | null
  capabilities: OpsCapabilities
}

export interface OpsState {
  employees: Employee[]
  tasks: Task[]
  projects: Project[]
  clients: Client[]
  meta: OpsMeta
}
