import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

function toStudent(row) {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    age: row.age ?? '',
    className: row.class_name ?? '',
    course: row.course,
    teacher: row.teacher ?? '',
    phone: row.phone ?? '',
    notes: row.notes ?? '',
    enrolledAt: row.enrolled_at ?? '',
    status: row.status ?? 'Active'
  };
}

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client is not configured.' }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin.from('students').select('*').order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ students: (data || []).map(toStudent) });
}

export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client is not configured.' }, { status: 500 });
  }

  const body = await request.json();
  const payload = {
    name: String(body.name || '').trim(),
    gender: String(body.gender || '').trim(),
    age: body.age ? Number(body.age) : null,
    class_name: String(body.className || '').trim() || null,
    course: String(body.course || '').trim(),
    teacher: String(body.teacher || '').trim() || null,
    phone: String(body.phone || '').trim() || null,
    notes: String(body.notes || '').trim() || null,
    status: String(body.status || 'Active').trim(),
    enrolled_at: String(body.enrolledAt || '').trim() || new Date().toISOString().split('T')[0]
  };

  const { data, error } = await supabaseAdmin.from('students').insert(payload).select('*').single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ student: toStudent(data) }, { status: 201 });
}