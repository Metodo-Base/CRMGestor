import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { User, Cliente } from '../../types';
import { Users, UserPlus, Search, Edit2, Trash2, Shield, Layout, X, Check, Loader2, Mail, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { createUserWithEmailAndPassword, signOut as authSignOut } from 'firebase/auth';
import { auth, db, firebaseConfig } from '../../firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'client' as 'admin' | 'client',
    allowedClients: [] as string[]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const usersList = usersSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as User[];
      setUsers(usersList);

      const clientesQuery = query(collection(db, 'clientes'));
      const clientesSnapshot = await getDocs(clientesQuery);
      const clientesList = clientesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Cliente[];
      setClientes(clientesList);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: User) => {
    setError(null);
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name || '',
        email: user.email,
        password: '', // Don't show password
        role: user.role,
        allowedClients: user.allowedClients || []
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'client',
        allowedClients: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setError(null);
    try {
      if (editingUser) {
        // Update existing user in Firestore
        const userRef = doc(db, 'users', editingUser.uid);
        await updateDoc(userRef, {
          name: formData.name,
          role: formData.role,
          allowedClients: formData.allowedClients,
          updated_at: serverTimestamp()
        });
      } else {
        // Create new user in Firebase Auth and Firestore
        // We use a secondary app instance to create the user without logging out the current admin
        let secondaryApp;
        try {
          secondaryApp = initializeApp(firebaseConfig, 'Secondary');
        } catch (e) {
          // If already initialized, we can't easily get it by name without getApp, 
          // but we can just use a unique name each time
          secondaryApp = initializeApp(firebaseConfig, `Secondary-${Date.now()}`);
        }
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const userCredential = await createUserWithEmailAndPassword(
            secondaryAuth, 
            formData.email, 
            formData.password
          );
          const newUser = userCredential.user;

          // Create the profile in Firestore using the NEW UID
          await setDoc(doc(db, 'users', newUser.uid), {
            name: formData.name,
            email: formData.email,
            role: formData.role,
            allowedClients: formData.allowedClients,
            created_at: serverTimestamp()
          });

          // Sign out from the secondary app to clean up
          await authSignOut(secondaryAuth);
        } finally {
          // Clean up secondary app
          await deleteApp(secondaryApp);
        }
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving user:', err);
      setError(`Erro ao salvar usuário: ${err.message}`);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClick = (user: User) => {
    setError(null);
    setUserToDelete(user);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    console.log('Confirming delete for user:', userToDelete.uid);
    setModalLoading(true);
    setError(null);
    try {
      const userRef = doc(db, 'users', userToDelete.uid);
      console.log('Deleting document at path: users/', userToDelete.uid);
      await deleteDoc(userRef);
      console.log('Document deleted successfully');
      setUserToDelete(null);
      fetchData();
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setError(`Erro ao excluir usuário: ${err.message}`);
    } finally {
      setModalLoading(false);
    }
  };

  const toggleClient = (clientId: string) => {
    setFormData(prev => ({
      ...prev,
      allowedClients: prev.allowedClients.includes(clientId)
        ? prev.allowedClients.filter(id => id !== clientId)
        : [...prev.allowedClients, clientId]
    }));
  };

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
            <Users className="w-10 h-10 text-indigo-600" />
            Gestão de Usuários
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Gerencie acessos e permissões do sistema
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-indigo-500/20 uppercase tracking-widest"
        >
          <UserPlus className="w-5 h-5" />
          Novo Usuário
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar usuários por nome ou e-mail..."
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Users List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-3xl" />
          ))
        ) : filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <div
              key={user.uid}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleOpenModal(user)}
                  className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-500 hover:text-white rounded-xl transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteClick(user)}
                  className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-4 rounded-2xl shadow-lg",
                  user.role === 'admin' 
                    ? "bg-indigo-600 shadow-indigo-500/20" 
                    : "bg-emerald-600 shadow-emerald-500/20"
                )}>
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-1 pr-12">
                  <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                    {user.name || 'Sem Nome'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium truncate">
                    {user.email}
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                      user.role === 'admin'
                        ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                        : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                    )}>
                      {user.role}
                    </span>
                    {user.role === 'client' && (
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                        {user.allowedClients?.length || 0} Dashboards
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <Users className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
              Nenhum usuário encontrado
            </h3>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-bottom border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                {editingUser ? <Edit2 className="w-6 h-6 text-indigo-600" /> : <UserPlus className="w-6 h-6 text-indigo-600" />}
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-sm font-bold text-center">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    disabled={!!editingUser}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium disabled:opacity-50"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                {!editingUser && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      Senha Inicial
                    </label>
                    <input
                      type="password"
                      required
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    Nível de Acesso
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'client' })}
                  >
                    <option value="client">Cliente</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              {formData.role === 'client' && (
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Layout className="w-3 h-3" />
                    Dashboards Autorizados
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-2 border border-slate-100 dark:border-slate-800 rounded-2xl">
                    {clientes.map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => toggleClient(cliente.id)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                          formData.allowedClients.includes(cliente.id)
                            ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-200"
                        )}
                      >
                        <span className="text-xs font-bold truncate">{cliente.nome_cliente}</span>
                        {formData.allowedClients.includes(cliente.id) ? (
                          <Check className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <div className="w-4 h-4 border-2 border-slate-200 dark:border-slate-700 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {modalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
                Excluir Usuário?
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
                Tem certeza que deseja excluir o usuário <span className="font-bold text-slate-900 dark:text-white">{userToDelete.name || userToDelete.email}</span>? 
                Esta ação removerá apenas o perfil do banco de dados.
              </p>
              
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-sm font-bold text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={modalLoading}
                  className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {modalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
