import { NextResponse } from 'next/server';
import { sqlite } from '@/db';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    sqlite.prepare('SELECT 1').get();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
