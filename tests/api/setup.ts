// Shared test environment for API tests.
// Runs before every test file — sets deterministic env before any server util is imported.

process.env.NODE_ENV = 'test'
// Host-side access to the dockerised PostgreSQL (5433 is the host mapping, see docker-compose.yml)
process.env.DATABASE_URL = 'postgresql://tawasul:tawasul_pass@localhost:5433/tawasul_db'
process.env.JWT_SECRET = 'test-jwt-secret-tawasul-academy-2024-must-be-32-chars'
process.env.JWT_EXPIRES_IN = '7d'
process.env.APP_URL = 'http://localhost:3000'
// Emails are skipped when RESEND_API_KEY is empty (see server/utils/email.ts)
process.env.RESEND_API_KEY = ''
process.env.RESEND_FROM_EMAIL = ''
process.env.RESEND_FROM_NAME = 'Tawasul Academy'