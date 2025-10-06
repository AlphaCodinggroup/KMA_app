// scripts/generate-flow-images-index.mjs
// Node >=16, ESM. Escanea assets/flows/ y genera src/features/flow-runner/ui/flowStepImages.ts
import fs from 'fs'
import path from 'path'
import url from 'url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// Ruta al directorio con imágenes
const flowsDir = path.resolve(__dirname, '../assets/flows')
// Ruta de salida del índice TS
const outFile = path.resolve(__dirname, '../src/features/flow-runner/ui/flowStepImages.ts')

// Extensiones soportadas (en orden de prioridad si hubiera duplicados del mismo número)
const exts = ['.gif', '.jpg', '.jpeg', '.png', '.webp']

function pad2(n) {
  return String(n).padStart(2, '0')
}

if (!fs.existsSync(flowsDir)) {
  console.error(
    `[generate-flow-images-index] No existe ${flowsDir}. Crealo y poné tus imágenes (e.g. 07.jpg)`,
  )
  process.exit(1)
}

const files = fs.readdirSync(flowsDir)
const entries = new Map() // key: "07", value: relative file path with ext

for (const f of files) {
  const ext = path.extname(f).toLowerCase()
  const base = path.basename(f, ext)
  if (!exts.includes(ext)) continue

  // Extrae solo números (soporta nombres como "07", "07-ramp", "img_07", etc.)
  const match = base.match(/(\d{1,2})/)
  if (!match) continue

  const num = pad2(Number(match[1]))
  // Mantener la primera ocurrencia por prioridad de carpeta / orden de ext
  if (!entries.has(num)) {
    entries.set(num, `../../../../assets/flows/${f}`)
  }
}

// Generar TS
let ts = `/* AUTO-GENERATED FILE. DO NOT EDIT BY HAND.
 * Ejecutá: node scripts/generate-flow-images-index.mjs
 * Mapea 'NN' (e.g. "07") -> require('assets/flows/07.jpg|.png|.gif|...')
 */
import type { ImageSourcePropType } from 'react-native';

export const flowStepImagesByNumber: Record<string, ImageSourcePropType> = {
`

for (const [num, rel] of entries) {
  ts += `  "${num}": require("${rel}"),\n`
}

ts += `};
`

// Asegura carpeta destino
fs.mkdirSync(path.dirname(outFile), { recursive: true })
// Escribe archivo
fs.writeFileSync(outFile, ts, 'utf-8')

console.log(`[generate-flow-images-index] OK -> ${outFile} (${entries.size} imágenes indexadas)`)
