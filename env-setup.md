# Environment Variables Setup for Day 3

## Supabase Configuration

Create a `.env.local` file in your project root with the following variables:

```bash
# Supabase Project Settings
NEXT_PUBLIC_SUPABASE_URL=https://fbagqeycdltdgvfiygqf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiYWdxZXljZGx0ZGd2Zml5Z3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MDkzMTMsImV4cCI6MjA3Njk4NTMxM30.AKoJjv2BNm9SjBUfYN_7QolPLbrk8nmu10igpqhk2fM
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiYWdxZXljZGx0ZGd2Zml5Z3FmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQwOTMxMywiZXhwIjoyMDc2OTg1MzEzfQ.yR1f9FUdgrrvXZCTjX4aTjfBf7LHxcvgTjaLxv_8sYc


# Supabase Database
DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.fbagqeycdltdgvfiygqf.supabase.co:5432/postgres

# Vendure Configuration (will be set up in Day 4)
VENDURE_API_URL=http://localhost:3000/graphql
VENDURE_ADMIN_API_URL=http://localhost:3000/admin-api
VENDURE_API_KEY=your_vendure_api_key

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_APP_DOMAIN=azima.store

# Stripe Configuration (for SaaS billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email Configuration
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@azima.store

# Redis Configuration (for Vendure)
REDIS_URL=redis://localhost:6379

# File Upload Configuration
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp,image/gif,image/svg+xml

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
```

## How to Get Supabase Values

1. **Project URL**: Go to Settings > API > Project URL
2. **Anon Key**: Go to Settings > API > Project API keys > anon public
3. **Service Role Key**: Go to Settings > API > Project API keys > service_role secret
4. **Database URL**: Go to Settings > Database > Connection string > URI
