import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We use the service role key here to bypass RLS and ensure logs are ALWAYS written,
// even if the user is unauthenticated or has a broken session.
export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl) {
      return NextResponse.json({ error: 'Supabase URL is missing' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const body = await request.json();
    const { level, message, metadata } = body;

    if (!level || !message) {
      return NextResponse.json({ error: 'Missing level or message' }, { status: 400 });
    }

    // Insert into system_logs
    const { error } = await supabaseAdmin
      .from('system_logs')
      .insert({
        level,
        message,
        metadata: metadata || {}
      });

    if (error) {
      console.error("Failed to write to system_logs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Crash in /api/logs:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
