// app/api/current-dj/route.ts
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    // Read the JSON file
    const filePath = path.join(process.cwd(), 'public', 'dj.json');
    const fileContents = await readFile(filePath, 'utf8');
    const schedule = JSON.parse(fileContents);
    
    const now = new Date();
    
    // Get current day
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[now.getDay()];
    
    // Weekend check
    if (currentDay === 'saturday' || currentDay === 'sunday') {
      return NextResponse.json({ dj: null, message: 'No schedule on weekends' });
    }
    
    // Get current time in minutes
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Get day schedule directly (no week wrapper)
    const daySchedule = schedule[currentDay];
    
    if (!daySchedule) {
      return NextResponse.json({ dj: null, message: 'No schedule for today' });
    }
    
    // Check each time slot
    for (const [timeSlot, djs] of Object.entries(daySchedule)) {
      const [start, end] = timeSlot.split('-');
      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);
      
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;
      
      if (currentMinutes >= startTime && currentMinutes < endTime) {
        const djList = djs as string[];
        return NextResponse.json({ 
          dj: djList.length > 0 ? djList : null,
          timeSlot: timeSlot,
          day: currentDay
        });
      }
    }
    
    // Outside broadcast hours
    return NextResponse.json({ 
      dj: null,
      message: 'No DJ scheduled at this time'
    });
    
  } catch (error) {
    console.error('Error reading schedule:', error);
    return NextResponse.json({ 
      dj: null, 
      error: 'Failed to read schedule' 
    }, { status: 500 });
  }
}