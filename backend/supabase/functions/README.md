# ForgeTrack — Supabase Edge Functions

This directory contains [Supabase Edge Functions](https://supabase.com/docs/guides/functions) for the ForgeTrack platform.
Edge Functions run on Deno at the edge (Supabase's global infrastructure) and are invoked via HTTP.

---

## Functions

### `mark-attendance`
**POST** `/functions/v1/mark-attendance`

Marks attendance for a list of students in a given session. Only accessible by authenticated mentor users.

**Request Body:**
```json
{
  "session_id": 12,
  "records": [
    { "student_id": 1, "present": true },
    { "student_id": 2, "present": false }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "session": { "id": 12, "date": "2025-10-08", "topic": "Arrays & Sorting" },
  "summary": { "total": 2, "present": 1, "absent": 1 },
  "records": [ ... ]
}
```

---

### `get-attendance-summary`
**GET** `/functions/v1/get-attendance-summary`

Returns a student's full attendance summary — session-by-session records, present/absent counts, and overall percentage.

- **Students** automatically get their own data (enforced by RLS)
- **Mentors** must pass `?student_id=<id>` query param

**Response:**
```json
{
  "success": true,
  "student": { "id": 1, "name": "Alice", "usn": "1RN22IS001" },
  "summary": {
    "total_sessions": 24,
    "marked_sessions": 24,
    "present": 20,
    "absent": 4,
    "attendance_percentage": 83
  },
  "sessions": [ ... ]
}
```

---

## Deployment

```bash
# Install Supabase CLI first
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref dpkeqgspqraujnxrvtin

# Deploy all functions
supabase functions deploy mark-attendance
supabase functions deploy get-attendance-summary
```

## Local Development

```bash
# Start local Supabase + functions runtime
supabase start
supabase functions serve
```

---

## Security

- All functions require a valid Supabase JWT (`Authorization: Bearer <token>`)
- Role checks are performed inside each function
- Supabase **Row Level Security (RLS)** is enforced at the database level as a second layer
- CORS headers are configured to allow browser clients
