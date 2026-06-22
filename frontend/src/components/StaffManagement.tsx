import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';

export const StaffManagement: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const toast = useToastStore();


  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New/Edit staff form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'GUARD',
  });

  const fetchStaff = async () => {
    try {
      const res = await api.get('/users');
      if (res.data?.success) {
        setStaff(res.data.data);
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
      password: '', // blank by default (optional for editing)
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

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-50 space-y-6 md:space-y-8 flex-1 overflow-y-auto select-none">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Staff Management Console</h2>
          <p className="text-sm text-slate-500 font-medium">Verify credentials, assign roles, toggle access, and monitor check-in executives</p>
        </div>
        <button
          onClick={() => {
            setEditId(null);
            setFormData({ name: '', email: '', phone: '', password: '', role: 'GUARD' });
            setShowForm(!showForm);
          }}
          className="bg-primary hover:bg-primary/95 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-sm shadow-primary/10 transition-all self-start"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Add/Edit Staff Modal/Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-xl mx-auto space-y-5 animate-fade-in"
        >
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
            <Users className="w-5 h-5 text-primary" />
            <span>{editId ? 'Edit Staff Member' : 'Staff Registration Form'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter full name"
                className="w-full text-slate-800 px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Role Permission</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full text-slate-800 px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none"
              >
                <option value="TENANT_ADMIN">Tenant Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="EXECUTIVE">Executive</option>
                <option value="GUARD">Guard</option>
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
                placeholder="email@example.com"
                className={`w-full text-slate-800 px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none ${
                  editId ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
                }`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone Number</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter mobile no"
                className="w-full text-slate-800 px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none"
              />
            </div>

            <div className="space-y-1 col-span-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {editId ? 'Login Password (leave blank to keep current)' : 'Login Password'}
              </label>
              <input
                type="password"
                name="password"
                required={!editId}
                value={formData.password}
                onChange={handleChange}
                placeholder={editId ? 'Enter new password (optional)' : 'Min 6 characters'}
                className="w-full text-slate-800 px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
                setFormData({ name: '', email: '', phone: '', password: '', role: 'GUARD' });
              }}
              className="border text-slate-500 font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-primary hover:bg-primary/95 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-primary/10"
            >
              {editId ? 'Save Changes' : 'Register Staff'}
            </button>
          </div>
        </form>
      )}

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center text-slate-400 font-semibold py-12">Loading staff roster...</div>
        ) : staff.length === 0 ? (
          <div className="col-span-full text-center text-slate-400 font-semibold py-12">No staff registered for this yard yet</div>
        ) : (
          staff.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center justify-center font-bold text-sm">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{member.name}</h4>
                    <div className="flex items-center space-x-1 mt-0.5">
                      <Shield className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                        {member.role.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEditClick(member)}
                    className="text-slate-400 hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-slate-100"
                    title="Edit Staff Member"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {member.id !== currentUser?.id && (
                    <button
                      onClick={() => toggleStatus(member.id, member.status)}
                      className={`text-slate-400 transition-colors ${member.status === 'ACTIVE' ? 'hover:text-rose-500' : 'hover:text-emerald-500'}`}
                      title={member.status === 'ACTIVE' ? 'Suspend Staff' : 'Activate Staff'}
                    >
                      {member.status === 'ACTIVE' ? (
                        <ToggleRight className="w-8 h-8 text-primary" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-slate-300" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-slate-50 pt-4 text-xs font-semibold text-slate-500">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{member.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{member.phone || 'No Mobile Registered'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-slate-400" />
                  <span>
                    Status: <span className={member.status === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-600'}>{member.status}</span>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
