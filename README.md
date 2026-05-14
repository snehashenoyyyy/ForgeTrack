<div align="center">

# 🔥 ForgeTrack

### Intelligent Attendance & Academic Tracking Platform

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-forge--track--five.vercel.app-4f46e5?style=for-the-badge)](https://forge-track-five.vercel.app)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=for-the-badge&logo=vercel)](https://forge-track-five.vercel.app)

**ForgeTrack is a full-stack, AI-augmented academic management platform that eliminates the friction of manual attendance tracking — built for mentors and students of The Boring People internship program.**

</div>

---

## 🌐 Live Deployment

> **🔗 [https://forge-track-five.vercel.app](https://forge-track-five.vercel.app)**

The frontend is compiled via Vite and deployed globally on **Vercel's Edge Network** for sub-second delivery. The backend operates on a dedicated **Supabase** instance with a normalized PostgreSQL schema.

---

## 🔐 Demo Access (Test Credentials)

You can log in directly using these credentials to explore the platform:

### 👨‍💼 Mentor Account
| Field | Value |
|-------|-------|
| **URL** | https://forge-track-five.vercel.app |
| **Email** | `nischay@theboringpeople.in` |
| **Password** | `password123` |
| **Access** | Full dashboard, attendance marking, bulk upload, materials, appeals review |

### 🎓 Student Account
| Field | Value |
|-------|-------|
| **URL** | https://forge-track-five.vercel.app |
| **Email** | `<usn>@forge.local` (e.g. `1rn22is001@forge.local`) |
| **Password** | Your USN (e.g. `1RN22IS001`) |
| **Access** | Personal attendance dashboard, heatmap, appeals submission |

> **Note:** Student accounts are auto-created from the `students` table. The email format is `<lowercase-usn>@forge.local` and the default password is the USN itself.

---

## ✨ Features

### 🧑‍🏫 Mentor Portal
- **📊 Command Center Dashboard** — Live analytics: attendance rates, student leaderboard, session stats
- **✅ Mark Attendance** — Per-session manual attendance marking with real-time save
- **📁 AI-Powered Bulk Upload** — Upload raw Excel/CSV files; Gemini AI semantically maps headers to DB schema automatically
- **📚 Materials Management** — Add session-wise study materials and resource links
- **📋 Attendance History** — Full historical view with session-level drill-down
- **⚖️ Review Appeals** — Accept or reject student attendance correction requests

### 🎓 Student Portal
- **🗓️ GitHub-Style Attendance Heatmap** — Full-semester visual attendance calendar
- **📈 Performance Dashboard** — Attendance percentage rings, session counts, rank tracking
- **📝 Submit Appeals** — Request attendance corrections with reason justification
- **📖 View Materials** — Access mentor-uploaded resources per session

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | React 19 + Vite |
| **Styling** | Tailwind CSS v3, Framer Motion |
| **Backend & Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth (email/password) |
| **AI Engine** | Google Gemini API (`@google/generative-ai`) |
| **Data Processing** | PapaParse (CSV), SheetJS/XLSX (Excel) |
| **Charts** | Recharts |
| **Deployment** | Vercel (frontend), Supabase Cloud (backend) |
| **Edge Functions** | Supabase Edge Functions (Deno/TypeScript) |

---

## 🏗️ Project Structure

```
forgetrack/
├── README.md                        ← You are here
├── frontend/                        ← React + Vite application
│   ├── src/
│   │   ├── pages/
│   │   │   ├── mentor/
│   │   │   │   ├── Dashboard.jsx        ← Mentor command center
│   │   │   │   ├── MarkAttendance.jsx   ← Per-session attendance marking
│   │   │   │   ├── BulkUpload.jsx       ← AI-powered CSV/Excel upload
│   │   │   │   ├── History.jsx          ← Attendance history viewer
│   │   │   │   ├── Materials.jsx        ← Study materials management
│   │   │   │   ├── ReviewAppeals.jsx    ← Appeal review system
│   │   │   │   └── CreateAssignment.jsx
│   │   │   ├── student/
│   │   │   │   ├── StudentDashboard.jsx ← Student analytics & heatmap
│   │   │   │   └── AttendanceAppeals.jsx← Appeal submission
│   │   │   └── auth/                   ← Login / signup pages
│   │   ├── components/
│   │   │   ├── layout/                 ← Navbar, sidebar, shell layouts
│   │   │   └── dashboard/              ← Reusable dashboard widgets
│   │   ├── context/                    ← Auth context (role-based routing)
│   │   └── lib/                        ← Supabase client, helpers
│   ├── vercel.json                     ← SPA routing config for Vercel
│   └── package.json
└── backend/
    └── supabase/
        ├── schema.sql                  ← Full database schema + RLS policies
        ├── seed.sql                    ← Mentor seed accounts
        ├── appeals_schema.sql          ← Appeals table schema
        ├── cleanup.sql                 ← Data cleanup utilities
        └── functions/                  ← Supabase Edge Functions (Deno)
            ├── mark-attendance/        ← Edge Function: mark session attendance
            └── get-attendance-summary/ ← Edge Function: fetch student summary
```

---

## 🗄️ Database Schema

The platform uses a **normalized PostgreSQL** schema with **Row Level Security (RLS)** enforced at the database level:

```
students        — Student profiles (USN, name, branch, batch)
sessions        — Class sessions (date, topic, month, duration)
attendance      — Attendance records (student × session, present/absent)
materials       — Session-linked study resources
users           — Auth user profiles (role: mentor | student)
import_log      — Audit log for every bulk upload
```

**Security Model:**
- Mentors have `ALL` access to every table
- Students can only `SELECT` their own attendance and profile
- All policies enforced via Supabase RLS — no client-side trust

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js 18+
- A Supabase project (or use the live instance)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/forgetrack.git
cd forgetrack/frontend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.local.example .env.local
# Fill in your VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GEMINI_API_KEY

# 4. Run the dev server
npm run dev
```

### Database Setup

```bash
# Run these SQL files in order in your Supabase SQL Editor:
# 1. backend/supabase/schema.sql      — creates all tables + RLS
# 2. backend/supabase/appeals_schema.sql — adds appeals table
# 3. backend/supabase/seed.sql        — creates demo mentor accounts
```

---

## 🏛️ Architecture Highlights

- **AI Semantic Mapping** — Gemini API analyzes spreadsheet column headers and maps them to DB fields automatically, handling any format variation
- **Atomic Bulk Import** — "Clean Slate" transaction model: wipes and replaces cohort data to prevent collision and guarantee integrity
- **Dual-Shell RBAC** — Mentor and Student get entirely separate React app shells with dedicated navigation, enforced both client-side and at the database (RLS) level
- **GitHub-Style Heatmap** — Custom algorithm maps class dates (Wed/Thu/Sat schedule) into a full-semester chronological grid
- **Micro-Animations** — Framer Motion powers all layout transitions, hover states, and loading skeletons

---

## 📸 Screenshots

| Mentor Dashboard | Student Dashboard |
|-----------------|------------------|
| Live analytics, session cards, student leaderboard | Attendance heatmap, percentage rings, rank |

| Bulk Upload (AI Mapping) | Mark Attendance |
|--------------------------|-----------------|
| Upload CSV/Excel → AI maps headers → preview → import | Per-session student checklist with real-time save |

---

<div align="center">

Built with ❤️ for **The Boring People** internship program

</div>
