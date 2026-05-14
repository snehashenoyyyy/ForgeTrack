// Supabase Edge Function: mark-attendance
// Marks attendance for a list of students in a given session.
// Deploy with: supabase functions deploy mark-attendance

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AttendanceRecord {
  student_id: number;
  present: boolean;
}

interface RequestBody {
  session_id: number;
  records: AttendanceRecord[];
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== "POST") {
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

    // Create Supabase client with the caller's JWT so RLS is enforced
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify caller is a mentor
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

    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userProfile?.role !== "mentor") {
      return new Response(
        JSON.stringify({ error: "Only mentors can mark attendance" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { session_id, records } = body;

    if (!session_id || !Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: "session_id and records[] are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the session exists
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, date, topic")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert attendance records (insert or update on conflict)
    const attendanceRows = records.map((r) => ({
      student_id: r.student_id,
      session_id: session_id,
      present: r.present,
      marked_by: user.email ?? "mentor",
      marked_at: new Date().toISOString(),
    }));

    const { data: upserted, error: upsertError } = await supabase
      .from("attendance")
      .upsert(attendanceRows, { onConflict: "student_id,session_id" })
      .select();

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const presentCount = records.filter((r) => r.present).length;
    const absentCount = records.length - presentCount;

    return new Response(
      JSON.stringify({
        success: true,
        session: { id: session.id, date: session.date, topic: session.topic },
        summary: {
          total: records.length,
          present: presentCount,
          absent: absentCount,
        },
        records: upserted,
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
