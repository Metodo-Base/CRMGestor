import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./components/admin/AdminLayout";
import ClientLayout from "./components/client/ClientLayout";
import ClientList from "./pages/Admin/ClientList";
import ClientForm from "./pages/Admin/ClientForm";
import InternalDashboard from "./pages/Admin/InternalDashboard";
import ClientDashboard from "./pages/Dashboard/ClientDashboard";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import UserManagement from "./pages/Admin/UserManagement";
import TaskList from "./pages/Admin/TaskList";
import NotesList from "./pages/Admin/NotesList";
import CalendarView from "./pages/Admin/CalendarView";
import GeneralSettings from "./pages/Admin/GeneralSettings";
import MetaAdsSettings from "./pages/Admin/MetaAdsSettings";
import GoogleAdsSettings from "./pages/Admin/GoogleAdsSettings";
import Login from "./pages/Login";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<ClientList />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="tarefas" element={<TaskList />} />
                <Route path="anotacoes" element={<NotesList />} />
                <Route path="agenda" element={<CalendarView />} />
                <Route path="usuarios" element={<UserManagement />} />
                <Route path="configuracoes" element={<GeneralSettings />} />
                <Route path="meta-ads" element={<MetaAdsSettings />} />
                <Route path="google-ads" element={<GoogleAdsSettings />} />
                <Route path="novo" element={<ClientForm />} />
                <Route path="editar/:id" element={<ClientForm />} />
                <Route path="dashboard/:id" element={<InternalDashboard />} />
              </Route>
            </Route>

            {/* Client Routes */}
            <Route element={<ProtectedRoute allowedRoles={['client']} />}>
              <Route path="/dashboard" element={<ClientLayout />}>
                <Route index element={<div className="flex items-center justify-center h-full text-slate-400 font-bold uppercase tracking-widest">Selecione um dashboard no menu lateral</div>} />
                <Route path=":id" element={<ClientDashboard />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
