import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { Task, Cliente } from "../../types";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, CheckCircle2, Circle } from "lucide-react";
import { cn } from "../../lib/utils";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  parseISO
} from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedDayTasks, setSelectedDayTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  useEffect(() => {
    const qTasks = query(collection(db, "tasks"), orderBy("date", "asc"));
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(tasksData);
      
      // Update selected day tasks if a day is selected
      if (selectedDate) {
        const dayTasks = tasksData.filter(t => isSameDay(parseISO(t.date), selectedDate));
        setSelectedDayTasks(dayTasks);
      }
    });

    const qClientes = query(collection(db, "clientes"), orderBy("nome_cliente", "asc"));
    const unsubscribeClientes = onSnapshot(qClientes, (snapshot) => {
      setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente)));
    });

    return () => {
      unsubscribeTasks();
      unsubscribeClientes();
    };
  }, [selectedDate]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const getDayTasks = (day: Date) => {
    return tasks.filter(task => isSameDay(parseISO(task.date), day));
  };

  const getClienteName = (id: string) => {
    return clientes.find(c => c.id === id)?.nome_cliente || "Cliente";
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setSelectedDayTasks(getDayTasks(day));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agenda de Compromissos</h1>
          <p className="text-slate-500 dark:text-slate-400">Visualize suas tarefas e observações no calendário</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors">
                <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 text-sm font-medium hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-slate-600 dark:text-slate-400">
                Hoje
              </button>
              <button onClick={nextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors">
                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const dayTasks = getDayTasks(day);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isDaySelected = selectedDate && isSameDay(day, selectedDate);
              const isDayToday = isToday(day);

              return (
                <div
                  key={day.toString()}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "min-h-[100px] p-2 border-r border-b border-slate-100 dark:border-slate-800/50 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50",
                    !isCurrentMonth && "bg-slate-50/50 dark:bg-slate-900/50 opacity-40",
                    isDaySelected && "bg-indigo-50/50 dark:bg-indigo-900/10 ring-2 ring-inset ring-indigo-500/30",
                    (i + 1) % 7 === 0 && "border-r-0"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full",
                      isDayToday ? "bg-indigo-600 text-white" : "text-slate-700 dark:text-slate-300",
                      !isCurrentMonth && "text-slate-400"
                    )}>
                      {format(day, "d")}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    {dayTasks.slice(0, 2).map(task => (
                      <div 
                        key={task.id} 
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border truncate font-medium",
                          task.status === 'completed' 
                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30" 
                            : task.status === 'in_progress'
                              ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/30"
                              : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/30"
                        )}
                      >
                        {task.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 pl-1 font-medium">
                        + {dayTasks.length - 2} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Details Sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "Selecione um dia"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">
                  {selectedDate ? format(selectedDate, "eeee", { locale: ptBR }) : ""}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {selectedDayTasks.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum compromisso para este dia.</p>
                </div>
              ) : (
                selectedDayTasks.map(task => (
                  <div key={task.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-start gap-3">
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                      ) : task.status === 'in_progress' ? (
                        <Clock className="w-5 h-5 text-amber-500 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className={cn(
                          "font-bold text-sm",
                          task.status === 'completed' ? "text-slate-500 line-through" : "text-slate-900 dark:text-white"
                        )}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        <User className="w-3 h-3" />
                        {getClienteName(task.cliente_id)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
