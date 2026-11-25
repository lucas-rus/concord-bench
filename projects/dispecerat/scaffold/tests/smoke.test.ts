import assert from "node:assert/strict"
import test from "node:test"
import { clientId, employeeId, projectId, taskId } from "@/lib/demo/fixture"
import { DemoBackend } from "@/lib/demo/mock-server"

const FIXED_NOW = Date.parse("2026-05-12T10:30:00.000Z")

test("scaffold loads Bucharest fixture counts", () => {
  const backend = new DemoBackend(FIXED_NOW)
  assert.equal(backend.employees.length, 14)
  assert.equal(backend.clients.length, 8)
  assert.equal(backend.tasks.length, 10)
  assert.equal(backend.projects.length, 3)
})

test("scaffold lookup helpers resolve seeded IDs", () => {
  const backend = new DemoBackend(FIXED_NOW)
  assert.equal(backend.employee(employeeId(1))?.fullName, "Ana Georgescu")
  assert.equal(backend.client(clientId(1))?.name, "Spitalul Clinic Filantropia")
  assert.equal(backend.task(taskId(4))?.reference, "SV-2412")
  assert.equal(backend.project(projectId(1))?.reference, "PR-104")
})

test("scaffold state sorts urgent tasks ahead of normal tasks", () => {
  const backend = new DemoBackend(FIXED_NOW)
  const snapshot = backend.state(FIXED_NOW)
  assert.equal(snapshot.tasks[0]?.priority, "urgent")
  assert.equal(snapshot.meta.routesProvider, "estimated")
})
