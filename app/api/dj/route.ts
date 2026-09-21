// app/api/dj/route.ts
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

type DaySchedule = {
  supervision?: Record<string, string>;
  slots: Record<string, string[]>;
};

type Schedule = {
  anchorMonday: string;
  arriveEarlyMinutes?: number;
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

function toMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function findSlot(slots: Record<string, string[]>, currentMinutes: number) {
  for (const [timeSlot, djs] of Object.entries(slots)) {
    const [start, end] = timeSlot.split('-');
    if (currentMinutes >= toMinutes(start) && currentMinutes < toMinutes(end)) {
      return { timeSlot, djs };
    }
  }
  return null;
}

// Which half of the two-week cycle today falls in, counted in whole weeks
// from the anchor Monday. Week keys are used in the order they appear in the file.
function weekName(schedule: Schedule, today: Date) {
  const names = Object.keys(schedule.weeks);
  const [year, month, day] = schedule.anchorMonday.split('-').map(Number);
  const anchor = Date.UTC(year, month - 1, day);
  const weeksSinceAnchor = Math.floor((today.getTime() - anchor) / (7 * MS_PER_DAY));
  const index = ((weeksSinceAnchor % names.length) + names.length) % names.length;
  return names[index];
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'dj.json');
    const fileContents = await readFile(filePath, 'utf8');
    const schedule: Schedule = JSON.parse(fileContents);

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(new Date());
    const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';

    const day = parseInt(getValue('day'));
    const month = parseInt(getValue('month'));
    const year = parseInt(getValue('year'));
    // 'en-US' with hour12: false renders midnight as hour 24, so wrap it back to 0.
    const hour = parseInt(getValue('hour')) % 24;
    const minute = parseInt(getValue('minute'));

    // A UTC instant standing for the Amsterdam calendar date, so the weekday and
    // the week count are unaffected by the server's own timezone.
    const amsterdamDate = new Date(Date.UTC(year, month - 1, day));
    const currentDay = DAYS[amsterdamDate.getUTCDay()];
    const currentDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
    const currentMinutes = hour * 60 + minute;
    const currentTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const week = weekName(schedule, amsterdamDate);

    const daySchedule = schedule.weeks[week]?.[currentDay];

    if (!daySchedule) {
      return withCors(NextResponse.json({
        dj: null,
        message: 'No schedule for today',
        week,
        currentTime,
        currentDay,
        currentDate
      }));
    }

    const slot = findSlot(daySchedule.slots, currentMinutes);

    if (!slot) {
      return withCors(NextResponse.json({
        dj: null,
        message: 'No DJ scheduled at this time',
        week,
        currentTime,
        currentDay,
        currentDate
      }));
    }

    const supervisionBlock = Object.entries(daySchedule.supervision || {})
      .find(([block]) => {
        const [start, end] = block.split('-');
        return currentMinutes >= toMinutes(start) && currentMinutes < toMinutes(end);
      });

    return withCors(NextResponse.json({
      dj: slot.djs,
      timeSlot: slot.timeSlot,
      day: currentDay,
      date: currentDate,
      week,
      supervisor: supervisionBlock?.[1] ?? null,
      supervisionBlock: supervisionBlock?.[0] ?? null,
      arriveEarlyMinutes: schedule.arriveEarlyMinutes ?? null,
      currentTime,
      currentDate
    }));

  } catch (error) {
    return withCors(NextResponse.json({
      dj: null,
      error: 'Failed to read schedule',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 200 }));
}
