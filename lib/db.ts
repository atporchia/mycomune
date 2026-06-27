import postgres from 'postgres'

// Connection is established lazily on first query, not at import time.
// DATABASE_URL must be set in production; build-time evaluation won't connect.
const sql = postgres(process.env.DATABASE_URL ?? 'postgres://localhost/placeholder', {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
})

export default sql
