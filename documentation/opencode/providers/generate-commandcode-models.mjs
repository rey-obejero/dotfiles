// Regenerate the Command Code model catalog partials from models.dev.
//
//   node generate-commandcode-models.mjs            # dry run: prints a report only
//   node generate-commandcode-models.mjs --write    # rewrites the .chezmoitemplates partials
//
// Data source: https://models.dev/api.json (downloaded to the OS temp dir unless
// MODELS_JSON points at an existing snapshot).
//
// Levels policy: a model's reasoning-effort variants come from its first-party
// ("lab") provider entry when models.dev has one; otherwise from the most common
// effort set across providers. This keeps the "standard" levels and avoids the
// over-broad union that naive aggregation produces.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, "../../../.chezmoitemplates/opencode")
const CACHE = process.env.MODELS_JSON || path.join(os.tmpdir(), "opencode-models-dev.json")

async function loadModels() {
  if (process.env.MODELS_JSON && fs.existsSync(process.env.MODELS_JSON)) {
    return JSON.parse(fs.readFileSync(process.env.MODELS_JSON, "utf8"))
  }
  const res = await fetch("https://models.dev/api.json")
  if (!res.ok) throw new Error(`models.dev fetch failed: ${res.status}`)
  const json = await res.json()
  fs.writeFileSync(CACHE, JSON.stringify(json))
  return json
}

const MODELS = await loadModels()
const WRITE = process.argv.includes("--write")

const MAIN_KEYS = [
  "deepseek/deepseek-v4-flash","deepseek/deepseek-v4-flash-vision-exp","deepseek/deepseek-v4-pro",
  "deepseek/deepseek-v4-flash-fast","deepseek/deepseek-v4.1-flash",
  "zai-org/GLM-5","zai-org/GLM-5.1","zai-org/GLM-5.2","zai-org/GLM-5.2-Fast","zai-org/GLM-5.3","z-ai/GLM-5.3-Flash",
  "gpt-5.3-codex","gpt-5.4","gpt-5.4-mini","gpt-5.5","gpt-5.6-luna","gpt-5.6-sol","gpt-5.6-terra","gpt-6-astra",
  "google/gemini-3.1-flash-lite","google/gemini-3.5-flash","google/gemini-3.5-flash-lite","google/gemini-3.6-flash",
  "google/gemini-3.7-flash","google/gemini-3.8-flash",
  "meta/muse-spark-1.1","meta/muse-spark-1.2","meta/muse-spark-1.2-contributor","meta/muse-spark-1.3","meta/muse-spark-1.3-contributor",
  "MiniMaxAI/MiniMax-M2.5","MiniMaxAI/MiniMax-M2.7","MiniMaxAI/MiniMax-M3",
  "moonshotai/Kimi-K2.5","moonshotai/Kimi-K2.6","moonshotai/Kimi-K2.7-Code","moonshotai/Kimi-K2.7-Code-Highspeed","moonshotai/Kimi-K3",
  "nvidia/nemotron-3-ultra-550b-a55b",
  "claude-fable-5","claude-fable-5-1","claude-haiku-4-5","claude-opus-4-7","claude-opus-4-8","claude-opus-5","claude-sonnet-4-6","claude-sonnet-5",
  "poolside/laguna-s-2.1-free","sakana/fugu-ultra","stepfun/Step-3.5-Flash","stepfun/Step-3.7-Flash",
  "tencent/hy3-paid","tencent/hy4-preview","thinkingmachines/inkling","thinkingmachines/inkling-small",
  "xai/grok-4.5","xai/grok-4.6","xiaomi/mimo-v2.5","xiaomi/mimo-v2.5-pro",
  "Qwen/Qwen3.6-Max-Preview","Qwen/Qwen3.6-Plus","Qwen/Qwen3.7-Flash","Qwen/Qwen3.7-Max","Qwen/Qwen3.7-Plus",
  "Qwen/Qwen3.8-27B","Qwen/Qwen3.8-Flash","Qwen/Qwen3.8-Max","Qwen/Qwen3.8-Max-0902",
]
const FREE_KEYS = ["meituan/longcat-2.0:free","inclusionai/ling-3.0-flash-sante:free"]

const VENDOR_LAB = {
  "zai-org":"zhipuai","z-ai":"zhipuai","qwen":"alibaba","minimaxai":"minimax","moonshotai":"moonshotai",
  "google":"google","meta":"meta","xai":"xai","nvidia":"nvidia","poolside":"poolside","sakana":"sakana",
  "stepfun":"stepfun","tencent":"tencent","thinkingmachines":"thinkingmachines","xiaomi":"xiaomi",
  "meituan":"meituan","inclusionai":"inclusionai","deepseek":"deepseek",
}
const PROVIDER_PREF = ["opencode-go","opencode","openrouter","vercel","nano-gpt"]

const ORDER = ["none","minimal","low","medium","high","xhigh","max"]

function lastSeg(s){ return s.split("/").pop().toLowerCase() }
function norm(s){
  let x = lastSeg(s)
  x = x.replace(/:(free|thinking)$/,"").replace(/-(free|thinking)$/,"")
  return x
}
function keyStem(s){ return norm(s).replace(/[^a-z0-9.]/g,"") }

function labOf(key){
  const v = key.split("/")[0].toLowerCase()
  if(key.includes("/")) return VENDOR_LAB[v] || null
  if(key.startsWith("gpt-")) return "openai"
  if(key.startsWith("claude-")) return "anthropic"
  if(key.startsWith("deepseek-")) return "deepseek"
  return null
}

// build candidate index by normalized segment
const bySeg = new Map()
for(const [pid, p] of Object.entries(MODELS)){
  for(const [mid, m] of Object.entries(p.models || {})){
    const seg = norm(mid)
    if(!bySeg.has(seg)) bySeg.set(seg, [])
    bySeg.get(seg).push({ pid, mid, m })
  }
}

function effortValues(m){
  const ro = Array.isArray(m.reasoning_options) ? m.reasoning_options : []
  const e = ro.find(o => o && o.type === "effort" && Array.isArray(o.values))
  if(!e) return null
  return ORDER.filter(v => e.values.includes(v) && v !== "none")
}

function orderSet(arr){ return ORDER.filter(v => arr.includes(v)) }

function pickCandidates(key){
  const seg = norm(key)
  let cands = bySeg.get(seg)
  let quality = "exact"
  if(!cands || !cands.length){
    // fuzzy: startsWith either direction on the alphanumeric stem
    const stem = keyStem(key)
    cands = []
    for(const [s, list] of bySeg){
      const cs = s.replace(/[^a-z0-9.]/g,"")
      if(cs === stem || cs.startsWith(stem) || stem.startsWith(cs)) cands.push(...list)
    }
    quality = cands.length ? "fuzzy" : "none"
  }
  return { cands: cands || [], quality }
}

function choosePrimary(cands, key){
  const lab = labOf(key)
  const hasData = c => c.m.cost && (c.m.cost.input !== undefined || c.m.cost.output !== undefined) && c.m.limit && c.m.limit.context
  if(lab){
    const hit = cands.find(c => c.pid === lab)
    if(hit) return hit
  }
  for(const pref of PROVIDER_PREF){ const hit = cands.find(c => c.pid === pref); if(hit) return hit }
  const withData = cands.filter(hasData)
  return (withData[0] || cands[0])
}

function chooseLevels(cands, primary, key){
  const lab = labOf(key)
  if(lab){
    const seg = norm(key)
    const labEntry = cands.find(c => c.pid === lab && norm(c.mid) === seg)
    if(labEntry){
      const v = effortValues(labEntry.m)
      return v || []
    }
  }
  const counts = new Map()
  for(const c of cands){
    const v = effortValues(c.m)
    if(!v || !v.length) continue
    const k = v.join(",")
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  if(!counts.size){
    // maybe only toggles
    return []
  }
  const pv = effortValues(primary.m)
  const entries = [...counts.entries()].sort((a,b)=>{
    if(b[1] !== a[1]) return b[1] - a[1]
    if(pv && a[0] === pv.join(",")) return -1
    return b[0].split(",").length - a[0].split(",").length
  })
  return orderSet(entries[0][0].split(","))
}

function modelName(primary, key, oldNames){
  const n = primary && primary.m && primary.m.name
  if(n) return n
  return oldNames.get(key) || key
}

// collect old names for fallback
function readOldNames(file){
  const txt = fs.readFileSync(file, "utf8")
  const map = new Map()
  const re = /"([^"]+)"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([^"]+)"/g
  let m
  while((m = re.exec(txt))){
    if(m[1] !== "models") map.set(m[1], m[2])
  }
  return map
}
const oldNames = new Map([...readOldNames(`${SRC}/commandcode-models.jsonc`), ...readOldNames(`${SRC}/commandcode-free-models.jsonc`)])

function buildModel(key, free = false){
  const { cands, quality } = pickCandidates(key)
  if(!cands.length) return { quality: "MISS", text: null }
  const primary = choosePrimary(cands, key)
  const levels = chooseLevels(cands, primary, key)
  const m = primary.m
  const caps = {
    tools: m.tool_call === true,
    input: (m.modalities && m.modalities.input) || ["text"],
    output: (m.modalities && m.modalities.output) || ["text"],
  }
  const limit = {}
  if(m.limit){ if(m.limit.context !== undefined) limit.context = m.limit.context; if(m.limit.output !== undefined) limit.output = m.limit.output }
  const cost = {}
  if(free){
    cost.input = 0; cost.output = 0; cost.cache = { read: 0 }
  } else if(m.cost){
    if(m.cost.input !== undefined) cost.input = m.cost.input
    if(m.cost.output !== undefined) cost.output = m.cost.output
    const cache = {}
    if(m.cost.cache_read !== undefined) cache.read = m.cost.cache_read
    if(m.cost.cache_write !== undefined) cache.write = m.cost.cache_write
    if(Object.keys(cache).length) cost.cache = cache
  }
  const obj = { name: modelName(primary, key, oldNames) }
  if(Object.keys(cost).length) obj.cost = cost
  if(Object.keys(limit).length) obj.limit = limit
  obj.capabilities = caps
  if(levels.length) obj.variants = levels.map(l => ({ id: l, settings: { reasoningEffort: l } }))
  return { quality, primary, levels, obj, text: stringifyModel(obj, 4), candCount: cands.length }
}

function j(v){ return JSON.stringify(v) }
function stringifyModel(obj, indent = 6){
  const pad = " ".repeat(indent)
  const lines = [`{`]
  lines.push(`${pad}  "name": ${j(obj.name)},`)
  if(obj.cost){
    const c = obj.cost
    const cparts = []
    if(c.input !== undefined) cparts.push(`"input": ${c.input}`)
    if(c.output !== undefined) cparts.push(`"output": ${c.output}`)
    if(c.cache){
      const cp = []
      if(c.cache.read !== undefined) cp.push(`"read": ${c.cache.read}`)
      if(c.cache.write !== undefined) cp.push(`"write": ${c.cache.write}`)
      if(cp.length) cparts.push(`"cache": { ${cp.join(", ")} }`)
    }
    lines.push(`${pad}  "cost": { ${cparts.join(", ")} },`)
  }
  if(obj.limit) lines.push(`${pad}  "limit": { "context": ${obj.limit.context}, "output": ${obj.limit.output} },`)
  lines.push(`${pad}  "capabilities": { "tools": ${obj.capabilities.tools}, "input": ${j(obj.capabilities.input)}, "output": ${j(obj.capabilities.output)} },`)
  if(obj.variants){
    lines.push(`${pad}  "variants": [`)
    obj.variants.forEach((v, i) => {
      lines.push(`${pad}    { "id": ${j(v.id)}, "settings": { "reasoningEffort": ${j(v.settings.reasoningEffort)} } }${i < obj.variants.length - 1 ? "," : ""}`)
    })
    lines.push(`${pad}  ]`)
  } else {
    // strip trailing comma from previous line
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "")
  }
  lines.push(`${pad}}`)
  return lines.join("\n")
}

const groups = [
  { label: "DeepSeek", keys: MAIN_KEYS.filter(k => k.startsWith("deepseek/")) },
  { label: "Z-AI / GLM", keys: MAIN_KEYS.filter(k => k.startsWith("zai-org/") || k.startsWith("z-ai/")) },
  { label: "OpenAI", keys: MAIN_KEYS.filter(k => k.startsWith("gpt-")) },
  { label: "Google Gemini", keys: MAIN_KEYS.filter(k => k.startsWith("google/")) },
  { label: "Meta / Muse Spark", keys: MAIN_KEYS.filter(k => k.startsWith("meta/")) },
  { label: "MiniMax", keys: MAIN_KEYS.filter(k => k.startsWith("MiniMaxAI/")) },
  { label: "Moonshot / Kimi", keys: MAIN_KEYS.filter(k => k.startsWith("moonshotai/")) },
  { label: "NVIDIA", keys: MAIN_KEYS.filter(k => k.startsWith("nvidia/")) },
  { label: "Anthropic", keys: MAIN_KEYS.filter(k => k.startsWith("claude-")) },
  { label: "Poolside", keys: MAIN_KEYS.filter(k => k.startsWith("poolside/")) },
  { label: "Sakana", keys: MAIN_KEYS.filter(k => k.startsWith("sakana/")) },
  { label: "StepFun", keys: MAIN_KEYS.filter(k => k.startsWith("stepfun/")) },
  { label: "Tencent", keys: MAIN_KEYS.filter(k => k.startsWith("tencent/")) },
  { label: "Thinking Machines", keys: MAIN_KEYS.filter(k => k.startsWith("thinkingmachines/")) },
  { label: "xAI / Grok", keys: MAIN_KEYS.filter(k => k.startsWith("xai/")) },
  { label: "Xiaomi", keys: MAIN_KEYS.filter(k => k.startsWith("xiaomi/")) },
  { label: "Alibaba / Qwen", keys: MAIN_KEYS.filter(k => k.startsWith("Qwen/")) },
]
// sanity: all keys covered
const covered = new Set(groups.flatMap(g => g.keys))
for(const k of MAIN_KEYS) if(!covered.has(k)) console.error("UNGROUPED KEY:", k)

const report = []
const blocks = []
for(const g of groups){
  const lines = [`    // ---- ${g.label} ----`]
  for(const key of g.keys){
    const r = buildModel(key)
    report.push({ key, quality: r.quality, cands: r.candCount, primary: r.primary ? r.primary.pid : "-", levels: r.levels ? r.levels.join("|") : "-", old: oldNames.get(key) || "", name: r.obj ? r.obj.name : "" })
    if(r.text) lines.push(`    ${j(key)}: ${r.text},`)
    else lines.push(`    // MISS: ${key}`)
  }
  const last = lines.length - 1
  lines[last] = lines[last].replace(/,$/, "")
  blocks.push(lines.join("\n"))
}

console.log("=== REPORT (key | quality | cands | primary | levels | models.dev name | old name) ===")
for(const r of report){
  console.log([r.key, r.quality, r.cands, r.primary, r.levels, r.name, r.old].join(" | "))
}
const misses = report.filter(r => r.quality === "MISS")
console.log("\nMISSES:", misses.length)
console.log("FUZZY:", report.filter(r => r.quality === "fuzzy").length)

if(WRITE){
  const body = `  "models": {\n${blocks.join(",\n\n")}\n  }\n`
  fs.writeFileSync(`${SRC}/commandcode-models.jsonc`, body)
  console.log("WROTE main partial")
  // free models
  const freeLines = []
  const freeGroups = [
    { label: "Meituan", keys: FREE_KEYS.filter(k => k.startsWith("meituan/")) },
    { label: "InclusionAI", keys: FREE_KEYS.filter(k => k.startsWith("inclusionai/")) },
  ]
  const freeBlocks = []
  for(const g of freeGroups){
    const glines = [`    // ---- ${g.label} ----`]
    for(const key of g.keys){
      const r = buildModel(key, true)
      if(r.text) glines.push(`    ${j(key)}: ${r.text}`)
      else glines.push(`    // MISS: ${key}`)
    }
    if(glines.length > 1) glines[glines.length - 1] = glines[glines.length - 1]
    freeBlocks.push(glines.join("\n"))
  }
  freeLines.push(...freeBlocks)
  const freeBody = `  "models": {\n${freeBlocks.join(",\n\n")}\n  }\n`
  fs.writeFileSync(`${SRC}/commandcode-free-models.jsonc`, freeBody)
  console.log("WROTE free partial")
}
