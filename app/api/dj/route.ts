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
    
    // Get current time in your timezone (Europe/Amsterdam)
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
    
    // Get current day
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[localTime.getDay()];
    
    // Weekend check
    if (currentDay === 'saturday' || currentDay === 'sunday') {
      return NextResponse.json({ dj: null, message: 'No schedule on weekends' });
    }
    
    // Get current time in minutes
    const currentMinutes = localTime.getHours() * 60 + localTime.getMinutes();
    
    // Get day schedule directly (no week wrapper)
    const daySchedule = schedule[currentDay];
    
    if (!daySchedule) {
      return NextResponse.json({ dj: null, message: 'No schedule for today' });
    }
    
    // Check each time slot
    for (const [timeSlot, djs] of Object.entries(daySchedule)) {
      // Skip the date field
      if (timeSlot === 'date') continue;
      
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
          day: currentDay,
          localTime: localTime.toLocaleTimeString('en-US', { timeZone: 'Europe/Amsterdam', hour12: false })
        });
      }
    }
    
    // Outside broadcast hours
    return NextResponse.json({ 
      dj: null,
      message: 'No DJ scheduled at this time',
      localTime: localTime.toLocaleTimeString('en-US', { timeZone: 'Europe/Amsterdam', hour12: false })
    });
    
  } catch (error) {
    console.error('Error reading schedule:', error);
    return NextResponse.json({ 
      dj: null, 
      error: 'Failed to read schedule' 
    }, { status: 500 });
  }
}