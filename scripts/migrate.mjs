/**
 * CineMesh — Supabase migration runner
 * Uses the Supabase Management API to execute SQL directly.
 * Run with: node scripts/migrate.mjs
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

const PROJECT_REF    = 'rfbkstlbyvplnqciwujm'
const SERVICE_ROLE   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmYmtzdGxieXZwbG5xY2l3dWptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODEzOTQ2NSwiZXhwIjoyMDkzNzE1NDY1fQ.lsmvML6fhoQMbhCQWuUVVusoOeirkA_IMWXvMxN-Cg4'
const SUPABASE_URL   = `https://${PROJECT_REF}.supabase.co`
const MGMT_API       = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

// ─── SQL: check existing schemas ─────────────────────────────────────────────
const CHECK_SCHEMAS_SQL = `
  SELECT schema_name
  FROM information_schema.schemata
  WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast','pg_temp_1','pg_toast_temp_1')
  ORDER BY schema_name;
`

// ─── Migration SQL ────────────────────────────────────────────────────────────
const MIGRATION_SQL = readFileSync(join(__dir, 'cinemesh-migration.sql'), 'utf8')

// ─── Helper: run SQL via Management API ──────────────────────────────────────
async function runSQL(sql, label, token) {
  const res = await fetch(MGMT_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  const body = await res.text()
  let parsed
  try { parsed = JSON.parse(body) } catch { parsed = body }

  return { ok: res.ok, status: res.status, data: parsed }
}

// ─── Helper: run SQL via REST RPC (service role) ──────────────────────────────
async function runSQLviaRPC(sql) {
  // Supabase exposes a pg_dump-like endpoint under the internal API
  // Try the internal SQL execution endpoint
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE}`,
      'apikey': SERVICE_ROLE,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  })
  const body = await res.text()
  let parsed
  try { parsed = JSON.parse(body) } catch { parsed = body }
  return { ok: res.ok, status: res.status, data: parsed }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🎬  CineMesh — Supabase Migration Runner')
  console.log('━'.repeat(50))
  console.log(`Project: ${PROJECT_REF}`)
  console.log(`URL:     ${SUPABASE_URL}\n`)

  // ── Step 1: Try Management API with service role ─────────────────────────
  console.log('① Trying Management API with service role key…')
  const schemaCheck = await runSQL(CHECK_SCHEMAS_SQL, 'check schemas', SERVICE_ROLE)

  if (schemaCheck.ok) {
    console.log('✅  Management API accepted service role key')
    const schemas = schemaCheck.data?.map?.(r => r.schema_name) ?? []
    console.log('   Existing schemas:', schemas.length ? schemas.join(', ') : '(none)')

    if (schemas.includes('cinemesh')) {
      console.log('\n⚠️   cinemesh schema already exists — checking tables…')
      const tablesRes = await runSQL(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'cinemesh' ORDER BY table_name;`,
        'check tables',
        SERVICE_ROLE
      )
      const tables = tablesRes.data?.map?.(r => r.table_name) ?? []
      console.log('   Existing cinemesh tables:', tables.length ? tables.join(', ') : '(none)')

      if (tables.includes('rooms') && tables.includes('participants')) {
        console.log('\n✅  Migration already applied. Nothing to do.')
        return
      }
    }

    // ── Step 2: Run migration ──────────────────────────────────────────────
    console.log('\n② Running cinemesh migration…')
    const migResult = await runSQL(MIGRATION_SQL, 'migration', SERVICE_ROLE)
    if (migResult.ok) {
      console.log('✅  Migration complete!\n')
      printSuccess()
    } else {
      console.error('❌  Migration failed via Management API:', migResult.data)
      await tryRPCFallback()
    }
    return
  }

  // ── Management API rejected service role — try RPC fallback ─────────────
  console.log(`   ℹ  Management API returned ${schemaCheck.status} (needs PAT — expected)`)
  await tryRPCFallback()
}

async function tryRPCFallback() {
  console.log('\n② Trying RPC exec_sql endpoint (service role)…')
  const result = await runSQLviaRPC(CHECK_SCHEMAS_SQL)
  if (result.ok) {
    console.log('✅  RPC endpoint accepted service role')
    const migResult = await runSQLviaRPC(MIGRATION_SQL)
    if (migResult.ok) {
      console.log('✅  Migration complete!\n')
      printSuccess()
      return
    }
  }
  console.log('   ℹ  RPC endpoint not available (function not yet created)\n')
  printManualInstructions()
}

function printSuccess() {
  console.log('━'.repeat(50))
  console.log('🎬  CineMesh schema is ready.')
  console.log('   Schema:     cinemesh')
  console.log('   Tables:     cinemesh.rooms, cinemesh.participants')
  console.log('   Realtime:   enabled on rooms + participants')
  console.log('   RLS:        enabled with anon-safe policies')
  console.log('\nNext: npm run dev  →  http://localhost:3000')
}

function printManualInstructions() {
  console.log('━'.repeat(50))
  console.log('📋  MANUAL STEP REQUIRED (< 60 seconds)')
  console.log('━'.repeat(50))
  console.log('\n1. Open: https://supabase.com/dashboard/project/rfbkstlbyvplnqciwujm/sql/new')
  console.log('2. Paste the contents of:  scripts/cinemesh-migration.sql')
  console.log('3. Click "Run"\n')
  console.log('The file is at: scripts/cinemesh-migration.sql')
  console.log('━'.repeat(50))
  process.exit(1)
}

main().catch(err => {
  console.error('Fatal:', err)
  printManualInstructions()
})
