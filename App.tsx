
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ScheduleEntry, CourseStats } from './types';
import { parseTimetableHtml } from './parser';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const COURSE_COLORS = [
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', hex: '#4F46E5' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', hex: '#10B981' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', hex: '#F43F5E' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', hex: '#F59E0B' },
  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', hex: '#8B5CF6' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', hex: '#06B6D4' },
];

const App: React.FC = () => {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'calendar' | 'list' | 'analytics' | 'import'>('import');
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('unitime_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Revive Dates
        const revived = parsed.map((e: any) => ({
          ...e,
          fullDate: new Date(e.fullDate)
        }));
        setSchedule(revived);
        setActiveTab('calendar');
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (schedule.length > 0) {
      localStorage.setItem('unitime_data', JSON.stringify(schedule));
    } else {
      localStorage.removeItem('unitime_data');
    }
  }, [schedule]);

  const handleFiles = useCallback(async (files: FileList) => {
    const newEntries: ScheduleEntry[] = [];
    const currentCourseNames = new Set(schedule.map(s => s.courseName));
    let nextIndex = currentCourseNames.size;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'text/html' && !file.name.endsWith('.html')) continue;

      const text = await file.text();
      const parsed = parseTimetableHtml(text, nextIndex + i);
      newEntries.push(...parsed);
    }

    if (newEntries.length > 0) {
      const combined = [...schedule, ...newEntries].sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
      setSchedule(combined);
      setActiveTab('calendar');
    }
  }, [schedule]);

  const clearData = () => {
    if (window.confirm("Are you sure you want to clear all loaded schedule data?")) {
      setSchedule([]);
      setActiveTab('import');
    }
  };

  const removeCourse = (name: string) => {
    setSchedule(prev => prev.filter(s => s.courseName !== name));
  };

  const weeks = useMemo(() => {
    if (schedule.length === 0) return [];
    const grouped: Record<string, ScheduleEntry[]> = {};
    
    schedule.forEach(entry => {
      const d = new Date(entry.fullDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      const key = monday.getTime();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(entry);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([timestamp, entries]) => ({
        timestamp: Number(timestamp),
        date: new Date(Number(timestamp)),
        entries
      }));
  }, [schedule]);

  const stats = useMemo((): CourseStats => {
    const totalMinutes = schedule.reduce((acc, curr) => acc + curr.durationMinutes, 0);
    const monthDistribution: Record<string, number> = {};
    const breakdown: Record<string, { mins: number, index: number }> = {};

    schedule.forEach(entry => { 
      const monthLabel = entry.fullDate.toLocaleDateString('en-US', { month: 'long' });
      monthDistribution[monthLabel] = (monthDistribution[monthLabel] || 0) + 1;
      
      if (!breakdown[entry.courseName]) {
        breakdown[entry.courseName] = { mins: 0, index: entry.colorIndex };
      }
      breakdown[entry.courseName].mins += entry.durationMinutes;
    });

    return {
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      lectureCount: schedule.length,
      monthDistribution,
      courseBreakdown: Object.entries(breakdown).map(([name, data]) => ({
        name,
        hours: Math.round((data.mins / 60) * 10) / 10,
        color: COURSE_COLORS[data.index % COURSE_COLORS.length].hex
      }))
    };
  }, [schedule]);

  const courseLegend = useMemo(() => {
    const unique = Array.from(new Set(schedule.map(s => s.courseName)));
    return unique.map(name => {
      const entry = schedule.find(s => s.courseName === name);
      return { name, color: COURSE_COLORS[(entry?.colorIndex || 0) % COURSE_COLORS.length] };
    });
  }, [schedule]);

  const timeRange = Array.from({ length: 13 }, (_, i) => i + 8);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveTab('import')}>
            <div className="w-11 h-11 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-200 transform hover:rotate-6 transition-transform">
              <i className="fa-solid fa-calendar-check text-xl"></i>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-extrabold text-slate-900 text-lg tracking-tight">UniTime</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Unified Academic Calendar</p>
            </div>
          </div>

          {schedule.length > 0 && (
            <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200 shadow-inner">
              {(['calendar', 'list', 'analytics', 'import'] as const).map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-md scale-105' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {tab === 'import' ? <i className="fa-solid fa-plus mr-1"></i> : null}
                  {tab}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
             <button 
               onClick={clearData} 
               title="Clear All Data"
               className="w-10 h-10 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center"
             >
               <i className="fa-solid fa-trash-can"></i>
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10">
        {(activeTab === 'import' || schedule.length === 0) ? (
          <div className="max-w-3xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Create your perfect schedule.</h2>
              <p className="text-slate-500 font-medium">Drag and drop the HTML files exported from the University portal to generate a unified view of all your courses.</p>
            </div>

            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
              className={`relative border-2 border-dashed rounded-[3rem] p-16 text-center transition-all group ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-slate-200 hover:border-slate-300 bg-white shadow-xl shadow-slate-100'}`}
            >
              <input 
                type="file" 
                multiple 
                accept=".html" 
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="space-y-6">
                <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-3xl transition-all ${isDragging ? 'bg-indigo-500 text-white animate-bounce' : 'bg-slate-50 text-slate-400 group-hover:scale-110 group-hover:text-slate-600'}`}>
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800">Choose HTML files or drop them here</p>
                  <p className="text-sm text-slate-400 mt-2 italic font-medium">You can upload multiple course schedules at once</p>
                </div>
                <div className="flex justify-center gap-4">
                  <div className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-slate-200">Select Files</div>
                </div>
              </div>
            </div>

            {schedule.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">Currently Loaded Courses</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {courseLegend.map(course => (
                    <div key={course.name} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: course.color.hex }}></div>
                        <span className="text-sm font-bold text-slate-700 truncate">{course.name}</span>
                      </div>
                      <button 
                        onClick={() => removeCourse(course.name)} 
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all"
                        title="Remove Course"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-col md:flex-row gap-6 items-center justify-between animate-in fade-in duration-500">
               <div className="flex flex-wrap gap-2">
                 {courseLegend.map(c => (
                   <div key={c.name} className="px-3 py-1.5 rounded-full border border-slate-200 bg-white flex items-center gap-2 shadow-sm">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color.hex }}></div>
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{c.name}</span>
                   </div>
                 ))}
               </div>
               
               {activeTab === 'calendar' && weeks.length > 0 && (
                 <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                   <button 
                     disabled={selectedWeek === 0}
                     onClick={() => setSelectedWeek(s => s - 1)}
                     className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-20 transition-colors"
                   >
                     <i className="fa-solid fa-chevron-left text-xs"></i>
                   </button>
                   <span className="text-sm font-bold text-slate-800 min-w-[140px] text-center">
                     {weeks[selectedWeek].date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} — {new Date(weeks[selectedWeek].date.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                   </span>
                   <button 
                     disabled={selectedWeek === weeks.length - 1}
                     onClick={() => setSelectedWeek(s => s + 1)}
                     className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-20 transition-colors"
                   >
                     <i className="fa-solid fa-chevron-right text-xs"></i>
                   </button>
                 </div>
               )}
            </div>

            {activeTab === 'calendar' && weeks.length > 0 && (
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-700">
                <div className="w-16 bg-slate-50 border-r border-slate-100 pt-12 shrink-0">
                  {timeRange.map(hour => (
                    <div key={hour} className="h-20 text-[10px] font-black text-slate-300 text-center border-b border-slate-100/50 flex items-center justify-center">
                      {hour}:00
                    </div>
                  ))}
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 divide-x divide-slate-100 overflow-x-auto no-scrollbar">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((dayName, idx) => {
                    const dayIndex = idx + 1;
                    const dayEntries = weeks[selectedWeek].entries.filter(e => e.fullDate.getDay() === dayIndex);
                    
                    return (
                      <div key={dayName} className="min-w-[180px] relative">
                        <div className="h-12 bg-slate-50/50 border-b border-slate-100 flex items-center justify-center font-black text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                          {dayName}
                        </div>
                        
                        <div className="relative h-[1040px]">
                          {timeRange.map(h => (
                            <div key={h} className="h-20 border-b border-slate-50/80"></div>
                          ))}

                          {dayEntries.map(entry => {
                            const [h, m] = entry.startTime.split(':').map(Number);
                            const top = (h - 8) * 80 + (m / 60) * 80;
                            const height = (entry.durationMinutes / 60) * 80;
                            const theme = COURSE_COLORS[entry.colorIndex % COURSE_COLORS.length];

                            return (
                              <div 
                                key={entry.id}
                                className={`absolute left-1 right-1 rounded-2xl border-l-4 ${theme.bg} ${theme.border} p-3 shadow-md flex flex-col overflow-hidden transition-all hover:scale-[1.03] hover:shadow-lg hover:z-20 cursor-default group`}
                                style={{ top: `${top}px`, height: `${height}px` }}
                              >
                                <div className="flex justify-between items-start mb-1.5">
                                  <span className={`text-[10px] font-black leading-none ${theme.text} bg-white/50 px-1.5 py-0.5 rounded-md`}>{entry.startTime}</span>
                                </div>
                                <h4 className="text-[11px] font-black text-slate-800 leading-tight line-clamp-2">{entry.courseName}</h4>
                                <div className="mt-auto flex items-center gap-1.5 opacity-60">
                                   <i className="fa-solid fa-location-dot text-[9px]"></i>
                                   <span className="text-[9px] font-bold text-slate-600 truncate">{entry.location.split('-')[0]}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'list' && (
              <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
                {courseLegend.map((course, idx) => {
                  const courseEntries = schedule.filter(e => e.courseName === course.name);
                  return (
                    <section key={course.name} className="animate-in fade-in duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: course.color.hex }}></div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{course.name}</h2>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{courseEntries.length} SESSIONS</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {courseEntries.map(entry => (
                          <div key={entry.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-slate-300 transition-all group">
                            <div className="flex gap-5">
                              <div className={`flex flex-col items-center justify-center rounded-2xl w-14 h-14 border-2 ${course.color.bg} ${course.color.border}`}>
                                <span className={`text-[9px] font-black uppercase leading-none ${course.color.text} mb-1 opacity-70`}>
                                  {entry.fullDate.toLocaleDateString('en-US', { month: 'short' })}
                                </span>
                                <span className={`text-xl font-black leading-none ${course.color.text}`}>{entry.dayNumber}</span>
                              </div>
                              <div className="flex-1 overflow-hidden flex flex-col justify-center">
                                <div className="flex justify-between items-center mb-1">
                                  <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                    {entry.fullDate.toLocaleDateString('en-US', { weekday: 'long' })}
                                  </h4>
                                  <span className="text-[10px] font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">{entry.startTime}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold group-hover:text-slate-900 transition-colors">
                                  <i className="fa-solid fa-location-dot text-slate-300 group-hover:text-indigo-500 transition-colors"></i>
                                  <span className="truncate">{entry.location}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-8 animate-in zoom-in-95 duration-700">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Hours', val: `${stats.totalHours}h`, icon: 'fa-clock', color: 'bg-indigo-50 text-indigo-600' },
                    { label: 'Sessions', val: stats.lectureCount, icon: 'fa-graduation-cap', color: 'bg-emerald-50 text-emerald-600' },
                    { label: 'Active Courses', val: stats.courseBreakdown.length, icon: 'fa-book-open', color: 'bg-rose-50 text-rose-600' },
                    { label: 'Locations', val: Array.from(new Set(schedule.map(s => s.location))).length, icon: 'fa-map-pin', color: 'bg-amber-50 text-amber-600' }
                  ].map(stat => (
                    <div key={stat.label} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-5 transform hover:-translate-y-1 transition-all">
                      <div className={`w-14 h-14 rounded-2xl ${stat.color} flex items-center justify-center text-xl shadow-inner`}>
                        <i className={`fa-solid ${stat.icon}`}></i>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
                        <p className="text-2xl font-black text-slate-900 tracking-tight">{stat.val}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl">
                    <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight">Hour Distribution</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.courseBreakdown}
                            dataKey="hours"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={8}
                            stroke="none"
                          >
                            {stats.courseBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-4 mt-8">
                      {stats.courseBreakdown.map(c => (
                        <div key={c.name} className="flex items-center justify-between group">
                           <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></div>
                              <span className="text-xs font-bold text-slate-600 truncate max-w-[140px]">{c.name}</span>
                           </div>
                           <span className="text-xs font-black text-slate-900 bg-slate-50 px-2 py-1 rounded-lg group-hover:bg-slate-100 transition-colors">{c.hours}h</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl">
                    <h3 className="text-xl font-black text-slate-900 mb-10 tracking-tight">Monthly Session Load</h3>
                    <div className="h-[380px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={Object.entries(stats.monthDistribution).map(([name, count]) => ({ name, count }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 800}} 
                            tickFormatter={(value) => value.toUpperCase()}
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#cbd5e1', fontSize: 11, fontWeight: 700}} 
                          />
                          <Tooltip 
                            cursor={{fill: '#F8FAFC', radius: 12}} 
                            contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} 
                          />
                          <Bar dataKey="count" radius={[12, 12, 12, 12]} barSize={40} fill="#1e293b" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="py-12 border-t border-slate-100 mt-20">
         <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3 opacity-30 grayscale hover:grayscale-0 transition-all cursor-pointer">
               <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-xs">
                 <i className="fa-solid fa-calendar"></i>
               </div>
               <span className="text-xs font-black tracking-widest uppercase text-slate-900">UniTime Engine v2.0</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Developed for simplified university schedule management</p>
         </div>
      </footer>
    </div>
  );
};

export default App;
