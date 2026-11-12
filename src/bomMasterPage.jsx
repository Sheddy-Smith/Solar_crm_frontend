import { useCallback, useEffect, useState } from 'react';
import { Layers3, Plus, RefreshCw, CheckCircle2 } from 'lucide-react';
import { bomApi } from './api.js';

const CARD = 'rounded-[12px] border border-[#e5eaf2] bg-white shadow-[0_2px_10px_rgba(24,48,87,0.05)]';

/**
 * BOM & Pricing Master — configure versioned capacity kits (3/4/5/6 kW…).
 * Quantities are never invented; empty shells stay pending_configuration until admin fills lines.
 */
export function BomMasterPage({ onNotify }) {
  const [capacities, setCapacities] = useState([]);
  const [selectedCapacityId, setSelectedCapacityId] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lineDraft, setLineDraft] = useState({ material_name: '', category: '', unit: 'Nos', quantity: '', unit_price: '' });
  const [saving, setSaving] = useState(false);

  const notify = onNotify || (() => {});

  const loadCapacities = useCallback(async () => {
    setLoading(true);
    try {
      await bomApi.ensureDefaults().catch(() => null);
      const data = await bomApi.capacities();
      const rows = Array.isArray(data) ? data : (data?.results || []);
      setCapacities(rows);
      if (!selectedCapacityId && rows[0]) setSelectedCapacityId(rows[0].id);
    } catch (err) {
      notify(err?.message || 'BOM capacities failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, selectedCapacityId]);

  const loadVersions = useCallback(async (capacityId) => {
    if (!capacityId) return;
    try {
      const data = await bomApi.versions({ capacity_config: capacityId });
      const rows = Array.isArray(data) ? data : (data?.results || []);
      setVersions(rows);
      setSelectedVersion(rows[0] || null);
    } catch (err) {
      notify(err?.message || 'BOM versions failed', 'error');
    }
  }, [notify]);

  useEffect(() => { loadCapacities(); }, [loadCapacities]);
  useEffect(() => { if (selectedCapacityId) loadVersions(selectedCapacityId); }, [selectedCapacityId, loadVersions]);

  const addLineLocal = () => {
    if (!selectedVersion) return;
    if (!lineDraft.material_name.trim()) {
      notify('Material name required', 'error');
      return;
    }
    const lines = [...(selectedVersion.lines || []), {
      ...lineDraft,
      quantity: lineDraft.quantity || '0',
      unit_price: lineDraft.unit_price || '0',
      sort_order: (selectedVersion.lines || []).length,
    }];
    setSelectedVersion({ ...selectedVersion, lines });
    setLineDraft({ material_name: '', category: '', unit: 'Nos', quantity: '', unit_price: '' });
  };

  const saveVersion = async () => {
    if (!selectedVersion) return;
    setSaving(true);
    try {
      const payload = {
        capacity_config_id: selectedVersion.capacity_config_id || selectedCapacityId,
        labour_cost: selectedVersion.labour_cost || 0,
        other_charges: selectedVersion.other_charges || 0,
        tax_percent: selectedVersion.tax_percent || 0,
        final_project_price: selectedVersion.final_project_price || null,
        notes: selectedVersion.notes || '',
        pending_configuration: !(selectedVersion.lines || []).length,
        lines: (selectedVersion.lines || []).map((l, i) => ({
          category: l.category || '',
          material_name: l.material_name,
          sku: l.sku || '',
          unit: l.unit || 'Nos',
          quantity: l.quantity || 0,
          unit_price: l.unit_price || 0,
          sort_order: i,
          inventory_item: l.inventory_item || null,
        })),
      };
      let saved;
      if (selectedVersion.id) {
        saved = await bomApi.updateVersion(selectedVersion.id, payload);
      } else {
        saved = await bomApi.createVersion(payload);
      }
      setSelectedVersion(saved);
      notify('BOM version saved', 'success');
      await loadVersions(selectedCapacityId);
    } catch (err) {
      notify(err?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const activate = async () => {
    if (!selectedVersion?.id) return;
    setSaving(true);
    try {
      const saved = await bomApi.activateVersion(selectedVersion.id);
      setSelectedVersion(saved);
      notify('BOM version activated', 'success');
      await loadCapacities();
      await loadVersions(selectedCapacityId);
    } catch (err) {
      notify(err?.detail || err?.message || 'Activate failed — add material lines first', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedCapacity = capacities.find((c) => c.id === selectedCapacityId);
  const isActiveBom = selectedVersion?.status === 'Active';
  const canMutateBom = Boolean(selectedVersion) && !isActiveBom;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-[10px] bg-[#0d9f4a] text-white">
            <Layers3 className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-[22px] font-extrabold text-[#1e3261]">BOM &amp; Pricing Master</h1>
            <p className="mt-1 text-[13px] font-semibold text-[#53647f]">
              Configure versioned material kits per kW. Empty shells stay pending until you enter real quantities — nothing is hardcoded.
            </p>
          </div>
        </div>
        <button type="button" onClick={loadCapacities} className="inline-flex items-center gap-2 rounded-[8px] border border-[#d9e2ec] bg-white px-3 py-2 text-[12px] font-extrabold text-[#1e3261]">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className={`${CARD} p-8 text-center text-[13px] font-bold text-[#8895ab]`}>Loading BOM capacities…</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <aside className={`${CARD} p-3`}>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[#8895ab]">Capacities</p>
            <div className="space-y-1">
              {capacities.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCapacityId(c.id)}
                  className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-[13px] font-bold ${
                    selectedCapacityId === c.id ? 'bg-[#e8f8ee] text-[#0d9f4a]' : 'text-[#1e3261] hover:bg-[#f5f7fb]'
                  }`}
                >
                  <span>{c.label || `${c.capacity_kw} kW`}</span>
                  {c.active_version ? <CheckCircle2 className="size-3.5 text-[#0d9f4a]" /> : null}
                </button>
              ))}
            </div>
          </aside>

          <section className="space-y-4">
            <div className={`${CARD} p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[16px] font-extrabold text-[#1e3261]">{selectedCapacity?.label || 'Select capacity'}</h2>
                  <p className="text-[12px] font-semibold text-[#8895ab]">
                    {versions.length} version(s) · Active: {selectedCapacity?.active_version ? `v${selectedCapacity.active_version.version_number}` : 'none'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedVersion({
                      capacity_config_id: selectedCapacityId,
                      labour_cost: 0,
                      other_charges: 0,
                      tax_percent: 0,
                      final_project_price: null,
                      notes: '',
                      pending_configuration: true,
                      lines: [],
                      status: 'Draft',
                    })}
                    className="inline-flex items-center gap-1 rounded-[8px] bg-[#0b65e5] px-3 py-2 text-[12px] font-extrabold text-white"
                  >
                    <Plus className="size-3.5" /> New Version
                  </button>
                  <button
                    type="button"
                    disabled={saving || !canMutateBom}
                    onClick={saveVersion}
                    className="rounded-[8px] border border-[#d9e2ec] bg-white px-3 py-2 text-[12px] font-extrabold disabled:opacity-50"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    disabled={saving || !selectedVersion?.id || isActiveBom}
                    onClick={activate}
                    className="rounded-[8px] bg-[#0d9f4a] px-3 py-2 text-[12px] font-extrabold text-white disabled:opacity-50"
                  >
                    Activate
                  </button>
                </div>
              </div>

              {versions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {versions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVersion(v)}
                      className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                        selectedVersion?.id === v.id ? 'bg-[#1e3261] text-white' : 'bg-[#f0f3f8] text-[#53647f]'
                      }`}
                    >
                      v{v.version_number} · {v.status}{v.pending_configuration ? ' · pending' : ''}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {selectedVersion ? (
              <div className={`${CARD} space-y-4 p-4`}>
                {selectedVersion.status === 'Active' ? (
                  <p className="rounded-[8px] border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[12px] font-semibold text-[#92400e]">
                    Active BOM is immutable. Create a New Version to change materials or pricing, then Activate it.
                  </p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['labour_cost', 'Labour cost'],
                    ['other_charges', 'Other charges'],
                    ['tax_percent', 'Tax %'],
                    ['final_project_price', 'Fixed project price (optional)'],
                  ].map(([key, label]) => (
                    <label key={key} className="block text-[11px] font-extrabold text-[#8895ab]">
                      {label}
                      <input
                        disabled={!canMutateBom}
                        className="mt-1 w-full rounded-[8px] border border-[#d9e2ec] px-3 py-2 text-[13px] font-bold text-[#1e3261] disabled:bg-[#f5f7fb]"
                        value={selectedVersion[key] ?? ''}
                        onChange={(e) => setSelectedVersion({ ...selectedVersion, [key]: e.target.value })}
                      />
                    </label>
                  ))}
                </div>

                <div>
                  <p className="mb-2 text-[12px] font-extrabold text-[#1e3261]">Material lines</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-[12px]">
                      <thead className="bg-[#f5f7fb] text-[#8895ab]">
                        <tr>
                          <th className="px-2 py-2">Category</th>
                          <th className="px-2 py-2">Material</th>
                          <th className="px-2 py-2">Unit</th>
                          <th className="px-2 py-2">Qty</th>
                          <th className="px-2 py-2">Unit price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedVersion.lines || []).map((line, idx) => (
                          <tr key={idx} className="border-t border-[#eef2f7]">
                            <td className="px-2 py-2">{line.category || '—'}</td>
                            <td className="px-2 py-2 font-bold text-[#1e3261]">{line.material_name}</td>
                            <td className="px-2 py-2">{line.unit}</td>
                            <td className="px-2 py-2">{line.quantity}</td>
                            <td className="px-2 py-2">{line.unit_price}</td>
                          </tr>
                        ))}
                        {(selectedVersion.lines || []).length === 0 ? (
                          <tr><td colSpan={5} className="px-2 py-4 text-center text-[#8895ab]">No lines yet — pending configuration</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-5">
                    <input disabled={!canMutateBom} placeholder="Category" className="rounded-[8px] border border-[#d9e2ec] px-2 py-2 text-[12px] disabled:bg-[#f5f7fb]" value={lineDraft.category} onChange={(e) => setLineDraft({ ...lineDraft, category: e.target.value })} />
                    <input disabled={!canMutateBom} placeholder="Material name *" className="rounded-[8px] border border-[#d9e2ec] px-2 py-2 text-[12px] sm:col-span-2 disabled:bg-[#f5f7fb]" value={lineDraft.material_name} onChange={(e) => setLineDraft({ ...lineDraft, material_name: e.target.value })} />
                    <input disabled={!canMutateBom} placeholder="Qty" className="rounded-[8px] border border-[#d9e2ec] px-2 py-2 text-[12px] disabled:bg-[#f5f7fb]" value={lineDraft.quantity} onChange={(e) => setLineDraft({ ...lineDraft, quantity: e.target.value })} />
                    <input disabled={!canMutateBom} placeholder="Unit price" className="rounded-[8px] border border-[#d9e2ec] px-2 py-2 text-[12px] disabled:bg-[#f5f7fb]" value={lineDraft.unit_price} onChange={(e) => setLineDraft({ ...lineDraft, unit_price: e.target.value })} />
                  </div>
                  <button
                    type="button"
                    disabled={!canMutateBom}
                    onClick={addLineLocal}
                    className="mt-2 rounded-[8px] border border-[#d9e2ec] px-3 py-2 text-[12px] font-extrabold disabled:opacity-50"
                  >
                    Add line
                  </button>
                </div>
              </div>
            ) : (
              <div className={`${CARD} p-8 text-center text-[13px] font-bold text-[#8895ab]`}>Select or create a BOM version.</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
