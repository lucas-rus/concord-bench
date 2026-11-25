import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const buildDir = path.resolve(process.env.DISPECERAT_BUILD_DIR || ".tsbuild")

function resolveCandidate(filePath) {
  for (const cand of [
    filePath,
    `${filePath}.js`,
    `${filePath}.mjs`,
    path.join(filePath, "index.js"),
  ]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      return pathToFileURL(cand).href
    }
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = path.join(buildDir, specifier.slice(2))
    const found = resolveCandidate(target)
    if (found) return { url: found, shortCircuit: true }
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file://")
  ) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL))
    const target = path.resolve(parentDir, specifier)
    const found = resolveCandidate(target)
    if (found) return { url: found, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
