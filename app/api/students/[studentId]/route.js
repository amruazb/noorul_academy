import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function DELETE(_request, { params }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client is not configured.' }, { status: 500 });
  }

  const studentId = Number(params.studentId);
  if (!Number.isFinite(studentId)) {
    return NextResponse.json({ error: 'Invalid student id.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('students').delete().eq('id', studentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}