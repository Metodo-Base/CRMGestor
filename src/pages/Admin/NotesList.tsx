import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { Note, Cliente } from "../../types";
import { Plus, Trash2, Calendar as CalendarIcon, User, MessageSquare, Search, StickyNote, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [newNote, setNewNote] = useState({
    title: "",
    content: "",
    date: format(new Date(), "yyyy-MM-dd"),
    cliente_id: "" // Empty string will represent "None" in the UI
  });

  useEffect(() => {
    const qNotes = query(collection(db, "notes"), orderBy("date", "desc"));
    const unsubscribeNotes = onSnapshot(qNotes, (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
    });

    const qClientes = query(collection(db, "clientes"), orderBy("nome_cliente", "asc"));
    const unsubscribeClientes = onSnapshot(qClientes, (snapshot) => {
      setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente)));
    });

    return () => {
      unsubscribeNotes();
      unsubscribeClientes();
    };
  }, []);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.title || !newNote.content || !newNote.date) return;

    try {
      await addDoc(collection(db, "notes"), {
        ...newNote,
        cliente_id: newNote.cliente_id === "" ? null : newNote.cliente_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      setIsModalOpen(false);
      setNewNote({
        title: "",
        content: "",
        date: format(new Date(), "yyyy-MM-dd"),
        cliente_id: ""
      });
    } catch (error) {
      console.error("Erro ao adicionar anotação:", error);
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta anotação?")) return;
    try {
      await deleteDoc(doc(db, "notes", id));
    } catch (error) {
      console.error("Erro ao excluir anotação:", error);
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         note.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getClienteName = (id: string | null) => {
    if (!id) return "Geral / Sem Cliente";
    return clientes.find(c => c.id === id)?.nome_cliente || "Cliente não encontrado";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Anotações</h1>
          <p className="text-slate-500 dark:text-slate-400">Registre observações e notas importantes</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          <Plus className="w-5 h-5" />
          Nova Anotação
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar anotações..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNotes.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <StickyNote className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhuma anotação encontrada</h3>
            <p className="text-slate-500 dark:text-slate-400">Crie sua primeira anotação para começar.</p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 transition-all hover:shadow-md relative"
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
                  {note.title}
                </h3>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 whitespace-pre-wrap line-clamp-6">
                {note.content}
              </p>
              
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  <User className="w-3.5 h-3.5" />
                  <span className="truncate">{getClienteName(note.cliente_id)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {format(new Date(note.date + 'T12:00:00'), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Nova Anotação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nova Anotação</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleAddNote} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Cliente</label>
                <select
                  value={newNote.cliente_id}
                  onChange={(e) => setNewNote({ ...newNote, cliente_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                >
                  <option value="">Nenhum cliente (Geral)</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_cliente}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Título</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Feedback da campanha, Ideia de criativo..."
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Data</label>
                <input
                  type="date"
                  required
                  value={newNote.date}
                  onChange={(e) => setNewNote({ ...newNote, date: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Anotação</label>
                <textarea
                  required
                  placeholder="Escreva aqui suas observações..."
                  rows={6}
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
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
                  Salvar Anotação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
