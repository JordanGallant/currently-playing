// app/api/current-dj/route.ts
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    // Read the JSON file from public directory
    const filePath = path.join(process.cwd(), 'public', 'dj.json');
    const fileContents = await readFile(filePath, 'utf8');
    const schedule = JSON.parse(fileContents);
    
    // Get current time in Europe/Amsterdam timezone using Intl API
    const now = new Date();
    
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';
    
    const day = parseInt(getValue('day'));
    const month = parseInt(getValue('month'));
    const hour = parseInt(getValue('hour'));
    const minute = parseInt(getValue('minute'));
    
    // Create a proper date object for Amsterdam timezone
    const year = parseInt(getValue('year'));
    const amsterdamDate = new Date(year, month - 1, day, hour, minute);
    
    // Get current day name
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[amsterdamDate.getDay()];
    
    // Get current date in DD/MM format
    const currentDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
    
    // Get current time in minutes since midnight
    const currentMinutes = hour * 60 + minute;
    
    // Get day schedule
    const daySchedule = schedule[currentDay];
    
    if (!daySchedule) {
      const response = NextResponse.json({ 
        dj: null,
        message: 'No schedule for today',
        currentTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        currentDay: currentDay,
        currentDate: currentDate
      });
      
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      
      return response;
    }
    
    // Check each time slot
    for (const [timeSlot, djs] of Object.entries(daySchedule)) {
      if (timeSlot === 'date') continue;
      
      const [start, end] = timeSlot.split('-');
      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);
      
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;
      
      if (currentMinutes >= startTime && currentMinutes < endTime) {
        const response = NextResponse.json({ 
          dj: djs,
          timeSlot: timeSlot,
          day: currentDay,
          date: daySchedule.date,
          currentTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
          currentDate: currentDate
        });
        
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        
        return response;
      }
    }
    
    // Outside broadcast hours
    const response = NextResponse.json({ 
      dj: null,
      message: 'No DJ scheduled at this time',
      currentTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      currentDay: currentDay,
      currentDate: currentDate
    });
    
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return response;
    
  } catch (error) {
    console.error('Error reading schedule:', error);
    const errorResponse = NextResponse.json({ 
      dj: null, 
      error: 'Failed to read schedule',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
    
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return errorResponse;
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return resp
