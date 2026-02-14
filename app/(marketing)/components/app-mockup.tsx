"use client";

import { cn } from "@/lib/utils";

interface MockupCardProps {
  children: React.ReactNode;
  className?: string;
}

function MockupCard({ children, className }: MockupCardProps) {
  return (
    <div className={cn(
      "rounded-2xl bg-gray-900 border border-gray-800/50 shadow-2xl",
      "p-6 backdrop-blur-sm bg-gradient-to-br from-gray-900/90 to-gray-950/90",
      className
    )}>
      {children}
    </div>
  );
}

export function CheckinMockup() {
  return (
    <MockupCard className="max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white text-lg font-semibold">Good morning!</h3>
          <p className="text-gray-400 text-sm">Let's check in for today</p>
        </div>
        <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
          <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
        </div>
      </div>

      {/* Readiness Score */}
      <div className="flex items-center justify-center mb-8">
        <div className="relative">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="#374151"
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="#10b981"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - 0.82)}`}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white">82</span>
            <span className="text-sm text-gray-400">Readiness</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="text-center">
          <div className="text-2xl font-semibold text-white">7.5h</div>
          <div className="text-xs text-gray-400">Sleep</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-white">62ms</div>
          <div className="text-xs text-gray-400">HRV</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-green-400">Low</div>
          <div className="text-xs text-gray-400">Stress</div>
        </div>
      </div>

      {/* CTA Button */}
      <button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium py-3 px-4 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-200">
        Start Check-in
      </button>
    </MockupCard>
  );
}

export function CoachMockup() {
  return (
    <MockupCard className="max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-bold">AI</span>
        </div>
        <div>
          <h3 className="text-white text-lg font-semibold">Coach</h3>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-gray-400 text-sm">Online</span>
          </div>
        </div>
      </div>

      {/* AI Message */}
      <div className="mb-6">
        <div className="bg-gray-800/50 rounded-2xl rounded-tl-md p-4 mb-4 border border-gray-700/50">
          <p className="text-gray-200 text-sm leading-relaxed">
            Based on your readiness (82), I recommend a <strong className="text-white">tempo run</strong> today. Your fatigue is low and fitness is trending up.
          </p>
        </div>
        
        {/* Suggested Workout Card */}
        <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-white font-semibold">Tempo Run</h4>
              <p className="text-gray-400 text-sm">45min • Zone 3-4</p>
            </div>
            <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414-1.414l-3 3a1 1 0 001.414 1.414L9 8.414V15a1 1 0 102 0V8.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="text-xs text-gray-400 mb-4">
            10min warmup • 20min @tempo • 10min cooldown • 5min stretching
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button className="flex-1 bg-orange-500 text-white text-sm font-medium py-2 px-3 rounded-lg hover:bg-orange-600 transition-colors">
              Accept
            </button>
            <button className="flex-1 bg-gray-700 text-gray-300 text-sm font-medium py-2 px-3 rounded-lg hover:bg-gray-600 transition-colors">
              Modify
            </button>
          </div>
        </div>
      </div>
    </MockupCard>
  );
}

export function CalendarMockup() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dates = [15, 16, 17, 18, 19, 20, 21];
  const today = 2; // Wednesday (index)
  
  const workouts = [
    { day: 0, type: 'easy', name: 'Easy Swim', duration: '45min' },
    { day: 1, type: 'moderate', name: 'Bike Intervals', duration: '90min' },
    { day: 2, type: 'hard', name: 'Tempo Run', duration: '60min', isToday: true },
    { day: 3, type: 'easy', name: 'Recovery Ride', duration: '45min' },
    { day: 4, type: 'hard', name: 'Track Session', duration: '75min' },
    { day: 5, type: 'moderate', name: 'Long Ride', duration: '3h' },
    { day: 6, type: 'easy', name: 'Easy Run', duration: '30min' },
  ];

  const getWorkoutColor = (type: string) => {
    switch (type) {
      case 'easy': return 'bg-green-500/80 border-green-400';
      case 'moderate': return 'bg-orange-500/80 border-orange-400';
      case 'hard': return 'bg-red-500/80 border-red-400';
      default: return 'bg-gray-500/80 border-gray-400';
    }
  };

  return (
    <MockupCard className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white text-lg font-semibold">This Week</h3>
          <p className="text-gray-400 text-sm">Feb 15-21, 2026</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-green-400">8.5h planned</div>
          <div className="text-xs text-gray-400">Weekly total</div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {days.map((day, index) => (
          <div key={day} className="text-center">
            <div className="text-xs text-gray-400 font-medium mb-2">{day}</div>
            <div className={cn(
              "text-sm font-semibold mb-3 p-2 rounded-lg",
              index === today 
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" 
                : "text-gray-300"
            )}>
              {dates[index]}
            </div>
            
            {/* Workout blocks */}
            <div className="min-h-[100px] space-y-1">
              {workouts
                .filter(workout => workout.day === index)
                .map((workout, workoutIndex) => (
                  <div
                    key={workoutIndex}
                    className={cn(
                      "p-2 rounded-lg border text-xs",
                      getWorkoutColor(workout.type),
                      workout.isToday && "ring-2 ring-orange-400/50"
                    )}
                  >
                    <div className="font-medium text-white truncate">{workout.name}</div>
                    <div className="text-white/80">{workout.duration}</div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="border-t border-gray-800 pt-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-green-400">3</div>
            <div className="text-xs text-gray-400">Easy</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-orange-400">2</div>
            <div className="text-xs text-gray-400">Moderate</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-red-400">2</div>
            <div className="text-xs text-gray-400">Hard</div>
          </div>
        </div>
      </div>
    </MockupCard>
  );
}