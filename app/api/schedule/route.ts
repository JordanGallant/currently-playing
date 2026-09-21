// app/api/schedule/route.ts
// The current week's line-up, flattened to { day: { date, "HH:MM-HH:MM": [...] } }.
// Every value besides `date` is an array of strings, so a client can iterate the
// day object blindly and still render it.
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

type DaySchedule = {
  supervision?: Record<string, string>;
  slots: Record<string, string[]>;
};

type Schedule = {
  anchorMonday: string;
  weeks: Record<string, Record<string, DaySchedule>>;
};

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function withCors<T extends NextResponse>(response: T): T {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'dj.json');
    const schedule: Schedule = JSON.parse(await readFile(filePath, 'utf8'));

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';

    // A UTC instant standing for the Amsterdam calendar date.
    const today = Date.UTC(
      parseInt(getValue('year')),
      parseInt(getValue('month')) - 1,
      parseInt(getValue('day'))
    );

    const weekNames = Object.keys(schedule.weeks);
    const [ay, am, ad] = schedule.anchorMonday.split('-').map(Number);
    const anchor = Date.UTC(ay, am - 1, ad);
    const weeksSinceAnchor = Math.floor((today - anchor) / (7 * MS_PER_DAY));
    const week = weekNames[((weeksSinceAnchor % weekNames.length) + weekNames.length) % weekNames.length];

    // Monday of the week `today` falls in, so each day gets its real calendar date.
    const monday = today - (((new Date(today).getUTCDay() + 6) % 7) * MS_PER_DAY);

    const days: Record<string, Record<string, string[] | string>> = {};

    for (const [dayName, daySchedule] of Object.entries(schedule.weeks[week] || {})) {
      const offset = (DAYS.indexOf(dayName) + 6) % 7; // monday = 0
      const dayDate = new Date(monday + offset * MS_PER_DAY);

      days[dayName] = {
        date: `${String(dayDate.getUTCDate()).padStart(2, '0')}/${String(dayDate.getUTCMonth() + 1).padStart(2, '0')}`,
        ...daySchedule.slots
      };
    }

    return withCors(NextResponse.json({ week, anchorMonday: schedule.anchorMonday, ...days }));

  } catch (error) {
    return withCors(NextResponse.json({
      error: 'Failed to read schedule',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 200 }));
}
