
import { ScheduleEntry } from './types';
import { ITALIAN_MONTHS } from './constants';

export const parseTimetableHtml = (htmlString: string, index: number): ScheduleEntry[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  // Extract course title from h1 - Handle both Italian and English standard university prefixes
  const h1 = doc.querySelector('h1');
  let courseName = h1?.textContent || "";
  courseName = courseName
    .replace('Orario delle lezioni di', '')
    .replace('Lesson schedule for', '')
    .split('(')[0]
    .trim() || `Course ${index + 1}`;

  const table = doc.getElementById('elenco');
  if (!table) return [];

  const rows = table.querySelectorAll('tbody tr');
  const entries: ScheduleEntry[] = [];

  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return;

    let dateCell = cells[0];
    let timeCell = cells[1];
    let locationCell = cells[2];

    const dateText = dateCell.textContent?.trim() || "";
    // Skip sub-rows or invalid date headers
    if (!dateText.includes('202')) return;

    const cleanDateText = dateText.replace(/\s+/g, ' ').replace(',', '');
    const parts = cleanDateText.split(' ');
    
    // Format: [DayName] [DayNumber] [MonthName] [Year]
    // Example: lunedì 16 febbraio 2026
    const dayNumber = parseInt(parts[1]);
    const monthName = parts[2]?.toLowerCase();
    const year = parseInt(parts[3]);

    const timeText = timeCell?.textContent?.trim() || "";
    const timeParts = timeText.split('-').map(t => t.trim());
    const startTime = timeParts[0];
    const endTime = timeParts[1];

    const location = locationCell?.textContent?.trim().replace(/\s+/g, ' ') || "N/A";

    if (!isNaN(dayNumber) && monthName && !isNaN(year) && startTime) {
      // Map Italian month name to index for Date object
      const monthIndex = ITALIAN_MONTHS[monthName] ?? 0;
      const fullDate = new Date(year, monthIndex, dayNumber);
      
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

      // We store the original day name for reference but will use Date methods for localized display
      const dayName = parts[0];

      entries.push({
        id: `course-${index}-row-${rowIndex}`,
        courseName,
        colorIndex: index,
        dayName, 
        dayNumber,
        month: monthName,
        year,
        startTime,
        endTime,
        location,
        fullDate,
        durationMinutes
      });
    }
  });

  return entries;
};
