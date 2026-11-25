/**
 * Deterministic Bucharest seed data for CON-INSTAL ENGINEERING:
 * electrical, sanitary/gas, heating, HVAC & BMS field operations.
 *
 * Every timestamp is relative to `now` so unit and integration tests can run
 * deterministically at any fixed epoch timestamp.
 */
import type {
  ChatMessage,
  Client,
  ClientPvTemplate,
  Employee,
  Project,
  ShiftSchedule,
  Skill,
  SkillArea,
  Task,
  TaskPriority,
  TaskSeverity,
  TaskStatus,
  WorkReport,
} from "@/lib/types"

const WEEKDAYS: ShiftSchedule = { start: "08:00", end: "17:00", days: [1, 2, 3, 4, 5] }
const LATE: ShiftSchedule = { start: "12:00", end: "21:00", days: [1, 2, 3, 4, 5, 6] }

const ago = (now: number, minutes: number) => new Date(now - minutes * 60_000).toISOString()
const inMinutes = (now: number, minutes: number) => new Date(now + minutes * 60_000).toISOString()

const adv = (area: SkillArea): Skill => ({ area, level: "avansat" })
const beg = (area: SkillArea): Skill => ({ area, level: "incepator" })

interface EmployeeSeed {
  n: number
  name: string
  phone: string
  role: string
  status: Employee["status"]
  lat: number | null
  lng: number | null
  minutesAgo: number
  accuracy: number
  shift: ShiftSchedule
  skills: Skill[]
}

const EMPLOYEES: EmployeeSeed[] = [
  { n: 1, name: "Ana Georgescu", phone: "40727123456", role: "Inginer centrale termice (ISCIR)", status: "available", lat: 44.43422, lng: 26.06471, minutesAgo: 1, accuracy: 9, shift: WEEKDAYS, skills: [adv("termice"), beg("sanitare")] },
  { n: 2, name: "Andrei Popescu", phone: "40722123456", role: "Tehnician HVAC & BMS", status: "available", lat: 44.44731, lng: 26.09702, minutesAgo: 6, accuracy: 14, shift: WEEKDAYS, skills: [adv("climatizare"), beg("frigorific")] },
  { n: 3, name: "Cristina Pavel", phone: "40729123456", role: "Electrician autorizat ANRE", status: "available", lat: 44.45941, lng: 26.10381, minutesAgo: 11, accuracy: 18, shift: WEEKDAYS, skills: [adv("electric")] },
  { n: 4, name: "Ioana Stan", phone: "40725123456", role: "Instalator sanitare & hidranți", status: "available", lat: 44.45242, lng: 26.08591, minutesAgo: 95, accuracy: 20, shift: WEEKDAYS, skills: [adv("sanitare"), beg("termice")] },
  { n: 5, name: "Mihai Dumitrescu", phone: "40724123456", role: "Tehnician centrale termice", status: "available", lat: 44.42641, lng: 26.10324, minutesAgo: 3, accuracy: 7, shift: WEEKDAYS, skills: [adv("termice")] },
  { n: 6, name: "Simona Radu", phone: "40731123456", role: "Specialist AGFR & climatizare", status: "available", lat: 44.44102, lng: 26.15198, minutesAgo: 4, accuracy: 12, shift: LATE, skills: [adv("frigorific"), adv("climatizare")] },
  { n: 7, name: "Bogdan Enache", phone: "40730123456", role: "Electrician autorizat ANRE", status: "busy", lat: 44.41801, lng: 26.03102, minutesAgo: 9, accuracy: 15, shift: LATE, skills: [adv("electric")] },
  { n: 8, name: "Elena Ionescu", phone: "40723123456", role: "Tehnician HVAC", status: "busy", lat: 44.45168, lng: 26.08341, minutesAgo: 31, accuracy: 11, shift: WEEKDAYS, skills: [adv("climatizare")] },
  { n: 9, name: "Vlad Marin", phone: "40726123456", role: "Instalator rețele sanitare", status: "busy", lat: 44.43071, lng: 26.10102, minutesAgo: 18, accuracy: 13, shift: LATE, skills: [adv("sanitare")] },
  { n: 10, name: "Radu Matei", phone: "40728123456", role: "Tehnician centrale termice", status: "offline", lat: 44.49361, lng: 26.08463, minutesAgo: 290, accuracy: 25, shift: WEEKDAYS, skills: [adv("termice"), beg("electric")] },
  { n: 11, name: "Dan Ciobanu", phone: "40732123456", role: "Electrician (în formare)", status: "available", lat: 44.44412, lng: 26.11843, minutesAgo: 8, accuracy: 16, shift: WEEKDAYS, skills: [beg("electric")] },
  { n: 12, name: "Lavinia Petrescu", phone: "40733123456", role: "Inginer automatizări & ANRE", status: "on_call", lat: null, lng: null, minutesAgo: 0, accuracy: 0, shift: LATE, skills: [adv("electric"), adv("termice")] },
  { n: 13, name: "Cosmin Dobre", phone: "40734123456", role: "Electrician tablouri & PRAM", status: "available", lat: 44.45698, lng: 26.10561, minutesAgo: 22, accuracy: 10, shift: WEEKDAYS, skills: [adv("electric")] },
  { n: 14, name: "Gabriel Stoica", phone: "40735123456", role: "Electrician execuție", status: "available", lat: 44.45718, lng: 26.10601, minutesAgo: 22, accuracy: 10, shift: WEEKDAYS, skills: [beg("electric")] },
]

export const employeeId = (n: number) =>
  `e0000000-0000-4000-8000-${String(n).padStart(12, "0")}`
export const taskId = (n: number) =>
  `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`
export const projectId = (n: number) =>
  `f0000000-0000-4000-8000-${String(n).padStart(12, "0")}`
export const clientId = (n: number) =>
  `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`

interface ClientSeed {
  n: number
  name: string
  cui: string
  contactName: string
  phone: string
  email: string
  addressText: string
  sector: string
  lat: number
  lng: number
  contractNumber: string
  notes: string | null
  pvTemplate: ClientPvTemplate
}

const CLIENTS: ClientSeed[] = [
  {
    n: 1,
    name: "Spitalul Clinic Filantropia",
    cui: "RO4505332",
    contactName: "Ing. Marian Voicu",
    phone: "+40 21 318 8930",
    email: "tehnic@spitalulfilantropia.ro",
    addressText: "Bd. Ion Mihalache 11-13, Sector 1",
    sector: "Sector 1",
    lat: 44.45203,
    lng: 26.08302,
    contractNumber: "CTR-2026-008",
    notes: "Unitate medicală cu regim permanent. Acces pe la poarta tehnică.",
    pvTemplate: {
      headerNote: "Contract mentenanță unitate sanitară CTR-2026-008 · SLA urgențe 90 min · Verificare conform ISO 9001 & ANRE/AGFR.",
      defaultWorkDone: "Verificare funcțională parametri instalație și testare regim nominal.",
      defaultMaterials: "Consumabile mărunte conform deviz abonament.",
      defaultObservations: "Instalația a fost predată în parametri siguri pentru exploatare spitalicească.",
      representativeRole: "Șef Serviciu Tehnic / Administrativ Spital (nume, semnătură, ștampilă)",
      customFields: [
        { label: "Corp clădire / Secție", defaultValue: "Pavilion Central" },
        { label: "Serie echipament", defaultValue: "" },
      ],
    },
  },
  {
    n: 2,
    name: "Biblioteca Națională a României",
    cui: "RO4192510",
    contactName: "Ing. Cristina Dinu",
    phone: "+40 21 318 8600",
    email: "administrativ@bibnat.ro",
    addressText: "Bd. Unirii 22, Sector 3",
    sector: "Sector 3",
    lat: 44.42672,
    lng: 26.10798,
    contractNumber: "CTR-2026-019",
    notes: "Monitorizare BMS, centrale termice și instalații sanitare.",
    pvTemplate: {
      headerNote: "Acord cadru mentenanță clădire publică CTR-2026-019 · Verificare ISCIR / BMS.",
      defaultWorkDone: "Inspecție tehnică, verificare senzori BMS și etanșeitate circuit.",
      defaultMaterials: "",
      defaultObservations: "Parametri înregistrați în jurnalul tehnic al clădirii.",
      representativeRole: "Responsabil tehnic clădire BNR (nume, semnătură)",
      customFields: [
        { label: "Zonă / Nivel clădire", defaultValue: "Corp tehnic parter" },
        { label: "Parametri BMS verificați", defaultValue: "Presiune / Temperatură nominală" },
      ],
    },
  },
  {
    n: 3,
    name: "Primăria Sectorului 1",
    cui: "RO4505359",
    contactName: "Dragoș Ionescu",
    phone: "+40 21 319 1013",
    email: "investitii@primariasector1.ro",
    addressText: "Calea Victoriei 155, Sector 1",
    sector: "Sector 1",
    lat: 44.4497,
    lng: 26.0866,
    contractNumber: "AC-2026-004",
    notes: "Clădiri administrative și centre socio-culturale arondate.",
    pvTemplate: {
      headerNote: "Acord-cadru intervenții și reparații instalații electrice & termice AC-2026-004.",
      defaultWorkDone: "Constatare deficiență, remediere și măsurători PRAM / continuitate.",
      defaultMaterials: "",
      defaultObservations: "Garanție lucrare 12 luni de la recepție.",
      representativeRole: "Reprezentant Direcția Administrativă (nume, semnătură)",
      customFields: [
        { label: "Nr. notă de comandă", defaultValue: "NC-" },
        { label: "Obiectiv arondat", defaultValue: "Sediu Calea Victoriei" },
      ],
    },
  },
  {
    n: 4,
    name: "Clinica Medicală Dorobanți",
    cui: "RO28491022",
    contactName: "Dr. Alina Munteanu",
    phone: "+40 723 440 110",
    email: "office@clinicadorobanti.ro",
    addressText: "Calea Dorobanți 102, Sector 1",
    sector: "Sector 1",
    lat: 44.45921,
    lng: 26.09361,
    contractNumber: "CTR-2026-027",
    notes: "Camere server, imagistică și climatizare de precizie.",
    pvTemplate: {
      headerNote: "Contract service climatizare & AGFR CTR-2026-027 · SLA camere critice 60 min.",
      defaultWorkDone: "Verificare presiune agent frigorific, curățare condensator, testare termostat.",
      defaultMaterials: "",
      defaultObservations: "Temperatură stabilizată în plaja 19–21 °C.",
      representativeRole: "Manager clinică (nume, semnătură)",
      customFields: [
        { label: "Temperatură la predare (°C)", defaultValue: "20 °C" },
      ],
    },
  },
  {
    n: 5,
    name: "Spitalul Clinic Prof. Dr. Al. Obregia",
    cui: "RO4283570",
    contactName: "Ing. Șerban Mateescu",
    phone: "+40 21 334 4266",
    email: "tehnic@spital-obregia.ro",
    addressText: "Bd. Iuliu Maniu 120, Sector 6",
    sector: "Sector 6",
    lat: 44.43398,
    lng: 26.02601,
    contractNumber: "CTR-2026-011",
    notes: "Tablouri electrice generale, grupuri electrogene și centrale termice de pavilion.",
    pvTemplate: {
      headerNote: "Contract mentenanță instalații electrice ANRE & termice ISCIR · CTR-2026-011.",
      defaultWorkDone: "Verificare bare distribuție, strângere contacte la cuplu, termografie tablou.",
      defaultMaterials: "",
      defaultObservations: "Sarcina echilibrată pe faze; protecțiile diferențiale declanșează în parametri.",
      representativeRole: "Inginer șef serviciu tehnic (nume, semnătură, ștampilă)",
      customFields: [
        { label: "Pavilion / Tablou electric", defaultValue: "TE-General" },
        { label: "Buletin verificare PRAM", defaultValue: "Conform" },
      ],
    },
  },
  {
    n: 6,
    name: "Palatul Național al Copiilor",
    cui: "RO4266909",
    contactName: "Mircea Stănescu",
    phone: "+40 21 330 0802",
    email: "administratie@palatulcopiilor.ro",
    addressText: "Bd. Tineretului 30, Sector 4",
    sector: "Sector 4",
    lat: 44.4141,
    lng: 26.1041,
    contractNumber: "CTR-2026-023",
    notes: "Modernizare punct termic și instalații stingere incendii IGSU.",
    pvTemplate: {
      headerNote: "Contract execuție & mentenanță termică ISCIR CTR-2026-023.",
      defaultWorkDone: "Verificare arzătoare, supape siguranță, automatizare cascadă cazane.",
      defaultMaterials: "",
      defaultObservations: "Funcționare în regim automat verificată.",
      representativeRole: "Administrator patrimoniu (nume, semnătură)",
      customFields: [
        { label: "Putere termică verificată", defaultValue: "380 kW" },
      ],
    },
  },
  {
    n: 7,
    name: "Mega Center Titan",
    cui: "RO19482104",
    contactName: "Sorin Dumitru",
    phone: "+40 744 210 900",
    email: "facility@megacentertitan.ro",
    addressText: "Bd. Liviu Rebreanu 6, Sector 3",
    sector: "Sector 3",
    lat: 44.4232,
    lng: 26.1622,
    contractNumber: "CTR-2026-031",
    notes: "14 unități HVAC rooftop și instalații sprinklere.",
    pvTemplate: {
      headerNote: "Contract Facility Management HVAC & IGSU CTR-2026-031.",
      defaultWorkDone: "Inspecție unități rooftop, curele ventilatoare, curățare baterii și tăvi condens.",
      defaultMaterials: "Set filtre G4/F7 conform grafic.",
      defaultObservations: "Toate unitățile sunt active în BMS.",
      representativeRole: "Facility Manager centru comercial",
      customFields: [
        { label: "Unități rooftop verificate", defaultValue: "RTU 01–14" },
      ],
    },
  },
  {
    n: 8,
    name: "Asociația de proprietari Floreasca C2",
    cui: "RO14002819",
    contactName: "Gheorghe Marin (Admin.)",
    phone: "+40 722 890 311",
    email: "admin.floreascac2@gmail.com",
    addressText: "Str. Glinka 8, Sector 2",
    sector: "Sector 2",
    lat: 44.45708,
    lng: 26.10581,
    contractNumber: "CTR-2026-042",
    notes: "Proiect înlocuire coloane electrice și centrale de scară.",
    pvTemplate: {
      headerNote: "Contract execuție reabilitare instalații electrice ANRE 0,4 kV · CTR-2026-042.",
      defaultWorkDone: "Pozare coloană alimentare, conexiuni în firida de palier, verificare izolație.",
      defaultMaterials: "",
      defaultObservations: "Tensiune restabilită pe scară după verificare.",
      representativeRole: "Președinte / Administrator asociație (nume, semnătură, ștampilă)",
      customFields: [
        { label: "Scara / Tronson", defaultValue: "Scara A+B" },
      ],
    },
  },
]

interface TaskSeed {
  n: number
  reference: string
  title: string
  notes: string | null
  clientN?: number
  clientName: string
  clientPhone: string | null
  addressText: string
  sector: string
  lat: number
  lng: number
  priority: TaskPriority
  status: TaskStatus
  skillArea: SkillArea | null
  severity: TaskSeverity
  createdAgo: number
  assignedTo?: number
  assignedAgo?: number
  acceptedAgo?: number
  arrivedAgo?: number
  completedAgo?: number
  techNote?: string
  report?: Omit<WorkReport, "createdAt" | "technician">
}

const TASKS: TaskSeed[] = [
  { n: 1, reference: "SV-2408", title: "Montaj aer condiționat · 2 unități", notes: "Acces prin curtea tehnică.", clientN: 1, clientName: "Spitalul Clinic Filantropia", clientPhone: "+40 21 318 8930", addressText: "Bd. Ion Mihalache 11-13, Sector 1", sector: "Sector 1", lat: 44.45203, lng: 26.08302, priority: "normal", status: "in_progress", skillArea: "climatizare", severity: "minor", createdAgo: 96, assignedTo: 8, assignedAgo: 92, acceptedAgo: 91, arrivedAgo: 64 },
  { n: 2, reference: "SV-2407", title: "Înlocuire vană și sifon grup sanitar", notes: null, clientN: 2, clientName: "Biblioteca Națională a României", clientPhone: "+40 21 318 8600", addressText: "Bd. Unirii 22, Sector 3", sector: "Sector 3", lat: 44.43041, lng: 26.10133, priority: "normal", status: "in_progress", skillArea: "sanitare", severity: "minor", createdAgo: 58, assignedTo: 9, assignedAgo: 55, acceptedAgo: 54, arrivedAgo: 31 },
  { n: 3, reference: "SV-2411", title: "Verificare tablou electric după scurtcircuit", notes: "Serviciul tehnic a decuplat plecarea secundară.", clientN: 5, clientName: "Spitalul Clinic Prof. Dr. Al. Obregia", clientPhone: "+40 21 334 4266", addressText: "Bd. Iuliu Maniu 120, Sector 6", sector: "Sector 6", lat: 44.43398, lng: 26.02601, priority: "urgent", status: "pending_acceptance", skillArea: "electric", severity: "major", createdAgo: 9, assignedTo: 7, assignedAgo: 1 },
  { n: 4, reference: "SV-2412", title: "Aer condiționat oprit · cameră server", notes: "Temperatura în cameră a trecut de 30 °C.", clientN: 4, clientName: "Clinica Medicală Dorobanți", clientPhone: "+40 723 440 110", addressText: "Calea Dorobanți 102, Sector 1", sector: "Sector 1", lat: 44.45921, lng: 26.09361, priority: "urgent", status: "unassigned", skillArea: "climatizare", severity: "major", createdAgo: 7 },
  { n: 10, reference: "SV-2406", title: "Tablou electric defect · fără tensiune etaj 2", notes: "Miroase a izolație încinsă la TE-2.", clientN: 3, clientName: "Primăria Sectorului 1", clientPhone: "+40 21 319 1013", addressText: "Calea Victoriei 155, Sector 1", sector: "Sector 1", lat: 44.4497, lng: 26.0866, priority: "urgent", status: "unassigned", skillArea: "electric", severity: "major", createdAgo: 12 },
  { n: 5, reference: "SV-2410", title: "Pierdere presiune pe distribuitor termic", notes: null, clientN: 5, clientName: "Spitalul Clinic Prof. Dr. Al. Obregia", clientPhone: "+40 21 334 4266", addressText: "Bd. Timișoara 45, Sector 6", sector: "Sector 6", lat: 44.42649, lng: 26.04203, priority: "normal", status: "unassigned", skillArea: "termice", severity: "minor", createdAgo: 14 },
  { n: 6, reference: "SV-2409", title: "Revizie ISCIR anuală centrală termică", notes: "Contract de mentenanță. Programare între 10 și 14.", clientN: 2, clientName: "Biblioteca Națională a României", clientPhone: "+40 21 318 8600", addressText: "Bd. Unirii 24, Sector 3", sector: "Sector 3", lat: 44.42672, lng: 26.10798, priority: "normal", status: "unassigned", skillArea: "termice", severity: "minor", createdAgo: 21 },
  { n: 7, reference: "SV-2405", title: "Înlocuire prize și siguranță diferențială", notes: null, clientN: 8, clientName: "Asociația de proprietari Floreasca C2", clientPhone: "+40 722 890 311", addressText: "Șos. Mihai Bravu 128, Sector 2", sector: "Sector 2", lat: 44.43518, lng: 26.12371, priority: "normal", status: "unassigned", skillArea: "electric", severity: "minor", createdAgo: 40 },
  {
    n: 8, reference: "SV-2403", title: "Igienizare și verificare ventilo-convectoare", notes: null, clientN: 1, clientName: "Spitalul Clinic Filantropia", clientPhone: "+40 21 318 8930", addressText: "Str. Apolodor 7, Sector 5", sector: "Sector 5", lat: 44.43182, lng: 26.09104, priority: "normal", status: "completed", skillArea: "climatizare", severity: "minor", createdAgo: 190, assignedTo: 1, assignedAgo: 186, acceptedAgo: 185, arrivedAgo: 160, completedAgo: 32,
    techNote: "Am igienizat cele 3 unități interioare și am curățat filtrele. Funcționează normal.",
    report: { number: "PV-2403", workDone: "Igienizare 3 unități interioare, curățare filtre, verificare scurgere condens.", materials: "Soluție biocidă avizată MS (2 buc.)", observations: "Recomandat următoarea igienizare peste 6 luni." },
  },
  {
    n: 9, reference: "SV-2401", title: "Desfundare și inspecție video canalizare", notes: null, clientN: 3, clientName: "Primăria Sectorului 1", clientPhone: "+40 21 319 1013", addressText: "Calea Moșilor 88, Sector 2", sector: "Sector 2", lat: 44.44196, lng: 26.11497, priority: "urgent", status: "completed", skillArea: "sanitare", severity: "major", createdAgo: 240, assignedTo: 4, assignedAgo: 238, acceptedAgo: 237, arrivedAgo: 214, completedAgo: 81,
    techNote: "Coloana desfundată cu sonda, am spălăt cu presiune. Recomand separator de grăsimi.",
    report: { number: "PV-2401", workDone: "Desfundare coloană canalizare cu sondă electrică, spălare cu presiune și inspecție video.", materials: "—", observations: "Recomandat montaj separator de grăsimi." },
  },
]

interface ProjectSeed {
  n: number
  reference: string
  name: string
  clientN: number
  clientName: string
  addressText: string
  lat: number
  lng: number
  startsIn: number
  durationMinutes: number
  team: number[]
  notes: string | null
}

const DAY = 24 * 60

const PROJECTS: ProjectSeed[] = [
  { n: 1, reference: "PR-104", name: "Renovare instalație electrică · bloc C2", clientN: 8, clientName: "Asociația de proprietari Floreasca C2", addressText: "Str. Glinka 8, Sector 2", lat: 44.45708, lng: 26.10581, startsIn: -3 * DAY, durationMinutes: 12 * DAY, team: [13, 14], notes: "Coloane noi pe scările A și B. Lucru zilnic 08–17." },
  { n: 2, reference: "PR-105", name: "Mentenanță climatizare · centru comercial", clientN: 7, clientName: "Mega Center Titan", addressText: "Bd. Liviu Rebreanu 6, Sector 3", lat: 44.4232, lng: 26.1622, startsIn: 150, durationMinutes: 4 * 60, team: [2, 6], notes: "Verificare 14 unități rooftop și integrare alarme BMS." },
  { n: 3, reference: "PR-103", name: "Modernizare punct termic · cazane în cascadă", clientN: 6, clientName: "Palatul Național al Copiilor", addressText: "Bd. Tineretului 30, Sector 4", lat: 44.4141, lng: 26.1041, startsIn: 2 * DAY, durationMinutes: 5 * DAY, team: [1, 5, 4], notes: "Înlocuire distribuitoare, pompe Grundfos și automatizare ISCIR." },
]

function buildEmployee(seed: EmployeeSeed, now: number): Employee {
  const hasLocation = seed.lat !== null && seed.lng !== null
  return {
    id: employeeId(seed.n),
    fullName: seed.name,
    phone: seed.phone,
    role: seed.role,
    status: seed.status,
    lat: seed.lat,
    lng: seed.lng,
    accuracyM: hasLocation ? seed.accuracy : null,
    locationSource: hasLocation ? "whatsapp_pin" : null,
    locationUpdatedAt: hasLocation ? ago(now, seed.minutesAgo) : null,
    whatsappWindowExpiresAt: new Date(now + 18 * 3_600_000).toISOString(),
    activeTask: null,
    track: [],
    shift: seed.shift,
    skills: seed.skills,
  }
}

function buildClient(seed: ClientSeed, now: number): Client {
  return {
    id: clientId(seed.n),
    name: seed.name,
    cui: seed.cui,
    contactName: seed.contactName,
    phone: seed.phone,
    email: seed.email,
    addressText: seed.addressText,
    sector: seed.sector,
    lat: seed.lat,
    lng: seed.lng,
    contractNumber: seed.contractNumber,
    notes: seed.notes,
    pvTemplate: structuredClone(seed.pvTemplate),
    createdAt: ago(now, seed.n * 24 * 60),
  }
}

export function conversationFor(task: Task, techNote?: string | null): ChatMessage[] {
  const log: ChatMessage[] = []
  if (task.assignedAt) {
    log.push({ at: task.assignedAt, direction: "out", kind: "job_card", text: `Comandă ${task.reference}: ${task.title} · ${task.addressText}` })
  }
  if (task.acceptedAt) {
    log.push({ at: task.acceptedAt, direction: "in", kind: "button", text: "✅ Accept" })
    log.push({ at: task.acceptedAt, direction: "out", kind: "text", text: `Acceptat · ${task.reference}. Pornește spre ${task.addressText}.` })
  }
  if (task.arrivedAt) {
    log.push({ at: task.arrivedAt, direction: "in", kind: "location", text: "Locație trimisă la sosire" })
  }
  if (task.completedAt) {
    if (techNote) log.push({ at: task.completedAt, direction: "in", kind: "text", text: techNote })
    log.push({ at: task.completedAt, direction: "in", kind: "button", text: "✅ Finalizat" })
  }
  return log
}

function buildTask(seed: TaskSeed, now: number): Task {
  const worker = seed.assignedTo
    ? EMPLOYEES.find((employee) => employee.n === seed.assignedTo)
    : undefined
  const task: Task = {
    id: taskId(seed.n),
    reference: seed.reference,
    title: seed.title,
    notes: seed.notes,
    clientId: seed.clientN ? clientId(seed.clientN) : null,
    clientName: seed.clientName,
    clientPhone: seed.clientPhone,
    addressText: seed.addressText,
    sector: seed.sector,
    lat: seed.lat,
    lng: seed.lng,
    priority: seed.priority,
    status: seed.status,
    assignedEmployeeId: worker ? employeeId(worker.n) : null,
    assignedEmployeeName: worker?.name ?? null,
    assignedEmployeeRole: worker?.role ?? null,
    createdAt: ago(now, seed.createdAgo),
    assignedAt: seed.assignedAgo !== undefined ? ago(now, seed.assignedAgo) : null,
    acceptedAt: seed.acceptedAgo !== undefined ? ago(now, seed.acceptedAgo) : null,
    arrivedAt: seed.arrivedAgo !== undefined ? ago(now, seed.arrivedAgo) : null,
    completedAt: seed.completedAgo !== undefined ? ago(now, seed.completedAgo) : null,
    skillArea: seed.skillArea,
    severity: seed.severity,
    conversation: [],
    report: null,
  }
  task.conversation = conversationFor(task, seed.techNote)
  if (seed.report && task.completedAt) {
    task.report = { ...seed.report, createdAt: task.completedAt, technician: worker?.name ?? "" }
  }
  return task
}

function buildProject(seed: ProjectSeed, now: number): Project {
  return {
    id: projectId(seed.n),
    reference: seed.reference,
    name: seed.name,
    clientId: clientId(seed.clientN),
    clientName: seed.clientName,
    addressText: seed.addressText,
    lat: seed.lat,
    lng: seed.lng,
    startsAt: inMinutes(now, seed.startsIn),
    endsAt: inMinutes(now, seed.startsIn + seed.durationMinutes),
    employeeIds: seed.team.map(employeeId),
    notes: seed.notes,
  }
}

export function buildFixture(now: number): {
  employees: Employee[]
  tasks: Task[]
  projects: Project[]
  clients: Client[]
} {
  return {
    employees: EMPLOYEES.map((seed) => buildEmployee(seed, now)),
    tasks: TASKS.map((seed) => buildTask(seed, now)),
    projects: PROJECTS.map((seed) => buildProject(seed, now)),
    clients: CLIENTS.map((seed) => buildClient(seed, now)),
  }
}
