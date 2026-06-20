import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { toClientEntry } from '@/lib/daily-progress';

export const runtime = 'nodejs';

function toDbPayload(entry) {
  return {
    student_id: Number(entry.studentId),
    progress_date: entry.progressDate,
    attendance: Boolean(entry.attendance),
    ayats_learned: Number(entry.ayatsLearned) || 0,
    new_dars_practice: Boolean(entry.newDarsPractice),
    juz_dars_practice: Boolean(entry.juzDarsPractice),
    old_dars_practice: Boolean(entry.oldDarsPractice),
    current_juz: entry.currentJuz === '' || entry.currentJuz === null || entry.currentJuz === undefined
      ? null
      : Number(entry.currentJuz),
    target_lines: entry.targetLines === '' || entry.targetLines === null || entry.targetLines === undefined
      ? null
      : Number(entry.targetLines),
    achieved_lines: entry.achievedLines === '' || entry.achievedLines === null || entry.achievedLines === undefined
      ? null
      : Number(entry.achievedLines),
    performance: entry.performance ? String(entry.performance) : null,
    notes: entry.notes ? String(entry.notes).trim() : null,
    updated_at: new Date().toISOString()
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const studentId = searchParams.get('studentId');
  const phone = searchParams.get('phone');

  if (!supabaseAdmin) {
    return NextResponse.json({ entries: [] });
  }

  let query = supabaseAdmin.from('daily_progress').select('*');

  if (date) query = query.eq('progress_date', date);
  if (from) query = query.gte('progress_date', from);
  if (to) query = query.lte('progress_date', to);
  if (studentId) query = query.eq('student_id', Number(studentId));

  if (phone) {
    const normalizedPhone = String(phone).replace(/\D/g, '');
    const { data: matchedStudents, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, phone')
      .not('phone', 'is', null);

    if (studentError) {
      return NextResponse.json({ error: studentError.message }, { status: 500 });
    }

    const studentIds = (matchedStudents || [])
      .filter((student) => String(student.phone || '').replace(/\D/g, '').includes(normalizedPhone))
      .map((student) => student.id);

    if (!studentIds.length) {
      return NextResponse.json({ entries: [] });
    }

    query = query.in('student_id', studentIds);
  }

  const { data, error } = await query.order('progress_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: (data || []).map(toClientEntry) });
}

export async function POST(request) {
  const body = await request.json();
  const entries = Array.isArray(body.entries) ? body.entries : [];

  if (!entries.length) {
    return NextResponse.json({ error: 'No entries provided.' }, { status: 400 });
  }

  const payload = entries.map((entry) => {
    if (!entry.studentId || !entry.progressDate) {
      throw new Error('Each entry requires studentId and progressDate.');
    }

    const computed = {
      ...entry,
      performance: entry.performance || null
    };

    return toDbPayload(computed);
  }).map((row) => {
    if (!row.performance) {
      const checks = [row.new_dars_practice, row.juz_dars_practice, row.old_dars_practice];
      const doneCount = checks.filter(Boolean).length;
      const ayats = row.ayats_learned || 0;
      if (!row.attendance) row.performance = 'fail';
      else if (doneCount === 3 && ayats >= 5) row.performance = 'excellent';
      else if (doneCount >= 2 && ayats >= 3) row.performance = 'very_good';
      else if (doneCount >= 2 || ayats >= 2) row.performance = 'good';
      else if (doneCount >= 1 || ayats >= 1) row.performance = 'average';
      else row.performance = 'fail';
    }
    return row;
  });

  if (!supabaseAdmin) {
    return NextResponse.json({ ok: true, entries: entries.map((entry, index) => ({ ...entry, id: Date.now() + index })) });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('daily_progress')
      .upsert(payload, { onConflict: 'student_id,progress_date' })
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, entries: (data || []).map(toClientEntry) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
