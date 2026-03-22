import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { Task, Cliente } from "../../types";
import { 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  User, 
  Search, 
  CheckSquare, 
  X, 
  MoreVertical, 
  Edit2, 
  ChevronRight, 
  ChevronLeft,
  Clock,
  AlertCircle
} from "lucide-react";
import { cn } from "../../lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "motion/react";

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
    cliente_id: "",
    status: "pending" as Task['status']
  });

  useEffect(() => {
    const qTasks = query(collection(db, "tasks"), orderBy("date", "asc"));
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    const qClientes = query(collection(db, "clientes"), orderBy("nome_cliente", "asc"));
    const unsubscribeClientes = onSnapshot(qClientes, (snapshot) => {
      setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente)));
    });

    return () => {
      unsubscribeTasks();
      unsubscribeClientes();
    };
  }, []);

  const handleOpenModal = (task: Task | null = null) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({
        title: task.title,
        description: task.description || "",
        date: task.date,
        cliente_id: task.cliente_id,
        status: task.status
      });
    } else {
      setEditingTask(null);
      setTaskForm({
        title: "",
        description: "",
        date: format(new Date(), "yyyy-MM-dd"),
        cliente_id: "",
        status: "pending"
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title || !taskForm.cliente_id || !taskForm.date) return;

    try {
      if (editingTask) {
        const taskRef = doc(db, "tasks", editingTask.id);
        await updateDoc(taskRef, {
          ...taskForm,
          updated_at: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, "tasks"), {
          ...taskForm,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Erro ao salvar tarefa:", error);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: newStatus,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;
    try {
      await deleteDoc(doc(db, "tasks", id));
    } catch (error) {
      console.error("Erro ao excluir tarefa:", error);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getClienteName = (id: string) => {
    return clientes.find(c => c.id === id)?.nome_cliente || "Cliente não encontrado";
  };

  const columns: { id: Task['status']; title: string; color: string }[] = [
    { id: 'pending', title: 'Pendente', color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
    { id: 'in_progress', title: 'Em Andamento', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
    { id: 'completed', title: 'Concluído', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quadro de Tarefas</h1>
          <p className="text-slate-500 dark:text-slate-400">Gerencie seu fluxo de trabalho em formato Kanban</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="hidden md:flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            <Plus className="w-5 h-5" />
            Nova Tarefa
          </button>

          {/* Mobile FAB */}
          <button
            onClick={() => handleOpenModal()}
            className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-95 transition-transform"
          >
            <Plus className="w-7 h-7" />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-4 min-h-[600px]">
        {columns.map((column) => (
          <div key={column.id} className="flex-1 min-w-[300px] flex flex-col gap-4">
            <div className={cn("flex items-center justify-between p-3 rounded-xl font-bold text-xs uppercase tracking-widest", column.color)}>
              <div className="flex items-center gap-2">
                <span>{column.title}</span>
                <span className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full text-[10px]">
                  {filteredTasks.filter(t => t.status === column.id).length}
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredTasks
                  .filter(task => task.status === column.id)
                  .map((task) => (
                    <motion.div
                      layout
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
                          {task.title}
                        </h3>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenModal(task)}
                            className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => deleteTask(task.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg w-fit">
                          <User className="w-3 h-3" />
                          {getClienteName(task.cliente_id)}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                            <CalendarIcon className="w-3 h-3" />
                            {format(new Date(task.date + 'T12:00:00'), "dd/MM")}
                          </div>

                          <div className="flex items-center gap-1">
                            {column.id !== 'pending' && (
                              <button 
                                onClick={() => updateTaskStatus(task.id, column.id === 'completed' ? 'in_progress' : 'pending')}
                                className="p-1 text-slate-400 hover:text-indigo-500 transition-colors"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                            )}
                            {column.id !== 'completed' && (
                              <button 
                                onClick={() => updateTaskStatus(task.id, column.id === 'pending' ? 'in_progress' : 'completed')}
                                className="p-1 text-slate-400 hover:text-indigo-500 transition-colors"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Nova/Editar Tarefa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Cliente</label>
                <select
                  required
                  value={taskForm.cliente_id}
                  onChange={(e) => setTaskForm({ ...taskForm, cliente_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                >
                  <option value="">Selecione um cliente</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_cliente}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Título / Atividade</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Reunião de alinhamento..."
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Data</label>
                  <input
                    type="date"
                    required
                    value={taskForm.date}
                    onChange={(e) => setTaskForm({ ...taskForm, date: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Status</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as any })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                  >
                    <option value="pending">Pendente</option>
                    <option value="in_progress">Em Andamento</option>
                    <option value="completed">Concluído</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Observações (Opcional)</label>
                <textarea
                  placeholder="Detalhes adicionais..."
                  rows={4}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                  {editingTask ? 'Salvar Alterações' : 'Criar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
