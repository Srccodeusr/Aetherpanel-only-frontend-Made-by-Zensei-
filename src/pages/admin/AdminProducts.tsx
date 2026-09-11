import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Check, X, RefreshCw, Layers, ShieldCheck, Server, Link2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Plan, Product, PanelEggOption, PanelLocationOption } from '../../types';

export const AdminProducts: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');

  // Plan Edit/Create Modal
  const [showModal, setShowModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string>('prod_minecraft');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ramMB, setRamMB] = useState(4096);
  const [cpuCores, setCpuCores] = useState(2);
  const [diskGB, setDiskGB] = useState(30);
  const [priceMonthly, setPriceMonthly] = useState(9.99);
  const [priceYearly, setPriceYearly] = useState(99.90);
  const [backupLimit, setBackupLimit] = useState(3);
  const [databaseLimit, setDatabaseLimit] = useState(2);
  const [serverLimit, setServerLimit] = useState(1);
  const [isPopular, setIsPopular] = useState(false);

  // Panel Deployment Mapping Modal (per product category) — lists of
  // customer-selectable egg (application) and location/node options.
  const [showEggModal, setShowEggModal] = useState(false);
  const [eggModalProduct, setEggModalProduct] = useState<Product | null>(null);
  const [eggOptionsDraft, setEggOptionsDraft] = useState<PanelEggOption[]>([]);
  const [locationOptionsDraft, setLocationOptionsDraft] = useState<PanelLocationOption[]>([]);
  const [savingEggMapping, setSavingEggMapping] = useState(false);
  const [testingOptionId, setTestingOptionId] = useState<string | null>(null);
  const [eggTestResults, setEggTestResults] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});

  // Feedback notification
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchPlans = async () => {
    const [plansRes, prodsRes] = await Promise.all([
      apiRequest('/admin/plans'),
      apiRequest('/admin/products')
    ]);

    if (plansRes.success && plansRes.data) {
      setPlans(plansRes.data);
    }
    if (prodsRes.success && prodsRes.data) {
      setProducts(prodsRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingPlanId(null);
    setProductId(products[0]?.id || 'prod_minecraft');
    setName('');
    setDescription('');
    setRamMB(4096);
    setCpuCores(2);
    setDiskGB(30);
    setPriceMonthly(9.99);
    setPriceYearly(99.90);
    setBackupLimit(3);
    setDatabaseLimit(2);
    setServerLimit(1);
    setIsPopular(false);
    setShowModal(true);
  };

  const handleOpenEditModal = (p: Plan) => {
    setEditingPlanId(p.id);
    setProductId(p.productId);
    setName(p.name);
    setDescription(p.description || '');
    setRamMB(p.ramMB);
    setCpuCores(p.cpuCores);
    setDiskGB(p.diskGB);
    setPriceMonthly(p.priceMonthly);
    setPriceYearly(p.priceYearly || p.priceMonthly * 10);
    setBackupLimit(p.backupLimit || 3);
    setDatabaseLimit(p.databaseLimit || 2);
    setServerLimit(p.serverLimit || 1);
    setIsPopular(!!p.isPopular);
    setShowModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'Plan name is required');
      return;
    }

    const payload = {
      productId,
      name: name.trim(),
      description: description.trim(),
      ramMB: Number(ramMB),
      cpuCores: Number(cpuCores),
      diskGB: Number(diskGB),
      priceMonthly: Number(priceMonthly),
      priceYearly: Number(priceYearly) || Number(priceMonthly) * 10,
      backupLimit: Number(backupLimit),
      databaseLimit: Number(databaseLimit),
      serverLimit: Number(serverLimit),
      isPopular,
      features: [
        'DDoS Protected Uplink',
        'NVMe Storage Array',
        'Automated Snapshot Backups',
        'Fast Setup & Support'
      ],
      locations: ['us-east', 'eu-central', 'ap-south']
    };

    const isEdit = !!editingPlanId;
    const url = isEdit ? `/admin/plans/${editingPlanId}` : '/admin/plans/create';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiRequest(url, {
      method,
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('success', res.message || `Plan ${isEdit ? 'updated' : 'created'} successfully`);
      setShowModal(false);
      fetchPlans();
    } else {
      showToast('error', res.error?.message || 'Failed to save plan');
    }
  };

  const handleDeletePlan = async (p: Plan) => {
    if (!window.confirm(`Are you sure you want to delete plan tier '${p.name}'?`)) return;

    const res = await apiRequest(`/admin/plans/${p.id}`, { method: 'DELETE' });
    if (res.success) {
      showToast('success', `Plan '${p.name}' deleted`);
      fetchPlans();
    } else {
      showToast('error', res.error?.message || 'Failed to delete plan');
    }
  };

  const filteredPlans = plans.filter(p =>
    selectedProductFilter === 'all' || p.productId === selectedProductFilter
  );

  const genOptionId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const handleOpenEggModal = (prod: Product) => {
    setEggModalProduct(prod);
    setEggOptionsDraft((prod.panelEggOptions || []).map(o => ({ ...o })));
    setLocationOptionsDraft((prod.panelLocationOptions || []).map(o => ({ ...o })));
    setShowEggModal(true);
  };

  const addEggOption = () => {
    setEggOptionsDraft(prev => [...prev, { id: genOptionId('egg'), label: '', nestId: 0, eggId: 0, dockerImage: '', startupCommand: '' }]);
  };
  const updateEggOption = (id: string, patch: Partial<PanelEggOption>) => {
    setEggOptionsDraft(prev => prev.map(o => (o.id === id ? { ...o, ...patch } : o)));
  };
  const removeEggOption = (id: string) => {
    setEggOptionsDraft(prev => prev.filter(o => o.id !== id));
  };

  const addLocationOption = () => {
    setLocationOptionsDraft(prev => [...prev, { id: genOptionId('loc'), label: '', locationId: 0 }]);
  };
  const updateLocationOption = (id: string, patch: Partial<PanelLocationOption>) => {
    setLocationOptionsDraft(prev => prev.map(o => (o.id === id ? { ...o, ...patch } : o)));
  };
  const removeLocationOption = (id: string) => {
    setLocationOptionsDraft(prev => prev.filter(o => o.id !== id));
  };

  const handleSaveEggMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eggModalProduct) return;
    setSavingEggMapping(true);

    const res = await apiRequest(`/admin/products/${eggModalProduct.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        panelEggOptions: eggOptionsDraft
          .filter(o => o.label.trim() && o.nestId && o.eggId)
          .map(o => ({
            id: o.id,
            label: o.label.trim(),
            nestId: Number(o.nestId),
            eggId: Number(o.eggId),
            dockerImage: o.dockerImage?.trim() || undefined,
            startupCommand: o.startupCommand?.trim() || undefined
          })),
        panelLocationOptions: locationOptionsDraft
          .filter(o => o.label.trim() && o.locationId)
          .map(o => ({ id: o.id, label: o.label.trim(), locationId: Number(o.locationId), tier: o.tier }))
      })
    });

    if (res.success) {
      showToast('success', res.message || 'Panel deployment mapping saved');
      setShowEggModal(false);
      fetchPlans();
    } else {
      showToast('error', res.error?.message || 'Failed to save panel mapping');
    }
    setSavingEggMapping(false);
  };

  const handleTestEggOption = async (productId: string, optionId: string) => {
    setTestingOptionId(optionId);
    setEggTestResults(prev => {
      const next = { ...prev };
      delete next[optionId];
      return next;
    });
    const res = await apiRequest(`/admin/products/${productId}/test-egg`, {
      method: 'POST',
      body: JSON.stringify({ optionId })
    });
    setEggTestResults(prev => ({
      ...prev,
      [optionId]: res.success
        ? { type: 'success', text: res.message || 'Egg found on the panel.' }
        : { type: 'error', text: res.error?.message || 'Test failed.' }
    }));
    setTestingOptionId(null);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Toast Notification */}
      {feedback && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between transition-all ${
          feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="h-6 w-6 text-amber-400" /> Products & Plan Specifications
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Configure RAM, vCPU cores, NVMe storage quotas, pricing models, and allowed deployments.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPlans}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all shrink-0"
            title="Refresh Plans"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 transition-all"
          >
            <Plus className="h-4 w-4" /> Create New Plan
          </button>
        </div>
      </div>

      {/* Panel Deployment Mapping */}
      {!loading && products.length > 0 && (
        <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Panel Deployment Mapping</h3>
          </div>
          <p className="text-[11px] text-zinc-500 -mt-2">
            Map each product category to a nest/egg on your linked hosting panel so checkout can auto-create servers. Connect the panel itself under Panel Integration.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {products.map((prod) => {
              const eggOpts = prod.panelEggOptions || [];
              const locOpts = prod.panelLocationOptions || [];
              const isMapped = eggOpts.length > 0;

              return (
                <div key={prod.id} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-white">{prod.name}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {isMapped
                          ? `${eggOpts.length} application option${eggOpts.length > 1 ? 's' : ''} · ${locOpts.length} location option${locOpts.length === 1 ? '' : 's'}`
                          : 'Not mapped — orders fall back to manual setup'}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono border ${isMapped ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                      {isMapped ? 'Mapped' : 'Unmapped'}
                    </span>
                  </div>

                  {eggOpts.length > 0 && (
                    <div className="space-y-1.5">
                      {eggOpts.map(opt => {
                        const result = eggTestResults[opt.id];
                        return (
                          <div key={opt.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="flex-1 text-[11px] text-zinc-300 font-mono truncate">
                                {opt.label} <span className="text-zinc-600">(nest {opt.nestId} / egg {opt.eggId})</span>
                              </span>
                              <button
                                onClick={() => handleTestEggOption(prod.id, opt.id)}
                                disabled={testingOptionId === opt.id}
                                className="shrink-0 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-semibold disabled:opacity-40"
                              >
                                {testingOptionId === opt.id ? 'Testing...' : 'Test'}
                              </button>
                            </div>
                            {result && (
                              <p className={`text-[10px] px-2 py-1 rounded-lg border flex items-center gap-1.5 ${result.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                {result.type === 'success' ? <ShieldCheck className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
                                {result.text}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {locOpts.length > 0 && (
                    <p className="text-[11px] text-zinc-500">
                      Locations: {locOpts.map(o => `${o.label}${o.tier ? ` (${o.tier === 'paid' ? 'Paid' : 'Free'})` : ''}`).join(', ')}
                    </p>
                  )}

                  <button
                    onClick={() => handleOpenEggModal(prod)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Server className="h-3.5 w-3.5" /> Edit Mapping
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setSelectedProductFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            selectedProductFilter === 'all'
              ? 'bg-amber-500 text-zinc-950 font-bold'
              : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
        >
          All Categories ({plans.length})
        </button>
        {products.map((prod) => (
          <button
            key={prod.id}
            onClick={() => setSelectedProductFilter(prod.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedProductFilter === prod.id
                ? 'bg-amber-500 text-zinc-950 font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            {prod.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400">Loading plan specifications...</div>
      ) : filteredPlans.length === 0 ? (
        <div className="p-12 text-center bg-zinc-900/60 border border-zinc-800 rounded-3xl text-zinc-400 text-xs space-y-2">
          <Package className="h-8 w-8 text-zinc-600 mx-auto" />
          <p>No plan specifications configured for this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {filteredPlans.map((p) => {
            const prod = products.find(pr => pr.id === p.productId);

            return (
              <div key={p.id} className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4 relative flex flex-col justify-between hover:border-zinc-700 transition-all">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-zinc-950 text-amber-400 border border-amber-500/20">
                        {prod?.name || p.productId}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1.5">{p.name}</h3>
                    </div>
                    <span className="text-base font-extrabold text-amber-400 font-mono">
                      {p.priceMonthly === 0 ? 'FREE' : `$${p.priceMonthly.toFixed(2)}/mo`}
                    </span>
                  </div>

                  {p.description && (
                    <p className="text-xs text-zinc-400 mb-3">{p.description}</p>
                  )}

                  <div className="space-y-1.5 text-xs text-zinc-300 font-mono bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">RAM:</span>
                      <strong className="text-white">{(p.ramMB / 1024).toFixed(1)} GB ({p.ramMB} MB)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">CPU Allocation:</span>
                      <strong className="text-white">{p.cpuCores} vCPU Core(s)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">NVMe Storage:</span>
                      <strong className="text-white">{p.diskGB} GB</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Backup Slots:</span>
                      <strong className="text-white">{p.backupLimit || 2}</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${p.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                    {p.isActive ? 'Active Plan' : 'Archived'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(p)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all"
                      title="Edit Plan"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeletePlan(p)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                      title="Delete Plan"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Plan Modal (Create / Edit) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleSavePlan} className="w-full max-w-lg bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingPlanId ? 'Edit Plan Tier' : 'Create New Plan Tier'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Product Category</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
              >
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id}>{prod.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Plan Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nether Titan"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Description (Optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. High-frequency compute with dedicated CPU threads"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">RAM (MB)</label>
                <input
                  type="number"
                  min="512"
                  step="512"
                  value={ramMB}
                  onChange={(e) => setRamMB(Number(e.target.value))}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1">CPU Cores</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={cpuCores}
                  onChange={(e) => setCpuCores(Number(e.target.value))}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1">NVMe Disk (GB)</label>
                <input
                  type="number"
                  min="5"
                  value={diskGB}
                  onChange={(e) => setDiskGB(Number(e.target.value))}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Price Monthly ($ USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceMonthly}
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    setPriceMonthly(m);
                    setPriceYearly(parseFloat((m * 10).toFixed(2)));
                  }}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1">Price Yearly ($ USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceYearly}
                  onChange={(e) => setPriceYearly(Number(e.target.value))}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Backup Limit</label>
                <input
                  type="number"
                  min="0"
                  value={backupLimit}
                  onChange={(e) => setBackupLimit(Number(e.target.value))}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1">Max Server Containers</label>
                <input
                  type="number"
                  min="1"
                  value={serverLimit}
                  onChange={(e) => setServerLimit(Number(e.target.value))}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-xs text-zinc-950 font-bold rounded-xl"
              >
                Save Plan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Panel Deployment Mapping Modal */}
      {showEggModal && eggModalProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleSaveEggMapping} className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">Panel Deployment Mapping — {eggModalProduct.name}</h3>
              <button type="button" onClick={() => setShowEggModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Egg (application) options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-white">Application (Egg) Options</p>
                  <p className="text-[11px] text-zinc-500">What customers can choose to deploy — e.g. Node.js, Python. Nest/Egg IDs come from your panel's admin area.</p>
                </div>
                <button
                  type="button"
                  onClick={addEggOption}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-semibold flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>

              {eggOptionsDraft.length === 0 && (
                <p className="text-[11px] text-zinc-600 italic">No application options yet — orders will fall back to manual setup.</p>
              )}

              {eggOptionsDraft.map((opt) => (
                <div key={opt.id} className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => updateEggOption(opt.id, { label: e.target.value })}
                      placeholder="e.g. Node.js"
                      className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white"
                    />
                    <button type="button" onClick={() => removeEggOption(opt.id)} className="shrink-0 text-zinc-500 hover:text-rose-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={opt.nestId || ''}
                      onChange={(e) => updateEggOption(opt.id, { nestId: Number(e.target.value) })}
                      placeholder="Nest ID"
                      className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white font-mono"
                    />
                    <input
                      type="number"
                      value={opt.eggId || ''}
                      onChange={(e) => updateEggOption(opt.id, { eggId: Number(e.target.value) })}
                      placeholder="Egg ID"
                      className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <input
                    type="text"
                    value={opt.dockerImage || ''}
                    onChange={(e) => updateEggOption(opt.id, { dockerImage: e.target.value })}
                    placeholder="Docker image (optional — uses egg default)"
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={opt.startupCommand || ''}
                    onChange={(e) => updateEggOption(opt.id, { startupCommand: e.target.value })}
                    placeholder="Startup command (optional — uses egg default)"
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white font-mono"
                  />
                </div>
              ))}
            </div>

            {/* Location/node options */}
            <div className="space-y-3 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-white">Location / Node Options</p>
                  <p className="text-[11px] text-zinc-500">Where customers can choose to deploy, tagged Free or Paid. Leave empty to use the panel-wide default location.</p>
                </div>
                <button
                  type="button"
                  onClick={addLocationOption}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-semibold flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>

              {locationOptionsDraft.length === 0 && (
                <p className="text-[11px] text-zinc-600 italic">No location options — will use the panel-wide default location.</p>
              )}

              {locationOptionsDraft.map((opt) => (
                <div key={opt.id} className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => updateLocationOption(opt.id, { label: e.target.value })}
                    placeholder="e.g. Germany"
                    className="flex-1 min-w-[100px] rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={opt.locationId || ''}
                    onChange={(e) => updateLocationOption(opt.id, { locationId: Number(e.target.value) })}
                    placeholder="Location ID"
                    className="w-28 rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white font-mono"
                  />
                  <select
                    value={opt.tier || ''}
                    onChange={(e) => updateLocationOption(opt.id, { tier: e.target.value === 'paid' ? 'paid' : e.target.value === 'free' ? 'free' : undefined })}
                    className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white"
                  >
                    <option value="">No tag</option>
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                  <button type="button" onClick={() => removeLocationOption(opt.id)} className="shrink-0 text-zinc-500 hover:text-rose-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowEggModal(false)}
                className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEggMapping}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-xs text-zinc-950 font-bold rounded-xl disabled:opacity-50"
              >
                {savingEggMapping ? 'Saving...' : 'Save Mapping'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

