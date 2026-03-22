import React, { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { db } from "../../firebase";
import { Task } from "../../types";
import { Bell, Calendar, Clock, AlertCircle, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { format, addDays, isAfter, isBefore, startOfDay, endOfDay, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "motion/react";

interface NotificationBellProps {
  align?: 'left' | 'right';
}

export default function NotificationBell({ align = 'right' }: NotificationBellProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = startOfDay(new Date());
    const twoDaysFromNow = endOfDay(addDays(today, 2));

    const q = query(
      collection(db, "tasks"),
      where("status", "!=", "completed"),
      orderBy("status"),
      orderBy("date", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      
      const upcomingTasks = allTasks.filter(task => {
        const taskDate = new Date(task.date + 'T12:00:00');
        return (isAfter(taskDate, today) || isToday(taskDate)) && 
               (isBefore(taskDate, twoDaysFromNow) || isSameDay(taskDate, twoDaysFromNow));
      });

      setTasks(upcomingTasks);
    });

    return () => unsubscribe();
  }, []);

  // Helper to check same day
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanhã";
    return format(date, "dd 'de' MMM", { locale: ptBR });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-2 rounded-xl transition-all relative group",
          isOpen 
            ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" 
            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        <Bell className={cn("w-5 h-5 transition-transform group-hover:rotate-12", isOpen && "scale-110")} />
        {tasks.length > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={cn(
              "absolute mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[100] overflow-hidden",
              align === 'right' ? "right-0" : "left-0"
            )}
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Notificações
                </h3>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">
                  Próximos 2 dias
                </p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                  {tasks.length}
                </span>
              </div>
            </div>

            <div className="max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              {tasks.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Tudo em dia!</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Nenhum compromisso para os próximos 2 dias.</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {tasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800 group cursor-default"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "mt-1 w-2 h-2 rounded-full shrink-0 shadow-sm",
                          task.status === 'in_progress' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-indigo-500 shadow-indigo-500/20'
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {task.title}
                            </p>
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md shrink-0",
                              isToday(new Date(task.date + 'T12:00:00')) 
                                ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" 
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                            )}>
                              {getDayLabel(task.date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                              <Clock className="w-3 h-3" />
                              {task.status === 'in_progress' ? 'Em Andamento' : 'Pendente'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => setIsOpen(false)}
                className="w-full py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors uppercase tracking-widest"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
