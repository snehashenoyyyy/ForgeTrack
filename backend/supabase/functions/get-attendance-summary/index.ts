// Supabase Edge Function: get-attendance-summary
// Returns a student's full attendance summary: per-session records,
// overall percentage, present/absent counts, and session details.
// Deploy with: supabase functions deploy get-attendance-summary

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with caller's JWT — RLS will restrict data access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile and student_id
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("role, student_id")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which student_id to query
    // Mentors can query any student (pass ?student_id=X), students only see themselves
    const url = new URL(req.url);
    let targetStudentId: number;

    if (userProfile.role === "mentor") {
      const queryStudentId = url.searchParams.get("student_id");
      if (!queryStudentId) {
        return new Response(
          JSON.stringify({ error: "Mentors must provide ?student_id=<id>" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      targetStudentId = parseInt(queryStudentId, 10);
    } else {
      // Student: use their own linked student_id
      if (!userProfile.student_id) {
        return new Response(
          JSON.stringify({ error: "No student profile linked to this account" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      targetStudentId = userProfile.student_id;
    }

    // Fetch student profile
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, usn, branch_code, batch")
      .eq("id", targetStudentId)
      .single();

    if (studentError || !student) {
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, date, topic, month_number, duration_hours, session_type")
      .order("date", { ascending: true });

    if (sessionsError) {
      return new Response(JSON.stringify({ error: sessionsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch this student's attendance records (RLS ensures students only see their own)
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from("attendance")
      .select("session_id, present, marked_at, marked_by")
      .eq("student_id", targetStudentId);

    if (attendanceError) {
      return new Response(JSON.stringify({ error: attendanceError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a lookup map: session_id → attendance record
    const attendanceMap = new Map(
      (attendanceRecords ?? []).map((r) => [r.session_id, r])
    );

    // Merge sessions with attendance
    const sessionSummary = (sessions ?? []).map((session) => {
      const record = attendanceMap.get(session.id);
      return {
        session_id: session.id,
        date: session.date,
        topic: session.topic,
        month_number: session.month_number,
        duration_hours: session.duration_hours,
        session_type: session.session_type,
        present: record?.present ?? null,     // null = not yet marked
        marked_at: record?.marked_at ?? null,
        marked_by: record?.marked_by ?? null,
      };
    });

    // Calculate statistics
    const totalSessions = sessions?.length ?? 0;
    const markedSessions = sessionSummary.filter((s) => s.present !== null);
    const presentCount = markedSessions.filter((s) => s.present === true).length;
    const absentCount = markedSessions.filter((s) => s.present === false).length;
    const attendancePercentage =
      markedSessions.length > 0
        ? Math.round((presentCount / markedSessions.length) * 100)
        : 0;

    return new Response(
      JSON.stringify({
        success: true,
        student,
        summary: {
          total_sessions: totalSessions,
          marked_sessions: markedSessions.length,
          present: presentCount,
          absent: absentCount,
          attendance_percentage: attendancePercentage,
        },
        sessions: sessionSummary,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
