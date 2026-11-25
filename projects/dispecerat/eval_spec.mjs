import assert from "node:assert/strict"

const FIXED_NOW = Date.parse("2026-05-12T10:30:00.000Z") // Tue 13:30 Europe/Bucharest
const PEAK_AT = new Date("2026-05-12T05:30:00.000Z") // Tue 08:30 Europe/Bucharest
const NORMAL_AT = new Date("2026-05-12T10:30:00.000Z") // Tue 13:30 Europe/Bucharest
const WEEKEND_AT = new Date("2026-05-16T10:30:00.000Z") // Sat 13:30 Europe/Bucharest

const cases = []

function spec(section, name, fn) {
  cases.push({ section, id: `${section}::${name}`, fn })
}

// ============================================================================
// 1. skills-matching (7 tests)
// ============================================================================

spec("skills-matching", "skill_areas_and_labels", async () => {
  const s = await import("@/lib/skills")
  assert.equal(s.SKILL_AREAS.length, 5)
  assert.equal(s.skillAreaLabel(null), "Orice meserie")
  assert.equal(s.skillAreaLabel("electric", "label"), "Instalații electrice")
  assert.equal(s.skillAreaLabel("frigorific", "short"), "Frigorific")
})

spec("skills-matching", "level_and_skill_labels", async () => {
  const s = await import("@/lib/skills")
  assert.equal(s.levelLabel("avansat"), "avansat")
  assert.equal(s.levelLabel("incepator"), "începător")
  assert.equal(s.skillLabel({ area: "termice", level: "incepator" }), "Termice · începător")
})

spec("skills-matching", "level_in_precedence", async () => {
  const s = await import("@/lib/skills")
  assert.equal(
    s.levelIn(
      [
        { area: "electric", level: "incepator" },
        { area: "electric", level: "avansat" },
      ],
      "electric",
    ),
    "avansat",
  )
  assert.equal(s.levelIn([{ area: "sanitare", level: "incepator" }], "sanitare"), "incepator")
  assert.equal(s.levelIn([{ area: "sanitare", level: "avansat" }], "frigorific"), null)
})

spec("skills-matching", "active_project_for_window", async () => {
  const { activeProjectFor } = await import("@/lib/matching")
  const { buildFixture, employeeId } = await import("@/lib/demo/fixture")
  const fx = buildFixture(FIXED_NOW)
  // Employee 13 is on PR-104 (-3d .. +9d); Employee 2 is on PR-105 (+150m, future)
  assert.equal(activeProjectFor(employeeId(13), fx.projects, FIXED_NOW)?.reference, "PR-104")
  assert.equal(activeProjectFor(employeeId(2), fx.projects, FIXED_NOW), null)
})

spec("skills-matching", "skill_fit_support_flag", async () => {
  const { skillFit } = await import("@/lib/matching")
  const fitMajorBeg = skillFit(
    { skillArea: "electric", severity: "major" },
    { skills: [{ area: "electric", level: "incepator" }] },
  )
  assert.deepEqual(fitMajorBeg, {
    qualified: true,
    skillLevel: "incepator",
    needsSupport: true,
  })
  const fitMinorBeg = skillFit(
    { skillArea: "electric", severity: "minor" },
    { skills: [{ area: "electric", level: "incepator" }] },
  )
  assert.equal(fitMinorBeg.needsSupport, false)
  const fitAny = skillFit({ skillArea: null, severity: "major" }, { skills: [] })
  assert.deepEqual(fitAny, { qualified: true, skillLevel: null, needsSupport: false })
})

spec("skills-matching", "eligible_for_filters_and_counts", async () => {
  const { eligibleFor } = await import("@/lib/matching")
  const { buildFixture, employeeId } = await import("@/lib/demo/fixture")
  const fx = buildFixture(FIXED_NOW)
  // Electric major task:
  // Available non-project workers: #1, #2, #3 (electric), #4, #5, #6, #11 (electric);
  // #13 & #14 are on active PR-104; #12 is on_call (electric); #7,8,9 busy; #10 offline.
  // Unqualified free workers: #1, #2, #4, #5, #6 = 5.
  const res = eligibleFor(
    { skillArea: "electric", severity: "major" },
    fx.employees,
    fx.projects,
    FIXED_NOW,
  )
  assert.deepEqual(
    res.ranked.map((e) => e.id).sort(),
    [employeeId(3), employeeId(11)].sort(),
  )
  assert.deepEqual(res.onCall.map((e) => e.id), [employeeId(12)])
  assert.equal(res.unqualifiedCount, 5)
})

spec("skills-matching", "backend_set_skills", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { employeeId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  const updated = backend.setSkills(employeeId(4), [{ area: "frigorific", level: "avansat" }])
  assert.equal(updated?.skills.length, 1)
  assert.equal(updated?.skills[0]?.area, "frigorific")
  assert.equal(backend.setSkills("missing-id", []), null)
})

// ============================================================================
// 2. geo-ranking (7 tests)
// ============================================================================

spec("geo-ranking", "haversine_bucharest_landmarks", async () => {
  const { BUCHAREST, haversineMeters } = await import("@/lib/geo")
  assert.equal(Math.round(haversineMeters(BUCHAREST.lat, BUCHAREST.lng, BUCHAREST.lat, BUCHAREST.lng)), 0)
  // Piața Unirii (44.4268, 26.1025) to Piața Victoriei (44.4522, 26.0865) ~ 3.1 km
  const dist = haversineMeters(44.4268, 26.1025, 44.4522, 26.0865)
  assert.ok(dist > 3000 && dist < 3200, `unexpected distance ${dist}`)
})

spec("geo-ranking", "inside_bucharest_bounds", async () => {
  const { isInsideBucharest } = await import("@/lib/geo")
  assert.equal(isInsideBucharest(44.4497, 26.0866), true) // Calea Victoriei
  assert.equal(isInsideBucharest(45.6579, 25.6012), false) // Brașov
})

spec("geo-ranking", "estimate_driving_normal_weekday", async () => {
  const { estimateDriving } = await import("@/lib/geo")
  const r = estimateDriving(6000, NORMAL_AT)
  assert.equal(r.distanceKm, 8.3)
  assert.equal(r.etaMinutes, 23)
})

spec("geo-ranking", "estimate_driving_peak_vs_weekend", async () => {
  const { estimateDriving } = await import("@/lib/geo")
  const peak = estimateDriving(6000, PEAK_AT)
  const weekend = estimateDriving(6000, WEEKEND_AT)
  assert.equal(peak.etaMinutes, 31)
  assert.equal(weekend.etaMinutes, 20)
})

spec("geo-ranking", "estimate_driving_minimum_clamp", async () => {
  const { estimateDriving } = await import("@/lib/geo")
  const veryClose = estimateDriving(0, WEEKEND_AT)
  assert.ok(veryClose.etaMinutes >= 3)
  assert.equal(veryClose.distanceKm, 0.5)
})

spec("geo-ranking", "backend_ranking_sorted_and_capped", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { taskId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  const res = backend.ranking(taskId(4), NORMAL_AT)
  assert.ok(res.candidates.length > 0 && res.candidates.length <= 5)
  res.candidates.forEach((c, idx) => {
    assert.equal(c.rank, idx + 1)
    assert.equal(c.etaSource, "estimated")
    if (idx > 0) {
      const prev = res.candidates[idx - 1]
      assert.ok(
        prev.etaMinutes < c.etaMinutes ||
          (prev.etaMinutes === c.etaMinutes && prev.distanceKm <= c.distanceKm),
      )
    }
  })
})

spec("geo-ranking", "backend_ranking_unknown_task", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const backend = new DemoBackend(FIXED_NOW)
  const res = backend.ranking("non-existent-task", NORMAL_AT)
  assert.deepEqual(res, { candidates: [], onCall: [], unqualifiedCount: 0 })
  assert.deepEqual(backend.candidates("non-existent-task", NORMAL_AT), [])
})

// ============================================================================
// 3. dispatch-lifecycle (7 tests)
// ============================================================================

spec("dispatch-lifecycle", "sync_populates_active_tasks_and_preserves_offline_oncall", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { employeeId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  const snap = backend.state(FIXED_NOW)
  const byId = new Map(snap.employees.map((e) => [e.id, e]))
  // Employee 8 has SV-2408 in_progress; Employee 7 has SV-2411 pending_acceptance
  assert.equal(byId.get(employeeId(8))?.activeTask?.reference, "SV-2408")
  assert.equal(byId.get(employeeId(8))?.status, "busy")
  assert.equal(byId.get(employeeId(7))?.activeTask?.reference, "SV-2411")
  // Employee 10 is offline, Employee 12 is on_call
  assert.equal(byId.get(employeeId(10))?.status, "offline")
  assert.equal(byId.get(employeeId(12))?.status, "on_call")
})

spec("dispatch-lifecycle", "assign_transitions_task_and_marks_worker_busy", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { employeeId, taskId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  const assigned = backend.assign(taskId(4), employeeId(2), FIXED_NOW)
  assert.equal(assigned?.status, "pending_acceptance")
  assert.equal(assigned?.assignedEmployeeId, employeeId(2))
  assert.equal(backend.employee(employeeId(2))?.status, "busy")
  assert.equal(backend.employee(employeeId(2))?.activeTask?.id, taskId(4))
  // Re-assigning non-unassigned task returns null
  assert.equal(backend.assign(taskId(4), employeeId(6), FIXED_NOW), null)
})

spec("dispatch-lifecycle", "assign_promotes_on_call_worker", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { employeeId, taskId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  assert.equal(backend.employee(employeeId(12))?.status, "on_call")
  const assigned = backend.assign(taskId(10), employeeId(12), FIXED_NOW)
  assert.equal(assigned?.status, "pending_acceptance")
  assert.equal(backend.employee(employeeId(12))?.status, "busy")
})

spec("dispatch-lifecycle", "accept_and_arrive_update_timestamps_and_pin", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { employeeId, taskId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  backend.assign(taskId(4), employeeId(2), FIXED_NOW)
  const accepted = backend.accept(taskId(4), FIXED_NOW + 60_000)
  assert.equal(accepted?.status, "in_progress")
  assert.ok(accepted?.acceptedAt)
  const arrived = backend.arrive(taskId(4), FIXED_NOW + 300_000)
  assert.ok(arrived?.arrivedAt)
  const emp = backend.employee(employeeId(2))
  assert.ok(Math.abs((emp.lat ?? 0) - (arrived.lat + 0.00035)) < 1e-6)
  assert.equal(emp.accuracyM, 11)
})

spec("dispatch-lifecycle", "unassign_returns_job_to_queue_and_frees_worker", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { employeeId, taskId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  backend.assign(taskId(4), employeeId(2), FIXED_NOW)
  const resetTask = backend.unassign(taskId(4), FIXED_NOW + 30_000)
  assert.equal(resetTask?.status, "unassigned")
  assert.equal(resetTask?.assignedEmployeeId, null)
  assert.equal(resetTask?.conversation.length, 0)
  assert.equal(backend.employee(employeeId(2))?.status, "available")
})

spec("dispatch-lifecycle", "set_shift_start_populates_default_pin_for_on_call", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { employeeId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  backend.setShift([employeeId(12)], "start", FIXED_NOW)
  const emp = backend.employee(employeeId(12))
  assert.equal(emp.status, "available")
  assert.ok(emp.lat !== null && emp.lng !== null)
})

spec("dispatch-lifecycle", "set_shift_protects_worker_with_active_task", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { employeeId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  // Ensure sync ran so employee 8 has activeTask SV-2408
  backend.state(FIXED_NOW)
  backend.setShift([employeeId(8), employeeId(1)], "end", FIXED_NOW)
  assert.equal(backend.employee(employeeId(8))?.status, "busy")
  assert.equal(backend.employee(employeeId(1))?.status, "offline")
})

// ============================================================================
// 4. clients-pv-reports (7 tests)
// ============================================================================

spec("clients-pv-reports", "normalize_client_key_romanian_diacritics_and_suffixes", async () => {
  const { normalizeClientKey } = await import("@/lib/clients")
  assert.equal(
    normalizeClientKey("S.C. Clinica Medicală Dorobanți S.R.L."),
    "clinica medicala dorobanti",
  )
  assert.equal(normalizeClientKey("Primăria Sectorului 1"), "primaria sectorului 1")
})

spec("clients-pv-reports", "resolve_client_by_id_exact_and_substring", async () => {
  const { resolveClient } = await import("@/lib/clients")
  const { buildFixture, clientId } = await import("@/lib/demo/fixture")
  const fx = buildFixture(FIXED_NOW)
  assert.equal(resolveClient(fx.clients, { clientId: clientId(2) })?.cui, "RO4192510")
  assert.equal(
    resolveClient(fx.clients, { clientName: "SC Spitalul Filantropia SRL" })?.id,
    clientId(1),
  )
  assert.equal(
    resolveClient(fx.clients, { clientName: "Clinica Dorobanti" })?.id,
    clientId(4),
  )
})

spec("clients-pv-reports", "has_custom_pv_template_and_client_queries", async () => {
  const { DEFAULT_PV_TEMPLATE, hasCustomPvTemplate, tasksForClient } = await import(
    "@/lib/clients"
  )
  const { buildFixture, clientId } = await import("@/lib/demo/fixture")
  const fx = buildFixture(FIXED_NOW)
  assert.equal(hasCustomPvTemplate(DEFAULT_PV_TEMPLATE), false)
  const filantropia = fx.clients.find((c) => c.id === clientId(1))
  assert.equal(hasCustomPvTemplate(filantropia.pvTemplate), true)
  assert.equal(tasksForClient(filantropia, fx.tasks, fx.clients).length, 2)
})

spec("clients-pv-reports", "report_number_and_technician_notes", async () => {
  const { reportNumber, technicianNotes } = await import("@/lib/report")
  const { buildFixture, taskId } = await import("@/lib/demo/fixture")
  const fx = buildFixture(FIXED_NOW)
  const completedTask = fx.tasks.find((t) => t.id === taskId(8))
  assert.equal(reportNumber(completedTask), "PV-2403")
  assert.ok(technicianNotes(completedTask).includes("Am igienizat cele 3 unități"))
})

spec("clients-pv-reports", "draft_for_combines_whatsapp_notes_and_client_template", async () => {
  const { draftFor } = await import("@/lib/report")
  const { buildFixture, clientId, taskId } = await import("@/lib/demo/fixture")
  const fx = buildFixture(FIXED_NOW)
  const openTask = structuredClone(fx.tasks.find((t) => t.id === taskId(1)))
  openTask.conversation.push({
    at: new Date(FIXED_NOW).toISOString(),
    direction: "in",
    kind: "text",
    text: "Montaj finalizat și probat.",
  })
  const client = fx.clients.find((c) => c.id === clientId(1))
  const draft = draftFor(openTask, client)
  assert.equal(draft.number, "PV-2408")
  assert.equal(draft.contractNumber, "CTR-2026-008")
  assert.ok(draft.workDone.includes("Montaj finalizat și probat."))
  assert.ok(draft.workDone.includes("Verificare funcțională"))
  assert.equal(draft.customValues[0]?.value, "Pavilion Central")
})

spec("clients-pv-reports", "timeline_for_lifecycle_events", async () => {
  const { timelineFor } = await import("@/lib/report")
  const { buildFixture, taskId } = await import("@/lib/demo/fixture")
  const fx = buildFixture(FIXED_NOW)
  const completedTask = fx.tasks.find((t) => t.id === taskId(8))
  const tl = timelineFor(completedTask)
  assert.equal(tl.length, 5)
  assert.ok(tl[4]?.label.includes("Finalizat"))
})

spec("clients-pv-reports", "backend_create_task_and_complete_with_pv", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { clientId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  const created = backend.createTask(
    {
      title: "Verificare chiller rooftop",
      clientName: "SC Mega Center Titan SRL",
      addressText: "Bd. Liviu Rebreanu 6",
      lat: 44.4232,
      lng: 26.1622,
      priority: "urgent",
      skillArea: "frigorific",
    },
    FIXED_NOW,
  )
  assert.equal(created.clientId, clientId(7))
  assert.equal(created.reference, "SV-2414")
  const closed = backend.complete(created.id, { observations: "Totul OK" }, FIXED_NOW + 600_000)
  assert.equal(closed?.status, "completed")
  assert.equal(closed?.report?.number, "PV-2414")
  assert.equal(closed?.report?.contractNumber, "CTR-2026-031")
  assert.equal(closed?.report?.observations, "Totul OK")
})

// ============================================================================
// 5. projects-timing (7 tests)
// ============================================================================

spec("projects-timing", "span_label_hours_and_days", async () => {
  const { spanLabel } = await import("@/lib/project-timing")
  assert.equal(spanLabel(15 * 60_000), "1 oră")
  assert.equal(spanLabel(4 * 3_600_000), "4 ore")
  assert.equal(spanLabel(24 * 3_600_000), "1 zi")
  assert.equal(spanLabel(12 * 24 * 3_600_000), "12 zile")
})

spec("projects-timing", "project_timing_active_multiday", async () => {
  const { projectTiming } = await import("@/lib/project-timing")
  const { buildFixture, projectId } = await import("@/lib/demo/fixture")
  const fx = buildFixture(FIXED_NOW)
  // PR-104 started 3 days ago, lasts 12 days -> day 4 of 12
  const pr104 = fx.projects.find((p) => p.id === projectId(1))
  const t = projectTiming(pr104, FIXED_NOW)
  assert.equal(t.phase, "active")
  assert.equal(t.phaseLabel, "În desfășurare")
  assert.equal(t.progressLabel, "ziua 4 din 12")
  assert.equal(t.compact, "ziua 4/12")
  assert.ok(Math.abs(t.progress - 0.25) < 1e-6)
})

spec("projects-timing", "project_timing_active_intraday", async () => {
  const { projectTiming } = await import("@/lib/project-timing")
  const { buildFixture, projectId } = await import("@/lib/demo/fixture")
  const fx = buildFixture(FIXED_NOW)
  // PR-105 starts in 150m, lasts 4h; inspect 60m after start (3h left)
  const pr105 = fx.projects.find((p) => p.id === projectId(2))
  const midNow = Date.parse(pr105.startsAt) + 60 * 60_000
  const t = projectTiming(pr105, midNow)
  assert.equal(t.phase, "active")
  assert.equal(t.progressLabel, "mai sunt 3 ore")
  assert.equal(t.compact, "încă 3 ore")
})

spec("projects-timing", "project_timing_planned_and_done", async () => {
  const { projectTiming } = await import("@/lib/project-timing")
  const { buildFixture, projectId } = await import("@/lib/demo/fixture")
  const fx = buildFixture(FIXED_NOW)
  const pr103 = fx.projects.find((p) => p.id === projectId(3))
  const planned = projectTiming(pr103, FIXED_NOW)
  assert.equal(planned.phase, "planned")
  assert.equal(planned.progress, 0)
  const done = projectTiming(pr103, Date.parse(pr103.endsAt) + 2 * 3_600_000)
  assert.equal(done.phase, "done")
  assert.equal(done.progress, 1)
  assert.equal(done.compact, "încheiat")
})

spec("projects-timing", "backend_save_project_create_and_update", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { clientId, employeeId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  const saved = backend.saveProject(
    {
      name: "Tablou general corp B",
      clientId: clientId(5),
      addressText: "Bd. Iuliu Maniu 120",
      lat: 44.43398,
      lng: 26.02601,
      startsAt: new Date(FIXED_NOW - 3_600_000).toISOString(),
      endsAt: new Date(FIXED_NOW + 5 * 3_600_000).toISOString(),
      employeeIds: [employeeId(3)],
    },
    FIXED_NOW,
  )
  assert.equal(saved?.reference, "PR-106")
  assert.equal(saved?.clientName, "Spitalul Clinic Prof. Dr. Al. Obregia")
  const updated = backend.saveProject({ id: saved.id, notes: "Cuplare noaptea" }, FIXED_NOW)
  assert.equal(updated?.notes, "Cuplare noaptea")
  assert.equal(backend.saveProject({ name: "Incomplet" }, FIXED_NOW), null)
})

spec("projects-timing", "backend_delete_project", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { projectId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  assert.equal(backend.deleteProject(projectId(2), FIXED_NOW), true)
  assert.equal(backend.projects.length, 2)
  assert.equal(backend.deleteProject("unknown-project", FIXED_NOW), false)
})

spec("projects-timing", "backend_project_overview_phase_ordering", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const backend = new DemoBackend(FIXED_NOW)
  const overview = backend.projectOverview(FIXED_NOW)
  assert.equal(overview.length, 3)
  assert.equal(overview[0]?.timing.phase, "active")
  assert.equal(overview[0]?.project.reference, "PR-104")
  assert.equal(overview[1]?.timing.phase, "planned")
  assert.equal(overview[2]?.timing.phase, "planned")
  assert.ok(Date.parse(overview[1].project.startsAt) < Date.parse(overview[2].project.startsAt))
})

// ============================================================================
// 6. freshness-sla (7 tests)
// ============================================================================

spec("freshness-sla", "format_phone_romanian_variants", async () => {
  const { formatPhone } = await import("@/lib/format")
  assert.equal(formatPhone("40727123456"), "+40 727 123 456")
  assert.equal(formatPhone("0727123456"), "0727 123 456")
  assert.equal(formatPhone("+49 151 999"), "+49 151 999")
})

spec("freshness-sla", "minutes_since_and_relative_short", async () => {
  const { minutesSince, relativeShort } = await import("@/lib/format")
  assert.equal(minutesSince(null, FIXED_NOW), null)
  assert.equal(relativeShort(null, FIXED_NOW), "—")
  assert.equal(relativeShort(new Date(FIXED_NOW - 20_000).toISOString(), FIXED_NOW), "acum")
  assert.equal(relativeShort(new Date(FIXED_NOW - 15 * 60_000).toISOString(), FIXED_NOW), "15 min")
  assert.equal(relativeShort(new Date(FIXED_NOW - 180 * 60_000).toISOString(), FIXED_NOW), "3 h")
  assert.equal(relativeShort(new Date(FIXED_NOW - 3 * 1440 * 60_000).toISOString(), FIXED_NOW), "3 z")
})

spec("freshness-sla", "get_freshness_bands_and_sources", async () => {
  const { getFreshness } = await import("@/lib/format")
  assert.equal(getFreshness(null, null, FIXED_NOW).tone, "none")
  const fresh = getFreshness(new Date(FIXED_NOW - 10 * 60_000).toISOString(), "whatsapp_pin", FIXED_NOW)
  assert.equal(fresh.tone, "fresh")
  assert.equal(fresh.label, "WhatsApp")
  const recent = getFreshness(new Date(FIXED_NOW - 90 * 60_000).toISOString(), "manual", FIXED_NOW)
  assert.equal(recent.tone, "recent")
  assert.equal(recent.label, "Manual")
  const stale = getFreshness(new Date(FIXED_NOW - 300 * 60_000).toISOString(), "live_beacon", FIXED_NOW)
  assert.equal(stale.tone, "stale")
})

spec("freshness-sla", "sla_status_ok_at_risk_and_breached", async () => {
  const { slaStatus } = await import("@/lib/format")
  const mk = (priority, agoMin, status = "unassigned") => ({
    priority,
    status,
    createdAt: new Date(FIXED_NOW - agoMin * 60_000).toISOString(),
    completedAt: null,
  })
  // emergency target = 90m (25% = 23m)
  assert.equal(slaStatus(mk("emergency", 30), FIXED_NOW).tone, "ok")
  assert.equal(slaStatus(mk("emergency", 75), FIXED_NOW).tone, "at_risk")
  assert.equal(slaStatus(mk("emergency", 100), FIXED_NOW).tone, "breached")
  assert.equal(slaStatus(mk("emergency", 100, "cancelled"), FIXED_NOW).tone, "ok")
})

spec("freshness-sla", "sla_status_freezes_at_completed_at", async () => {
  const { slaStatus } = await import("@/lib/format")
  const task = {
    priority: "urgent",
    status: "completed",
    createdAt: new Date(FIXED_NOW - 500 * 60_000).toISOString(),
    completedAt: new Date(FIXED_NOW - 400 * 60_000).toISOString(), // closed in 100m (< 240m)
  }
  const s = slaStatus(task, FIXED_NOW)
  assert.equal(s.tone, "ok")
  assert.equal(s.remainingMinutes, 140)
})

spec("freshness-sla", "backend_overdue_tasks_empty_on_fresh_fixture", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const backend = new DemoBackend(FIXED_NOW)
  // In fresh fixture, open tasks were created <= 96m ago (urgent <= 12m, normal <= 96m) -> 0 overdue
  assert.deepEqual(backend.overdueTasks(FIXED_NOW), [])
})

spec("freshness-sla", "backend_overdue_tasks_sorts_breached_before_at_risk", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const backend = new DemoBackend(FIXED_NOW)
  // Advance 230 minutes: SV-2406 (created -12m -> age 242m, urgent 240m -> -2m breached),
  // SV-2412 (created -7m -> age 237m, urgent 240m -> +3m at_risk)
  const later = FIXED_NOW + 230 * 60_000
  const overdue = backend.overdueTasks(later)
  const refs = overdue.map((row) => row.task.reference)
  assert.ok(refs.includes("SV-2406"))
  assert.ok(refs.includes("SV-2412"))
  assert.ok(overdue[0].sla.remainingMinutes <= overdue[1].sla.remainingMinutes)
})

// ============================================================================
// 7. integration-interactions (6 cross-ticket synergy tests)
// ============================================================================

spec("integration", "ranking_combines_skills_projects_oncall_and_support", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { employeeId, taskId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  // SV-2406 (taskId(10)): electric, major, Calea Victoriei 155
  const r = backend.ranking(taskId(10), NORMAL_AT)
  assert.deepEqual(
    r.candidates.map((c) => c.employee.id),
    [employeeId(3), employeeId(11)], // Cristina Pavel (closer, avansat) then Dan Ciobanu (incepator)
  )
  assert.equal(r.candidates[0]?.needsSupport, false)
  assert.equal(r.candidates[1]?.needsSupport, true)
  assert.deepEqual(r.onCall.map((e) => e.id), [employeeId(12)])
  assert.equal(r.unqualifiedCount, 5)
})

spec("integration", "assigning_on_call_removes_from_on_call_and_unassign_restores", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { employeeId, taskId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  backend.assign(taskId(10), employeeId(12), FIXED_NOW)
  const during = backend.ranking(taskId(7), NORMAL_AT)
  assert.equal(during.onCall.length, 0)
  backend.setShift([employeeId(12)], "start", FIXED_NOW)
  backend.unassign(taskId(10), FIXED_NOW + 60_000)
  const after = backend.ranking(taskId(10), NORMAL_AT)
  assert.ok(after.candidates.some((c) => c.employee.id === employeeId(12)))
})

spec("integration", "saving_active_project_fuzzy_client_excludes_worker_from_ranking", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { clientId, employeeId, taskId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  const project = backend.saveProject(
    {
      name: "Urgență UPS sală RMN",
      clientName: "SC Clinica Medicala Dorobanti SRL",
      addressText: "Calea Dorobanți 102",
      lat: 44.45921,
      lng: 26.09361,
      startsAt: new Date(FIXED_NOW - 30 * 60_000).toISOString(),
      endsAt: new Date(FIXED_NOW + 180 * 60_000).toISOString(),
      employeeIds: [employeeId(3)],
    },
    FIXED_NOW,
  )
  assert.equal(project?.clientId, clientId(4))
  assert.equal(backend.employee(employeeId(3))?.status, "busy")
  const cands = backend.candidates(taskId(10), NORMAL_AT)
  assert.deepEqual(cands.map((c) => c.employee.id), [employeeId(11)])
})

spec("integration", "end_to_end_fuzzy_task_dispatch_pv_completion_frees_worker", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { timelineFor } = await import("@/lib/report")
  const { clientId, employeeId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  const task = backend.createTask(
    {
      title: "Avarie pompă circulație",
      clientName: "spitalul filantropia",
      addressText: "Bd. Ion Mihalache 11-13",
      lat: 44.45203,
      lng: 26.08302,
      priority: "emergency",
      skillArea: "termice",
      severity: "major",
    },
    FIXED_NOW,
  )
  assert.equal(task.clientId, clientId(1))
  backend.assign(task.id, employeeId(1), FIXED_NOW + 60_000)
  backend.accept(task.id, FIXED_NOW + 120_000)
  backend.arrive(task.id, FIXED_NOW + 600_000)
  assert.equal(backend.employee(employeeId(1))?.status, "busy")
  const done = backend.complete(task.id, { materials: "Garnitură DN50" }, FIXED_NOW + 1_200_000)
  assert.equal(done?.report?.contractNumber, "CTR-2026-008")
  assert.equal(done?.report?.materials, "Garnitură DN50")
  assert.equal(timelineFor(done).length, 5)
  assert.equal(backend.employee(employeeId(1))?.status, "available")
})

spec("integration", "updating_skills_dynamically_changes_candidate_eligibility", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { employeeId, taskId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  backend.setSkills(employeeId(4), [{ area: "electric", level: "avansat" }])
  const cands = backend.candidates(taskId(10), NORMAL_AT)
  const ioana = cands.find((c) => c.employee.id === employeeId(4))
  assert.ok(ioana, "Ioana Stan should now be ranked for electric task")
  assert.equal(ioana.skillLevel, "avansat")
  assert.equal(ioana.needsSupport, false)
})

spec("integration", "completing_at_risk_task_clears_it_from_overdue_queue", async () => {
  const { DemoBackend } = await import("@/lib/demo/mock-server")
  const { taskId } = await import("@/lib/demo/fixture")
  const backend = new DemoBackend(FIXED_NOW)
  const later = FIXED_NOW + 230 * 60_000
  assert.ok(backend.overdueTasks(later).some((x) => x.task.id === taskId(4)))
  backend.complete(taskId(4), {}, later)
  assert.ok(!backend.overdueTasks(later).some((x) => x.task.id === taskId(4)))
})

const results = []
for (const c of cases) {
  try {
    await c.fn()
    results.push({ id: c.id, section: c.section, passed: true })
  } catch (err) {
    results.push({
      id: c.id,
      section: c.section,
      passed: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

process.stdout.write(JSON.stringify({ total: results.length, results }) + "\n")
