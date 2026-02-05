
export interface ScheduleEntry {
  id: string;
  courseName: string;
  colorIndex: number;
  dayName: string;
  dayNumber: number;
  month: string;
  year: number;
  startTime: string;
  endTime: string;
  location: string;
  fullDate: Date;
  durationMinutes: number;
}

export interface CourseStats {
  totalHours: number;
  lectureCount: number;
  courseBreakdown: { name: string; hours: number; color: string }[];
  monthDistribution: Record<string, number>;
}
