import React, { useEffect, useState } from 'react';
import api from '../services/api';
import {
  Database,
  PlusCircle,
  Search,
  Edit,
  Trash2,
  Settings,
  Server,
  HardDrive,
  Cloud,
  ShieldCheck,
  Check,
  X,
  Building2,
  FolderOpen,
} from 'lucide-react';
import { useToastStore } from '../store/toastStore';

export const StorageManagement: React.FC = () => {
  const toast = useToastStore();

  // Storage Accounts State
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Tenants State
  const [tenants, setTenants] = useState<any[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals / Drawers State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [accountFormData, setAccountFormData] = useState({
    name: '',
    provider: 'AWS_S3',
    accessKeyId: '',
    secretAccessKey: '',
    region: 'ap-south-1',
    endpoint: '',
    bucketName: '',
  });
  const [submittingAccount, setSubmittingAccount] = useState(false);

  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [allocationFormData, setAllocationFormData] = useState({
    storageLimitGB: 10,
    storageAccountId: '',
    customBucketName: '',
  });
  const [submittingAllocation, setSubmittingAllocation] = useState(false);

  // Fetch all storage accounts from backend
  const fetchStorageAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const res = await api.get('/storage-accounts');
      if (res.data?.success) {
        setAccounts(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch storage accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Fetch all tenants
  const fetchTenants = async () => {
    try {
      setLoadingTenants(true);
      const res = await api.get('/tenants');
      if (res.data?.success) {
        setTenants(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch tenants');
    } finally {
      setLoadingTenants(false);
    }
  };

  useEffect(() => {
    fetchStorageAccounts();
    fetchTenants();
  }, []);

  // Handle Storage Account CRUD
  const handleOpenAccountModal = (account: any = null) => {
    if (account) {
      setEditingAccount(account);
      setAccountFormData({
        name: account.name,
        provider: account.provider,
        accessKeyId: account.accessKeyId,
        secretAccessKey: account.secretAccessKey,
        region: account.region || 'ap-south-1',
        endpoint: account.endpoint || '',
        bucketName: account.bucketName,
      });
    } else {
      setEditingAccount(null);
      setAccountFormData({
        name: '',
        provider: 'AWS_S3',
        accessKeyId: '',
        secretAccessKey: '',
        region: 'ap-south-1',
        endpoint: '',
        bucketName: '',
      });
    }
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAccount(true);
    try {
      if (editingAccount) {
        const res = await api.put(`/storage-accounts/${editingAccount.id}`, accountFormData);
        if (res.data?.success) {
          toast.success('Storage integration updated successfully!');
          setIsAccountModalOpen(false);
          fetchStorageAccounts();
        }
      } else {
        const res = await api.post('/storage-accounts', accountFormData);
        if (res.data?.success) {
          toast.success('Storage integration added successfully!');
          setIsAccountModalOpen(false);
          fetchStorageAccounts();
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save storage account');
    } finally {
      setSubmittingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: string, name: string, assignedCount: number) => {
    const confirmMsg = assignedCount > 0
      ? `Warning: "${name}" is currently assigned to ${assignedCount} yard(s). Deleting it will automatically disassociate those yards and reset them to the System Default. Are you sure you want to proceed?`
      : `Are you sure you want to delete "${name}"? This integration will be removed.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.delete(`/storage-accounts/${id}`);
      if (res.data?.success) {
        toast.success('Storage integration deleted successfully!');
        fetchStorageAccounts();
        fetchTenants(); // Refetch yards to show their updated default status!
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete storage account');
    }
  };

  // Handle Tenant Allocation
  const handleOpenAllocationModal = (tenant: any) => {
    setSelectedTenant(tenant);
    setAllocationFormData({
      storageLimitGB: (tenant.storageLimit || 0) / 1024,
      storageAccountId: tenant.storageAccountId || '',
      customBucketName: tenant.customBucketName || '',
    });
    setIsAllocationModalOpen(true);
  };

  const handleSaveAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAllocation(true);
    try {
      const payload = {
        storageLimit: Math.round(allocationFormData.storageLimitGB * 1024), // GB to MB
        storageAccountId: allocationFormData.storageAccountId || null,
        customBucketName: allocationFormData.customBucketName || null,
      };

      const res = await api.put(`/tenants/${selectedTenant.id}`, payload);
      if (res.data?.success) {
        toast.success(`Storage plans for ${selectedTenant.yardName} updated successfully!`);
        setIsAllocationModalOpen(false);
        fetchTenants();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save storage allocation settings');
    } finally {
      setSubmittingAllocation(false);
    }
  };

  // Filters
  const filteredTenants = tenants.filter((t) =>
    t.yardName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-50 space-y-6 md:space-y-8 flex-1 overflow-y-auto font-sans text-slate-800">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center">
          <Database className="w-7 h-7 mr-2 text-primary" />
          Storage & Quota Management
        </h2>
        <p className="text-sm text-slate-500 font-medium mt-1">
          Dynamic cloud storage allocation, multi-account S3 integrations, and custom bucket mapping for yard tenants.
        </p>
      </div>

      {/* STORAGE ACCOUNTS CONSOLE */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-slate-800">1. Storage Account Integrations</h3>
            <p className="text-xs text-slate-400 font-medium">Add and manage AWS S3 and Cloudflare R2 cloud accounts.</p>
          </div>
          <button
            onClick={() => handleOpenAccountModal()}
            className="bg-primary hover:bg-primary/95 text-white font-bold px-4 py-2 rounded-xl shadow-md shadow-primary/20 transition-all text-xs flex items-center space-x-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Storage Account</span>
          </button>
        </div>

        {loadingAccounts ? (
          <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl shadow-sm">
            Fetching storage accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
            <Server className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-medium">No storage integrations configured yet.</p>
            <p className="text-[10px] text-slate-400">System will automatically fall back to backend `.env` variables.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm relative overflow-hidden group hover:border-primary/40 transition-colors"
              >
                <div className="absolute right-0 top-0 w-24 h-24 bg-slate-50 rounded-bl-full pointer-events-none flex items-center justify-center">
                  <Cloud className="w-8 h-8 text-slate-200" />
                </div>

                <div className="space-y-4">
                  <div>
                    <span className={`px-2 py-0.5 rounded font-bold text-[8px] uppercase tracking-wider ${
                      acc.provider === 'AWS_S3'
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    }`}>
                      {acc.provider === 'AWS_S3' ? 'AWS S3' : 'Cloudflare R2'}
                    </span>
                    <h4 className="font-bold text-slate-800 text-sm mt-1">{acc.name}</h4>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 font-semibold">
                    <div className="flex items-center space-x-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                      <span>Bucket: <strong className="text-slate-700">{acc.bucketName}</strong></span>
                    </div>
                    {acc.region && (
                      <div className="flex items-center space-x-1.5">
                        <Server className="w-3.5 h-3.5 text-slate-400" />
                        <span>Region: <span className="font-mono">{acc.region}</span></span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Assigned to: <strong className="text-emerald-600">{acc._count?.tenants || 0} yard(s)</strong></span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenAccountModal(acc)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all"
                      title="Edit Credentials"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(acc.id, acc.name, acc._count?.tenants || 0)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all"
                      title="Delete Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* YARDS ALLOCATION MODULE */}
      <div className="space-y-4 pt-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">2. Yards Storage & Quotas Assignment</h3>
          <p className="text-xs text-slate-400 font-medium">Allocate storage space limits and dynamic accounts mapping for each tenant.</p>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search yards by name or contact person..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold text-slate-800"
            />
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/50">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Superadmin Space Orchestrator</span>
          </div>
        </div>

        {/* Yards Grid */}
        {loadingTenants ? (
          <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl shadow-sm">
            Fetching tenant yards...
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-400 font-semibold">
            No yards matched your search.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                    <th className="p-4 font-semibold">Yard Details</th>
                    <th className="p-4 font-semibold">Assigned Storage Account</th>
                    <th className="p-4 font-semibold">Target Bucket</th>
                    <th className="p-4 font-semibold">Quota Space</th>
                    <th className="p-4 font-semibold">Usage Estimation</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                  {filteredTenants.map((t) => {
                    const matchedAcc = accounts.find((a) => a.id === t.storageAccountId);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Details */}
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 bg-primary/10 text-primary border border-primary/20 rounded-lg flex items-center justify-center shrink-0">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm tracking-tight">{t.yardName}</p>
                              <span className="text-[9px] text-slate-400 block mt-0.5">{t.contactPerson} • {t.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Account Assigned */}
                        <td className="p-4">
                          {matchedAcc ? (
                            <div className="flex items-center space-x-1.5">
                              <Server className="w-3.5 h-3.5 text-indigo-500" />
                              <div>
                                <p className="font-bold text-slate-800">{matchedAcc.name}</p>
                                <p className="text-[9px] text-slate-400 uppercase font-semibold">{matchedAcc.provider === 'AWS_S3' ? 'AWS S3' : 'Cloudflare R2'}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px] font-semibold">System Default (.env)</span>
                          )}
                        </td>

                        {/* Target Bucket */}
                        <td className="p-4">
                          {t.customBucketName ? (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                              {t.customBucketName} (Custom)
                            </span>
                          ) : matchedAcc ? (
                            <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-mono text-[10px]">
                              {matchedAcc.bucketName} (Default)
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px] font-semibold">System Default Bucket</span>
                          )}
                        </td>

                        {/* Quota limit */}
                        <td className="p-4 font-bold text-slate-700">
                          {t.storageLimit === -1 ? (
                            <span className="text-emerald-600 uppercase font-bold text-[10px]">Unlimited</span>
                          ) : (
                            <span>{(t.storageLimit || 0) / 1024} GB</span>
                          )}
                        </td>

                        {/* Usage estimation */}
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0">
                              {/* Simple mock percentage for display */}
                              <div className="bg-sky-500 h-full w-[12%]"></div>
                            </div>
                            <span className="text-[10px] text-slate-400 font-semibold">12% used</span>
                          </div>
                        </td>

                        {/* Action buttons */}
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleOpenAllocationModal(t)}
                            className="bg-white border border-slate-200 hover:border-indigo-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center space-x-1 shadow-sm"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>Orchestrate Storage</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* STORAGE ACCOUNT MODAL */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {editingAccount ? 'Modify Storage Integration' : 'Integrate New Storage Account'}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Link AWS or Cloudflare R2 object storage securely.</p>
              </div>
              <button
                onClick={() => setIsAccountModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                {/* Account Name */}
                <div className="space-y-1.5 col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Account Label/Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cloudflare R2 Free Tier / Main AWS Account"
                    value={accountFormData.name}
                    onChange={(e) => setAccountFormData({ ...accountFormData, name: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                  />
                </div>

                {/* Provider */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Storage Provider</label>
                  <select
                    value={accountFormData.provider}
                    onChange={(e) => setAccountFormData({ ...accountFormData, provider: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                  >
                    <option value="AWS_S3">AWS S3</option>
                    <option value="CLOUDFLARE_R2">Cloudflare R2</option>
                  </select>
                </div>

                {/* Bucket Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Default Bucket Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. yms-storage-bucket"
                    value={accountFormData.bucketName}
                    onChange={(e) => setAccountFormData({ ...accountFormData, bucketName: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                  />
                </div>

                {/* Access Key ID */}
                <div className="space-y-1.5 col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Access Key ID</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Access Key"
                    value={accountFormData.accessKeyId}
                    onChange={(e) => setAccountFormData({ ...accountFormData, accessKeyId: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold font-mono"
                  />
                </div>

                {/* Secret Access Key */}
                <div className="space-y-1.5 col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Secret Access Key</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter Secret Key"
                    value={accountFormData.secretAccessKey}
                    onChange={(e) => setAccountFormData({ ...accountFormData, secretAccessKey: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold font-mono"
                  />
                </div>

                {/* Region / Public Domain */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {accountFormData.provider === 'CLOUDFLARE_R2' ? 'Public Domain URL (R2 only)' : 'AWS Region (S3 only)'}
                  </label>
                  <input
                    type="text"
                    required={accountFormData.provider === 'AWS_S3'}
                    placeholder={accountFormData.provider === 'CLOUDFLARE_R2' ? 'e.g. https://pub-xxx.r2.dev' : 'e.g. ap-south-1'}
                    value={accountFormData.region || ''}
                    onChange={(e) => setAccountFormData({ ...accountFormData, region: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                  />
                </div>

                {/* Custom Endpoint */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Endpoint URL (R2 only)</label>
                  <input
                    type="text"
                    required={accountFormData.provider === 'CLOUDFLARE_R2'}
                    disabled={accountFormData.provider !== 'CLOUDFLARE_R2'}
                    placeholder="e.g. https://<id>.r2.cloudflarestorage.com"
                    value={accountFormData.endpoint || ''}
                    onChange={(e) => setAccountFormData({ ...accountFormData, endpoint: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAccount}
                  className="bg-primary hover:bg-primary/95 text-white font-bold px-5 py-2 rounded-xl shadow-md transition-all text-xs flex items-center space-x-1.5"
                >
                  {submittingAccount ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving integration...</span>
                    </>
                  ) : (
                    <span>Save Integration</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STORAGE ALLOCATION ORCHESTRATION MODAL */}
      {isAllocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-800">Orchestrate Tenant Storage</h3>
                <p className="text-[10px] text-slate-400 font-medium">{selectedTenant?.yardName}</p>
              </div>
              <button
                onClick={() => setIsAllocationModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAllocation} className="p-6 space-y-5">
              {/* Allocated Storage Limit */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hard Storage Limit (GB)</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    max="1000"
                    placeholder="Enter limit, e.g. 10"
                    value={allocationFormData.storageLimitGB}
                    onChange={(e) => setAllocationFormData({ ...allocationFormData, storageLimitGB: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 text-slate-800 pl-4 pr-12 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-bold"
                  />
                  <span className="absolute right-4 top-3 text-[10px] font-extrabold text-slate-400 uppercase">GB</span>
                </div>
                <p className="text-[9px] text-slate-400 font-medium">This quota limits vehicle check-in photos & release document storage.</p>
              </div>

              {/* Storage Account mapping */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Storage Account</label>
                <select
                  value={allocationFormData.storageAccountId}
                  onChange={(e) => setAllocationFormData({ ...allocationFormData, storageAccountId: e.target.value })}
                  className="w-full bg-slate-50 text-slate-800 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                >
                  <option value="">System Default S3 (Configured in .env)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.provider === 'AWS_S3' ? 'AWS S3' : 'Cloudflare R2'})
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 font-medium">Assign a dedicated cloud storage provider integration to this yard.</p>
              </div>

              {/* Custom Bucket name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custom Bucket Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. customized-yard-bucket"
                  value={allocationFormData.customBucketName}
                  onChange={(e) => setAllocationFormData({ ...allocationFormData, customBucketName: e.target.value })}
                  className="w-full bg-slate-50 text-slate-800 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold font-mono"
                />
                <p className="text-[9px] text-slate-400 font-medium">Overrides the default bucket on the assigned storage account.</p>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAllocationModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAllocation}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl shadow-md shadow-indigo-500/20 transition-all text-xs flex items-center space-x-1.5"
                >
                  {submittingAllocation ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving allocation...</span>
                    </>
                  ) : (
                    <span>Save Storage Plan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
