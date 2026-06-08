import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

function toProgressEntry(row) {
  return {
    teacher: row.teacher ?? '',
    examiner: row.examiner ?? '',
    mark: row.mark ?? '',
    notes: row.notes ?? '',
    juz: row.juz_status ?? {}
  };
}

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client is not configured.' }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin.from('student_progress').select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const progress = {};
  for (const row of data || []) {
    progress[String(row.student_id)] = toProgressEntry(row);
  }

  return NextResponse.json({ progress });
}

export async function PUT(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client is not configured.' }, { status: 500 });
  }

  const body = await request.json();
  const studentId = Number(body.studentId);

  if (!Number.isFinite(studentId)) {
    return NextResponse.json({ error: 'Invalid student id.' }, { status: 400 });
  }

  const payload = {
    student_id: studentId,
    teacher: String(body.teacher || '').trim() || null,
    examiner: String(body.examiner || '').trim() || null,
    mark: body.mark === '' || body.mark === null || body.mark === undefined ? null : Number(body.mark),
    notes: String(body.notes || '').trim() || null,
    juz_status: body.juz || {}
  };

  const { error } = await supabaseAdmin.from('student_progress').upsert(payload, { onConflict: 'student_id' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}