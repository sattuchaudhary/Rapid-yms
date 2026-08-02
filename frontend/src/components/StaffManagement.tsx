import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import {
  Users,
  UserPlus,
  Shield,
  Phone,
  Mail,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  Edit,
  Search,
  Key,
  Trash2,
  CheckCircle2,
  XCircle,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';

export type RoleType =
  | 'SUPER_ADMIN'
  | 'TENANT_ADMIN'
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'EXECUTIVE'
  | 'GUARD';

interface RoleConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
  desc: string;
}

const ROLE_CONFIG: Record<RoleType, RoleConfig> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    desc: 'Full multi-tenant system control',
  },
  TENANT_ADMIN: {
    label: 'Yard Admin',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    desc: 'Full yard & crew administration',
  },
  MANAGER: {
    label: 'Yard Manager',
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    desc: 'Operational & financial oversight',
  },
  SUPERVISOR: {
    label: 'Yard Supervisor',
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    desc: 'Field oversight & guard supervision',
  },
  EXECUTIVE: {
    label: 'Yard Executive',
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    desc: 'Gate operations & checkout desk',
  },
  GUARD: {
    label: 'Yard Guard',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    desc: 'Vehicle entry & checklist logging',
  },
};

export const StaffManagement: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const toast = useToastStore();

  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('');

  // New/Edit staff modal state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'GUARD' as RoleType,
  });

  // Password reset modal state
  const [resetModalUser, setResetModalUser] = useState<any | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      if (res.data?.success) {
        setStaff(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch staff list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditClick = (member: any) => {
    setEditId(member.id);
    setFormData({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      password: '',
      role: member.role || 'GUARD',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        // Edit mode
        const payload: any = {
          name: formData.name,
          phone: formData.phone,
          role: formData.role,
        };
        if (formData.password) {
          payload.password = formData.password;
        }
        const res = await api.put(`/users/${editId}`, payload);
        if (res.data?.success) {
          toast.success('Staff member updated successfully!');
          setShowForm(false);
          setEditId(null);
          setFormData({ name: '', email: '', phone: '', password: '', role: 'GUARD' });
          fetchStaff();
        }
      } else {
        // Add mode
        const res = await api.post('/users', formData);
        if (res.data?.success) {
          toast.success('Staff member registered successfully!');
          setShowForm(false);
          setFormData({ name: '', email: '', phone: '', password: '', role: 'GUARD' });
          fetchStaff();
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to ${editId ? 'update' : 'register'} staff`);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    if (id === currentUser?.id) {
      toast.error('You cannot deactivate your own account!');
      return;
    }
    try {
      const res = await api.put(`/users/${id}`, {
        status: currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      if (res.data?.success) {
        toast.success('Staff status updated successfully!');
        fetchStaff();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !newPasswordInput) return;
    if (newPasswordInput.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    try {
      const res = await api.post(`/users/${resetModalUser.id}/reset-password`, { newPassword: newPasswordInput });
      if (res.data?.success) {
        toast.success(`Password reset for ${resetModalUser.name}!`);
        setResetModalUser(null);
        setNewPasswordInput('');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (id === currentUser?.id) {
      toast.error('You cannot delete your own account!');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete staff member "${name}"?`)) return;
    try {
      const res = await api.delete(`/users/${id}`);
      if (res.data?.success) {
        toast.success(`Staff member "${name}" deleted.`);
        fetchStaff();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete staff member');
    }
  };

  // Filtered Roster
  const filteredStaff = useMemo(() => {
    return staff.filter((m) => {
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
      if (roleFilter && m.role !== roleFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (m.name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q) ||
        (m.role || '').toLowerCase().includes(q)
      );
    });
  }, [staff, statusFilter, roleFilter, search]);

  const stats = useMemo(() => {
    const total = staff.length;
    const active = staff.filter((s) => s.status === 'ACTIVE').length;
    const inactive = staff.filter((s) => s.status === 'INACTIVE').length;
    return { total, active, inactive };
  }, [staff]);

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-950 space-y-6 flex-1 overflow-y-auto select-none text-slate-100 font-sans">
      
      {/* 1. Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-6 h-6 text-indigo-400" />
            <h2 className="text-2xl font-black text-white tracking-tight font-mono uppercase">Yard Crew & Staff Management</h2>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Manage operational permissions, gate guards, Supervisors & Executive login accounts
          </p>
        </div>

        <button
          onClick={() => {
            setEditId(null);
            setFormData({ name: '', email: '', phone: '', password: '', role: 'GUARD' });
            setShowForm(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md transition-all self-start cursor-pointer uppercase tracking-wider"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* 2. Search & Stats Filter Console */}
      <div className="bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Name, Email, Mobile or Role..."
            className="w-full text-white bg-slate-950 pl-10 pr-10 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500 text-xs font-semibold placeholder-slate-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-3 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Role & Status Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs font-bold text-white bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Staff Roles</option>
            <option value="TENANT_ADMIN">Yard Admin</option>
            <option value="MANAGER">Yard Manager</option>
            <option value="SUPERVISOR">Yard Supervisor</option>
            <option value="EXECUTIVE">Yard Executive</option>
            <option value="GUARD">Yard Guard</option>
          </select>
        </div>
      </div>

      {/* 3. Filter Status Tabs Bar */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-2 overflow-x-auto">
        <div className="flex items-center space-x-2 min-w-max">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            All Crew ({stats.total})
          </button>

          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Active Roster ({stats.active})</span>
          </button>

          <button
            onClick={() => setStatusFilter('INACTIVE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              statusFilter === 'INACTIVE'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-rose-400 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Suspended / Inactive ({stats.inactive})</span>
          </button>
        </div>
      </div>

      {/* 4. Registration / Edit Staff Modal Overlay */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl w-full max-w-xl space-y-5 animate-scale-in text-white text-left relative"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-extrabold text-white uppercase tracking-wider">
                  {editId ? 'Edit Staff Member Profile' : 'Register New Yard Staff'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditId(null);
                  setFormData({ name: '', email: '', phone: '', password: '', role: 'GUARD' });
                }}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full text-white bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Role Permission</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full text-white bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="GUARD">Yard Guard (Entry Logging & Checklist)</option>
                  <option value="EXECUTIVE">Yard Executive (Gate Desk & Release)</option>
                  <option value="SUPERVISOR">Yard Supervisor (Field Oversight)</option>
                  <option value="MANAGER">Yard Manager (Operations & Audit)</option>
                  <option value="TENANT_ADMIN">Yard Admin (Full Control)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
                <input
                  type="email"
                  name="email"
                  required={!editId}
                  disabled={!!editId}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="staff@yard.com"
                  className={`w-full text-white bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 ${
                    editId ? 'bg-slate-950/50 text-slate-500 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full text-white bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1 col-span-1 sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {editId ? 'Login Password (leave blank to keep current)' : 'Account Login Password'}
                </label>
                <input
                  type="password"
                  name="password"
                  required={!editId}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={editId ? 'Enter new password (optional)' : 'Minimum 6 characters'}
                  className="w-full text-white bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditId(null);
                  setFormData({ name: '', email: '', phone: '', password: '', role: 'GUARD' });
                }}
                className="border border-slate-800 text-slate-400 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-md transition-all uppercase tracking-wider cursor-pointer"
              >
                {editId ? 'Save Profile Changes' : 'Register Yard Staff'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. Password Reset Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleResetPassword}
            className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl w-full max-w-md space-y-4 text-left"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-extrabold text-white uppercase">Reset Password for {resetModalUser.name}</h3>
              </div>
              <button type="button" onClick={() => setResetModalUser(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">New Password</label>
              <input
                type="password"
                required
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="Enter minimum 6 characters"
                className="w-full text-white bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="px-4 py-2 border border-slate-800 text-slate-400 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. Staff Cards Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 font-bold bg-slate-900/60 rounded-3xl border border-slate-800">
            Loading yard staff roster...
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 font-bold bg-slate-900/60 rounded-3xl border border-slate-800">
            No matching staff members found.
          </div>
        ) : (
          filteredStaff.map((member) => {
            const roleCfg = ROLE_CONFIG[member.role as RoleType] || ROLE_CONFIG.GUARD;

            return (
              <div
                key={member.id}
                className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-800 p-5 flex flex-col justify-between shadow-xl hover:border-slate-700 transition-all duration-200 text-left space-y-4 group"
              >
                {/* Header: Avatar, Name, Role badge & Action Toolbar */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner shrink-0 font-mono">
                      {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-base tracking-tight">{member.name}</h4>
                      <div className="mt-1">
                        <span className={`px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider border ${roleCfg.bg} ${roleCfg.text} ${roleCfg.border}`}>
                          {roleCfg.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => handleEditClick(member)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit Staff Member"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setResetModalUser(member);
                        setNewPasswordInput('');
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Reset Login Password"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>

                    {member.id !== currentUser?.id && (
                      <>
                        <button
                          onClick={() => toggleStatus(member.id, member.status)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            member.status === 'ACTIVE' ? 'text-emerald-400 hover:text-rose-400' : 'text-slate-500 hover:text-emerald-400'
                          }`}
                          title={member.status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
                        >
                          {member.status === 'ACTIVE' ? (
                            <ToggleRight className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-slate-600" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDeleteStaff(member.id, member.name)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Delete Staff Member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Role Description subtitle */}
                <p className="text-[11px] text-slate-400 font-medium italic border-b border-slate-800/80 pb-3">
                  "{roleCfg.desc}"
                </p>

                {/* Contact & Status details */}
                <div className="space-y-2 text-xs font-semibold text-slate-300">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                    {member.phone ? (
                      <a href={`tel:${member.phone}`} className="text-indigo-400 hover:underline">
                        {member.phone}
                      </a>
                    ) : (
                      <span className="text-slate-500 italic">No Mobile Registered</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                    <span className="text-slate-500">Account Access</span>
                    <span
                      className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider ${
                        member.status === 'ACTIVE'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {member.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
