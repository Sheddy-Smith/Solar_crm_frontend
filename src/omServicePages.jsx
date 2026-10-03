import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Calendar, Camera, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList,
  Eraser, Eye, MapPin, Pencil, Phone, Play, Plus, RefreshCw, Siren, Trash2, UserCheck, Wrench, XCircle,
} from 'lucide-react';
import { getMediaUrl, omDocumentApi, omMaintenanceApi, omTicketApi, omVisitApi } from './api.js';
import { moduleCaps } from './settingsHubPages.jsx';
import { MobileRecordCard } from './components/mobile/MobileRecordCard.jsx';
import {
  BTN_GREEN, BTN_OUTLINE, BTN_PRIMARY, BTN_SMALL, CounterTile, DataList, DetailGrid, Field, FilterChips, INPUT,
  Modal, OmHeading, PANEL, Pill, PlantPicker, SearchBox, SelectInput, TEXTAREA, addDaysIso, cx, daysText,
  fmtDate, fmtDateTime, fmtMoney, normalizeApiRows, todayIso, useEngineers, usePlantOptions,
} from './omUi.jsx';

export const COMPLAINT_TYPES = [
  'Inverter Error', 'Low Generation', 'No Generation', 'Panel Damage', 'Panel Cleaning', 'Wiring / Cable',
  'Earthing', 'Meter / Net Meter', 'Structure', 'Monitoring / App', 'Other',
];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const TICKET_STATUSES = ['Open', 'Assigned', 'In Progress', 'Site Visit', 'Resolved', 'Closed'];
const TASK_STATUSES = ['Scheduled', 'Pending', 'Assigned', 'Accepted', 'In Progress', 'Completed', 'Cancelled'];
const TASK_OPEN = (t) => !['Completed', 'Cancelled'].includes(t.status);
const SERVICE_TYPES = ['Quarterly', 'Complaint', 'Emergency', 'Inspection', 'Other'];
const FINAL_STATUSES = ['Resolved', 'Partially Resolved', 'Pending Parts', 'Revisit Required'];
const MATERIALS = ['MC4 Connector', 'DC Fuse', 'AC Fuse', 'MCB', 'MCCB', 'Cable', 'SPD', 'Fan', 'Inverter Card', 'Connector', 'Other'];
export const INSPECTION_ITEMS = [
  ['inverter', 'Inverter'], ['panel', 'Solar Panels'], ['structure', 'Structure'], ['cable', 'Cables / Wiring'],
  ['earthing', 'Earthing'], ['acdb_dcdb', 'ACDB / DCDB'], ['cleaning', 'Panel Cleaning'], ['meter', 'Meter / Net Meter'],
];

export function omCaps(user) {
  const om = moduleCaps(user, 'O&M');
  const field = moduleCaps(user, 'O&M Field Work');
  return { ...om, field: field.any, fieldOnly: !om.any && field.any };
}

function useRows(loader, deps) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    loader()
      .then((r) => { if (alive) setRows(normalizeApiRows(r)); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { rows, loading, reload };
}

function stop(fn) {
  return (e) => { e.stopPropagation(); fn(); };
}

function mapsUrl(text) {
  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : '';
}

function errMsg(e, fallback) {
  return e?.message || fallback;
}

// ── Signature pad (canvas, no dependency) ─────────────────────────────────────

export function SignaturePad({ value, onChange, height = 180 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 320;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = value;
    }
    // Only on mount: redrawing on every value change would flicker mid-stroke.
  }, [height]);

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const down = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        style={{ touchAction: 'none', height }}
        className="block w-full rounded-[12px] border-2 border-dashed border-[#c7d4e6] bg-white"
      />
      <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-[#8a98af]">
        <span>{value ? 'Signature captured' : 'Customer signs inside the box'}</span>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 font-extrabold text-[#dc2626]">
          <Eraser className="size-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}

async function compressImage(file, maxSide = 1600, quality = 0.8) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function PhotoPicker({ label, files, onChange }) {
  const inputRef = useRef(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const add = async (list) => {
    const picked = await Promise.all(Array.from(list || []).map((f) => compressImage(f)));
    onChange([...files, ...picked]);
  };
  return (
    <div className="rounded-[12px] border border-[#e7eef7] bg-[#fbfcfe] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[13px] font-extrabold text-[#1e3261]">{label} <span className="text-[#8a98af]">({files.length})</span></p>
        <button type="button" onClick={() => inputRef.current?.click()} className={BTN_SMALL}>
          <Camera className="size-3.5" /> Add photo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => { add(e.target.files); e.target.value = ''; }}
        />
      </div>
      {files.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previews.map((src, i) => (
            <div key={src} className="relative overflow-hidden rounded-[10px] border border-[#e2e8f0] bg-white">
              <img src={src} alt={`${label} ${i + 1}`} className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                aria-label="Remove photo"
                className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/55 text-white"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] font-semibold text-[#8a98af]">No photos yet — tap “Add photo” to open the camera.</p>
      )}
    </div>
  );
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const WIZARD_STEPS = ['Visit', 'Inspection', 'Work Done', 'Parts', 'Photos', 'Sign & Submit'];

/**
 * Engineer service form: step-by-step on phones; saves one permanent visit via
 * /om/site-visits/complete/ which also closes the task and the linked ticket.
 */
export function ServiceFormWizard({ task, ticket, plant, onClose, onDone, onNotify }) {
  const fixedPlantId = task?.plant || ticket?.plant || plant?.id || '';
  const plants = usePlantOptions(!fixedPlantId);
  const linkedTicket = ticket || (task?.ticket ? { id: task.ticket, record_no: task.ticket_no, subject: task.ticket_subject } : null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    plant: fixedPlantId ? String(fixedPlantId) : '',
    date: todayIso(),
    arrival_time: nowTime(),
    departure_time: '',
    plant_generation_kwh: '',
    service_type: task?.source === 'Quarterly' ? 'Quarterly' : linkedTicket ? 'Complaint' : 'Inspection',
    complaint: ticket?.issue_description || ticket?.subject || task?.ticket_subject || '',
    fault_found: '',
    diagnosis: '',
    work_done: '',
    final_status: linkedTicket ? 'Resolved' : '',
    labour_cost: '',
    engineer_notes: '',
    customer_remarks: '',
  }));
  const [inspection, setInspection] = useState(() => Object.fromEntries(INSPECTION_ITEMS.map(([k]) => [k, { status: 'OK', note: '' }])));
  const [checklist, setChecklist] = useState(() => (Array.isArray(task?.checklist) ? task.checklist.map((c) => ({ ...c, done: Boolean(c.done) })) : []));
  const [parts, setParts] = useState([]);
  const [before, setBefore] = useState([]);
  const [after, setAfter] = useState([]);
  const [signature, setSignature] = useState('');

  const set = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));
  const plantName = plant?.customer_name || task?.customer_name || ticket?.customer_name || '';
  const title = task ? `${task.record_no} · ${task.title}` : linkedTicket ? `${linkedTicket.record_no} · ${linkedTicket.subject}` : 'Log service visit';

  const stepError = (index) => {
    if (index === 0 && !form.plant) return 'Select the plant.';
    if (index === 2 && !form.work_done.trim()) return 'Write the work done.';
    return '';
  };

  const goNext = () => {
    const msg = stepError(step);
    if (msg) { onNotify?.(msg, 'error'); return; }
    setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1));
  };

  const submit = async () => {
    for (let i = 0; i < WIZARD_STEPS.length; i += 1) {
      const msg = stepError(i);
      if (msg) { setStep(i); onNotify?.(msg, 'error'); return; }
    }
    const fd = new FormData();
    if (task) fd.append('task', task.id);
    else if (linkedTicket) fd.append('ticket', linkedTicket.id);
    fd.append('plant', form.plant);
    Object.entries(form).forEach(([k, v]) => { if (k !== 'plant' && v !== '' && v != null) fd.append(k, v); });
    fd.append('inspection', JSON.stringify(inspection));
    if (checklist.length) fd.append('checklist', JSON.stringify(checklist));
    fd.append('parts', JSON.stringify(parts.filter((p) => p.material || p.description)));
    if (signature) fd.append('customer_signature', signature);
    before.forEach((f) => fd.append('before_photos', f));
    after.forEach((f) => fd.append('after_photos', f));
    setSaving(true);
    try {
      const visit = await omVisitApi.complete(fd);
      onNotify?.(`${visit.record_no} saved${linkedTicket && (!form.final_status || form.final_status === 'Resolved') ? ' — ticket closed' : ''}.`, 'success');
      onDone?.(visit);
    } catch (e) {
      onNotify?.(errMsg(e, 'Could not save the service form.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const isLast = step === WIZARD_STEPS.length - 1;

  return (
    <Modal
      title="Service Form"
      subtitle={[title, plantName].filter(Boolean).join(' — ')}
      onClose={saving ? undefined : onClose}
      size="md"
      footer={(
        <div className="flex w-full items-center justify-between gap-2">
          <button type="button" className={BTN_OUTLINE} disabled={step === 0 || saving} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ChevronLeft className="size-4" /> Back
          </button>
          {isLast ? (
            <button type="button" className={BTN_GREEN} disabled={saving} onClick={submit}>
              <CheckCircle2 className="size-4" /> {saving ? 'Saving...' : 'Submit & Complete'}
            </button>
          ) : (
            <button type="button" className={BTN_PRIMARY} onClick={goNext}>
              Next <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      )}
    >
      <ol className="mb-4 grid grid-cols-6 gap-1">
        {WIZARD_STEPS.map((label, i) => (
          <li key={label}>
            <button type="button" onClick={() => (i < step || !stepError(step)) && setStep(i)} className="w-full text-left">
              <span className={cx('block h-1.5 rounded-full', i <= step ? 'bg-[#0b65e5]' : 'bg-[#e2e8f0]')} />
              <span className={cx('mt-1 hidden truncate text-[10px] font-extrabold sm:block', i === step ? 'text-[#0b65e5]' : 'text-[#8a98af]')}>{label}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mb-3 text-[12px] font-extrabold uppercase tracking-wide text-[#0b65e5] sm:hidden">Step {step + 1} / {WIZARD_STEPS.length} · {WIZARD_STEPS[step]}</p>

      {step === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {!fixedPlantId ? (
            <Field label="Plant" required wide>
              <PlantPicker value={form.plant} onChange={set('plant')} plants={plants} />
            </Field>
          ) : null}
          <Field label="Visit Date" required><input type="date" className={INPUT} value={form.date} onChange={(e) => set('date')(e.target.value)} /></Field>
          <Field label="Service Type">
            <SelectInput value={form.service_type} onChange={set('service_type')} options={SERVICE_TYPES} disabled={Boolean(task)} />
          </Field>
          <Field label="Arrival Time"><input type="time" className={INPUT} value={form.arrival_time} onChange={(e) => set('arrival_time')(e.target.value)} /></Field>
          <Field label="Departure Time" hint="Leave blank to use the submit time"><input type="time" className={INPUT} value={form.departure_time} onChange={(e) => set('departure_time')(e.target.value)} /></Field>
          <Field label="Plant Generation (kWh)" wide hint="Lifetime / total reading from the inverter">
            <input type="number" inputMode="decimal" className={INPUT} value={form.plant_generation_kwh} onChange={(e) => set('plant_generation_kwh')(e.target.value)} />
          </Field>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-2.5">
          {INSPECTION_ITEMS.map(([key, label]) => {
            const row = inspection[key];
            return (
              <div key={key} className="rounded-[12px] border border-[#e7eef7] p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-extrabold text-[#1e3261]">{label}</span>
                  <div className="flex gap-1">
                    {['OK', 'Issue', 'N/A'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setInspection((p) => ({ ...p, [key]: { ...p[key], status: s } }))}
                        className={cx(
                          'h-9 min-w-[56px] rounded-[8px] border px-2 text-[12px] font-extrabold',
                          row.status === s
                            ? (s === 'OK' ? 'border-[#16a34a] bg-[#16a34a] text-white' : s === 'Issue' ? 'border-[#dc2626] bg-[#dc2626] text-white' : 'border-[#64748b] bg-[#64748b] text-white')
                            : 'border-[#d9e4f2] bg-white text-[#53647f]',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {row.status === 'Issue' ? (
                  <input
                    className={cx(INPUT, 'mt-2')}
                    placeholder="What is the issue?"
                    value={row.note}
                    onChange={(e) => setInspection((p) => ({ ...p, [key]: { ...p[key], note: e.target.value } }))}
                  />
                ) : null}
              </div>
            );
          })}
          {checklist.length ? (
            <div className="rounded-[12px] border border-[#e7eef7] p-3">
              <p className="mb-2 text-[13px] font-extrabold text-[#1e3261]">Service checklist</p>
              <div className="space-y-1.5">
                {checklist.map((c, i) => (
                  <label key={c.label} className="flex items-center gap-2.5 text-[13px] font-semibold text-[#1e3261]">
                    <input
                      type="checkbox"
                      className="size-5 accent-[#16a34a]"
                      checked={c.done}
                      onChange={(e) => setChecklist((p) => p.map((x, idx) => (idx === i ? { ...x, done: e.target.checked } : x)))}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Complaint" wide><textarea className={TEXTAREA} value={form.complaint} onChange={(e) => set('complaint')(e.target.value)} /></Field>
          <Field label="Fault Found" wide><textarea className={TEXTAREA} value={form.fault_found} onChange={(e) => set('fault_found')(e.target.value)} /></Field>
          <Field label="Diagnosis" wide><textarea className={TEXTAREA} value={form.diagnosis} onChange={(e) => set('diagnosis')(e.target.value)} /></Field>
          <Field label="Work Done" required wide><textarea className={TEXTAREA} value={form.work_done} onChange={(e) => set('work_done')(e.target.value)} /></Field>
          <Field label="Final Status" hint={linkedTicket ? 'Resolved closes the ticket automatically' : undefined}>
            <SelectInput value={form.final_status} onChange={set('final_status')} options={FINAL_STATUSES} placeholder={linkedTicket ? undefined : '—'} />
          </Field>
          <Field label="Labour Cost (₹)"><input type="number" inputMode="decimal" className={INPUT} value={form.labour_cost} onChange={(e) => set('labour_cost')(e.target.value)} /></Field>
          <Field label="Engineer Notes" wide><textarea className={TEXTAREA} value={form.engineer_notes} onChange={(e) => set('engineer_notes')(e.target.value)} /></Field>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-2.5">
          {parts.map((p, i) => {
            const upd = (key) => (v) => setParts((list) => list.map((x, idx) => (idx === i ? { ...x, [key]: v } : x)));
            return (
              <div key={p.key} className="grid grid-cols-2 gap-2 rounded-[12px] border border-[#e7eef7] p-2.5 sm:grid-cols-5">
                <div className="col-span-2 sm:col-span-1"><SelectInput value={p.material} onChange={upd('material')} options={MATERIALS} /></div>
                <input className={cx(INPUT, 'col-span-2')} placeholder="Description / rating" value={p.description} onChange={(e) => upd('description')(e.target.value)} />
                <input className={INPUT} type="number" inputMode="decimal" placeholder="Qty" value={p.quantity} onChange={(e) => upd('quantity')(e.target.value)} />
                <input className={INPUT} type="number" inputMode="decimal" placeholder="Unit ₹" value={p.unit_cost} onChange={(e) => upd('unit_cost')(e.target.value)} />
                <input className={cx(INPUT, 'col-span-2 sm:col-span-4')} placeholder="Serial number (if any)" value={p.serial_number} onChange={(e) => upd('serial_number')(e.target.value)} />
                <button type="button" onClick={() => setParts((list) => list.filter((_, idx) => idx !== i))} className={cx(BTN_SMALL, 'col-span-2 justify-center text-[#dc2626] sm:col-span-1')}>
                  <Trash2 className="size-3.5" /> Remove
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className={cx(BTN_OUTLINE, 'w-full')}
            onClick={() => setParts((list) => [...list, { key: `${Date.now()}-${list.length}`, material: 'MC4 Connector', description: '', quantity: '1', unit_cost: '', serial_number: '' }])}
          >
            <Plus className="size-4" /> Add spare part used
          </button>
          {!parts.length ? <p className="text-center text-[12px] font-semibold text-[#8a98af]">No spare parts used? Just tap Next.</p> : null}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-3">
          <PhotoPicker label="Before photos" files={before} onChange={setBefore} />
          <PhotoPicker label="After photos" files={after} onChange={setAfter} />
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-3">
          <Field label="Customer Remarks"><textarea className={TEXTAREA} value={form.customer_remarks} onChange={(e) => set('customer_remarks')(e.target.value)} /></Field>
          <Field label="Customer Signature"><SignaturePad value={signature} onChange={setSignature} /></Field>
          <div className="rounded-[12px] bg-[#f8fafd] p-3 text-[12px] font-semibold text-[#53647f]">
            <p><b className="text-[#1e3261]">Work done:</b> {form.work_done || '—'}</p>
            <p className="mt-1">
              <b className="text-[#1e3261]">Inspection issues:</b>{' '}
              {INSPECTION_ITEMS.filter(([k]) => inspection[k].status === 'Issue').map(([, l]) => l).join(', ') || 'None'}
            </p>
            <p className="mt-1"><b className="text-[#1e3261]">Parts:</b> {parts.length} · <b className="text-[#1e3261]">Photos:</b> {before.length + after.length}</p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

// ── Visit detail (permanent record) ───────────────────────────────────────────

function inspectionRows(inspection) {
  if (!inspection || typeof inspection !== 'object') return [];
  return INSPECTION_ITEMS.filter(([k]) => inspection[k] != null).map(([k, label]) => {
    const v = inspection[k];
    return { label, status: typeof v === 'object' ? v.status : String(v), note: typeof v === 'object' ? v.note : '' };
  });
}

export function VisitDetailModal({ visitId, onClose, onNotify, canEdit, onChanged }) {
  const [visit, setVisit] = useState(null);
  const [docs, setDocs] = useState([]);
  useEffect(() => {
    let alive = true;
    omVisitApi.get(visitId).then((v) => { if (alive) setVisit(v); }).catch((e) => onNotify?.(errMsg(e, 'Could not load visit.'), 'error'));
    omDocumentApi.list({ module: 'Visit', related_id: visitId, page_size: 200 }).then((r) => { if (alive) setDocs(normalizeApiRows(r)); }).catch(() => {});
    return () => { alive = false; };
  }, [visitId, onNotify]);

  const cancelVisit = async () => {
    const reason = window.prompt('Reason for cancelling this visit?');
    if (reason == null) return;
    try {
      const v = await omVisitApi.cancel(visitId, reason);
      setVisit(v);
      onChanged?.();
      onNotify?.('Visit cancelled.', 'success');
    } catch (e) {
      onNotify?.(errMsg(e, 'Could not cancel.'), 'error');
    }
  };

  const insp = inspectionRows(visit?.inspection);
  return (
    <Modal title={visit ? `${visit.record_no} · ${visit.service_type}` : 'Service Visit'} subtitle={visit ? `${visit.plant_code} — ${visit.customer_name || visit.site}` : ''} onClose={onClose} size="lg"
      footer={visit && canEdit && !['Cancelled', 'Completed'].includes(visit.status)
        ? <button type="button" className={BTN_OUTLINE} onClick={cancelVisit}><XCircle className="size-4" /> Cancel visit</button>
        : null}
    >
      {!visit ? <p className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">Loading...</p> : (
        <div className="space-y-5">
          <DetailGrid rows={[
            ['Visit Date', fmtDate(visit.date)],
            ['Status', <Pill key="s">{visit.status}</Pill>],
            ['Engineer', visit.assigned_engineer_name || visit.engineer],
            ['Arrival / Departure', [visit.arrival_time?.slice(0, 5), visit.departure_time?.slice(0, 5)].filter(Boolean).join(' → ')],
            ['Task', visit.task ? `MT-${String(visit.task).padStart(4, '0')} ${visit.task_title || ''}` : ''],
            ['Ticket', visit.ticket_no],
            ['Plant Generation', visit.plant_generation_kwh ? `${Number(visit.plant_generation_kwh)} kWh` : ''],
            ['Final Status', visit.final_status ? <Pill key="f">{visit.final_status}</Pill> : ''],
            ['Labour Cost', fmtMoney(visit.labour_cost)],
            ['Spare Cost', fmtMoney(visit.spare_cost)],
            ['Next Service', fmtDate(visit.next_service_date)],
            ['Completed At', fmtDateTime(visit.completed_at)],
            ['Complaint', visit.complaint, true],
            ['Fault Found', visit.fault_found, true],
            ['Diagnosis', visit.diagnosis, true],
            ['Work Done', visit.work_done, true],
            ['Engineer Notes', visit.engineer_notes, true],
            ['Customer Remarks', visit.customer_remarks, true],
          ]} />

          {insp.length ? (
            <section>
              <h3 className="mb-2 text-[13px] font-extrabold text-[#1e3261]">Inspection</h3>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {insp.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-2 rounded-[10px] border border-[#eef2f8] px-3 py-2">
                    <span className="text-[12px] font-bold text-[#1e3261]">{r.label}{r.note ? <span className="block text-[11px] text-[#dc2626]">{r.note}</span> : null}</span>
                    <Pill>{r.status}</Pill>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {Array.isArray(visit.checklist) && visit.checklist.length ? (
            <section>
              <h3 className="mb-2 text-[13px] font-extrabold text-[#1e3261]">Checklist</h3>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {visit.checklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-[12px] font-semibold text-[#1e3261]">
                    {c.done ? <CheckCircle2 className="size-4 text-[#16a34a]" /> : <XCircle className="size-4 text-[#cbd5e1]" />}{c.label}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {visit.parts?.length ? (
            <section>
              <h3 className="mb-2 text-[13px] font-extrabold text-[#1e3261]">Spare parts used</h3>
              <div className="overflow-x-auto rounded-[10px] border border-[#eef2f8]">
                <table className="w-full min-w-[520px] text-left text-[12px]">
                  <thead className="bg-[#f8fafd] text-[11px] font-extrabold uppercase text-[#7386a3]">
                    <tr><th className="px-3 py-2">Material</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Serial</th><th className="px-3 py-2">Cost</th></tr>
                  </thead>
                  <tbody>
                    {visit.parts.map((p) => (
                      <tr key={p.id} className="border-t border-[#eef2f8] font-semibold text-[#1e3261]">
                        <td className="px-3 py-2">{p.material}</td><td className="px-3 py-2">{p.description || '—'}</td>
                        <td className="px-3 py-2">{Number(p.quantity)}</td><td className="px-3 py-2">{p.serial_number || '—'}</td>
                        <td className="px-3 py-2">{fmtMoney(p.total_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {docs.length ? (
            <section>
              <h3 className="mb-2 text-[13px] font-extrabold text-[#1e3261]">Photos</h3>
              {['Before', 'After', 'General'].map((cat) => {
                const list = docs.filter((d) => (d.category || 'General') === cat);
                if (!list.length) return null;
                return (
                  <div key={cat} className="mb-3">
                    <p className="mb-1.5 text-[11px] font-extrabold uppercase text-[#8a98af]">{cat}</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {list.map((d) => (
                        <a key={d.id} href={getMediaUrl(d.file)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-[10px] border border-[#e2e8f0]">
                          <img src={getMediaUrl(d.file)} alt={d.name} className="aspect-square w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          ) : null}

          {visit.customer_signature ? (
            <section>
              <h3 className="mb-2 text-[13px] font-extrabold text-[#1e3261]">Customer signature</h3>
              <img src={getMediaUrl(visit.customer_signature)} alt="Customer signature" className="h-28 rounded-[10px] border border-[#e2e8f0] bg-white object-contain p-1" />
            </section>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

// ── Ticket modals ─────────────────────────────────────────────────────────────

export function TicketFormModal({ ticket, plant, onClose, onSaved, onNotify }) {
  const engineers = useEngineers();
  const plants = usePlantOptions(!plant && !ticket);
  const [saving, setSaving] = useState(false);
  const [createTask, setCreateTask] = useState(true);
  const [form, setForm] = useState(() => ({
    plant: String(ticket?.plant || plant?.id || ''),
    subject: ticket?.subject || '',
    complaint_type: ticket?.complaint_type || 'Inverter Error',
    priority: ticket?.priority || 'Medium',
    contact_number: ticket?.contact_number || plant?.mobile_number || '',
    complaint_at: (ticket?.complaint_at || new Date().toISOString()).slice(0, 16),
    expected_visit_date: ticket?.expected_visit_date || '',
    assigned_to: ticket?.assigned_to ? String(ticket.assigned_to) : '',
    status: ticket?.status || 'Open',
    issue_description: ticket?.issue_description || '',
    resolution: ticket?.resolution || '',
    remarks: ticket?.remarks || '',
  }));
  const set = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));

  useEffect(() => {
    if (ticket || plant || !form.plant || form.contact_number) return;
    const p = plants.find((x) => String(x.id) === String(form.plant));
    if (p?.mobile_number) setForm((f) => ({ ...f, contact_number: p.mobile_number }));
  }, [form.plant, form.contact_number, plants, plant, ticket]);

  const save = async () => {
    if (!form.plant) { onNotify?.('Select the plant.', 'error'); return; }
    if (!form.subject.trim()) { onNotify?.('Enter the complaint subject.', 'error'); return; }
    const body = {
      ...form,
      plant: Number(form.plant),
      assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      expected_visit_date: form.expected_visit_date || null,
      complaint_at: form.complaint_at ? new Date(form.complaint_at).toISOString() : null,
    };
    if (!ticket) delete body.status;
    setSaving(true);
    try {
      const saved = ticket ? await omTicketApi.update(ticket.id, body) : await omTicketApi.create(body);
      if (!ticket && createTask && body.assigned_to) {
        await omTicketApi.createTask(saved.id, { assigned_engineer: body.assigned_to, visit_date: body.expected_visit_date });
      }
      onNotify?.(ticket ? `${saved.record_no} updated.` : `${saved.record_no} created${createTask && body.assigned_to ? ' and task assigned' : ''}.`, 'success');
      onSaved?.(saved);
    } catch (e) {
      onNotify?.(errMsg(e, 'Could not save ticket.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={ticket ? `Edit ${ticket.record_no}` : 'New Complaint Ticket'}
      subtitle={plant ? `${plant.plant_code} — ${plant.customer_name}` : undefined}
      onClose={onClose}
      footer={<>
        <button type="button" className={BTN_OUTLINE} onClick={onClose}>Cancel</button>
        <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save Ticket'}</button>
      </>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!plant && !ticket ? <Field label="Plant" required wide><PlantPicker value={form.plant} onChange={set('plant')} plants={plants} /></Field> : null}
        <Field label="Subject" required wide><input className={INPUT} value={form.subject} onChange={(e) => set('subject')(e.target.value)} placeholder="e.g. Inverter showing E-21" /></Field>
        <Field label="Complaint Type"><SelectInput value={form.complaint_type} onChange={set('complaint_type')} options={COMPLAINT_TYPES} /></Field>
        <Field label="Priority"><SelectInput value={form.priority} onChange={set('priority')} options={PRIORITIES} /></Field>
        <Field label="Contact Number"><input className={INPUT} inputMode="tel" value={form.contact_number} onChange={(e) => set('contact_number')(e.target.value)} /></Field>
        <Field label="Complaint Date & Time"><input type="datetime-local" className={INPUT} value={form.complaint_at} onChange={(e) => set('complaint_at')(e.target.value)} /></Field>
        <Field label="Assigned Engineer">
          <SelectInput value={form.assigned_to} onChange={set('assigned_to')} placeholder="Not assigned" options={engineers.map((u) => ({ value: String(u.id), label: u.role ? `${u.name} (${u.role})` : u.name }))} />
        </Field>
        <Field label="Expected Visit Date"><input type="date" className={INPUT} value={form.expected_visit_date} onChange={(e) => set('expected_visit_date')(e.target.value)} /></Field>
        {ticket ? <Field label="Status"><SelectInput value={form.status} onChange={set('status')} options={TICKET_STATUSES} /></Field> : null}
        <Field label="Issue Description" wide><textarea className={TEXTAREA} value={form.issue_description} onChange={(e) => set('issue_description')(e.target.value)} /></Field>
        {ticket ? <Field label="Resolution" wide><textarea className={TEXTAREA} value={form.resolution} onChange={(e) => set('resolution')(e.target.value)} /></Field> : null}
        <Field label="Remarks" wide><textarea className={TEXTAREA} value={form.remarks} onChange={(e) => set('remarks')(e.target.value)} /></Field>
        {!ticket && form.assigned_to ? (
          <label className="flex items-center gap-2 text-[13px] font-bold text-[#1e3261] sm:col-span-2">
            <input type="checkbox" className="size-5 accent-[#0b65e5]" checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} />
            Create a task for this engineer now
          </label>
        ) : null}
      </div>
    </Modal>
  );
}

function CreateTaskModal({ ticket, onClose, onSaved, onNotify }) {
  const engineers = useEngineers();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    assigned_engineer: ticket.assigned_to ? String(ticket.assigned_to) : '',
    visit_date: ticket.expected_visit_date || todayIso(),
    deadline: '',
    priority: ticket.priority || 'Medium',
    work_details: ticket.issue_description || '',
  });
  const set = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));
  const save = async () => {
    setSaving(true);
    try {
      const task = await omTicketApi.createTask(ticket.id, {
        ...form,
        assigned_engineer: form.assigned_engineer ? Number(form.assigned_engineer) : null,
        deadline: form.deadline || null,
      });
      onNotify?.(`${task.record_no} created${task.assigned_engineer_name ? ` for ${task.assigned_engineer_name}` : ''}.`, 'success');
      onSaved?.(task);
    } catch (e) {
      onNotify?.(errMsg(e, 'Could not create task.'), 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Create Task · ${ticket.record_no}`} subtitle={ticket.subject} onClose={onClose} size="sm"
      footer={<>
        <button type="button" className={BTN_OUTLINE} onClick={onClose}>Cancel</button>
        <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Create Task'}</button>
      </>}
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="Engineer">
          <SelectInput value={form.assigned_engineer} onChange={set('assigned_engineer')} placeholder="Assign later" options={engineers.map((u) => ({ value: String(u.id), label: u.name }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Visit Date"><input type="date" className={INPUT} value={form.visit_date} onChange={(e) => set('visit_date')(e.target.value)} /></Field>
          <Field label="Deadline"><input type="date" className={INPUT} value={form.deadline} onChange={(e) => set('deadline')(e.target.value)} /></Field>
        </div>
        <Field label="Priority"><SelectInput value={form.priority} onChange={set('priority')} options={PRIORITIES} /></Field>
        <Field label="Work Details"><textarea className={TEXTAREA} value={form.work_details} onChange={(e) => set('work_details')(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function ResolveModal({ ticket, onClose, onSaved, onNotify }) {
  const [resolution, setResolution] = useState(ticket.resolution || '');
  const [close, setClose] = useState(true);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!resolution.trim()) { onNotify?.('Write how the complaint was resolved.', 'error'); return; }
    setSaving(true);
    try {
      const saved = close ? await omTicketApi.close(ticket.id, resolution) : await omTicketApi.resolve(ticket.id, resolution);
      onNotify?.(`${ticket.record_no} ${close ? 'closed' : 'resolved'}.`, 'success');
      onSaved?.(saved);
    } catch (e) {
      onNotify?.(errMsg(e, 'Could not update ticket.'), 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Resolve · ${ticket.record_no}`} subtitle="Solved on phone / remotely — no site visit needed" onClose={onClose} size="sm"
      footer={<>
        <button type="button" className={BTN_OUTLINE} onClick={onClose}>Cancel</button>
        <button type="button" className={BTN_GREEN} disabled={saving} onClick={save}>{saving ? 'Saving...' : close ? 'Resolve & Close' : 'Mark Resolved'}</button>
      </>}
    >
      <div className="space-y-3">
        <Field label="Resolution" required><textarea className={TEXTAREA} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. Guided customer to restart inverter; generation normal" /></Field>
        <label className="flex items-center gap-2 text-[13px] font-bold text-[#1e3261]">
          <input type="checkbox" className="size-5 accent-[#16a34a]" checked={close} onChange={(e) => setClose(e.target.checked)} />
          Close the ticket now
        </label>
      </div>
    </Modal>
  );
}

function TicketDetailModal({ ticketId, caps, onClose, onNotify, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [visits, setVisits] = useState([]);
  const [tick, setTick] = useState(0);
  const [modal, setModal] = useState(null);
  useEffect(() => {
    let alive = true;
    omTicketApi.get(ticketId).then((t) => { if (alive) setTicket(t); }).catch((e) => onNotify?.(errMsg(e, 'Could not load ticket.'), 'error'));
    omMaintenanceApi.list({ ticket: ticketId, page_size: 100 }).then((r) => { if (alive) setTasks(normalizeApiRows(r)); }).catch(() => {});
    omVisitApi.list({ ticket: ticketId, page_size: 100 }).then((r) => { if (alive) setVisits(normalizeApiRows(r)); }).catch(() => {});
    return () => { alive = false; };
  }, [ticketId, tick, onNotify]);
  const refresh = () => { setTick((t) => t + 1); onChanged?.(); };
  const open = ticket && !['Resolved', 'Closed'].includes(ticket.status);

  return (
    <>
      <Modal
        title={ticket ? `${ticket.record_no} · ${ticket.subject}` : 'Ticket'}
        subtitle={ticket ? `${ticket.plant_code} — ${ticket.customer_name || ticket.site}` : ''}
        onClose={onClose}
        size="lg"
        footer={ticket && caps.edit ? (
          <>
            {open ? <button type="button" className={BTN_OUTLINE} onClick={() => setModal('task')}><ClipboardList className="size-4" /> Create Task</button> : null}
            {open ? <button type="button" className={BTN_OUTLINE} onClick={() => setModal('resolve')}><Phone className="size-4" /> Resolve on phone</button> : null}
            {ticket.status === 'Resolved' ? (
              <button type="button" className={BTN_GREEN} onClick={() => omTicketApi.close(ticket.id).then(() => { onNotify?.(`${ticket.record_no} closed.`, 'success'); refresh(); }).catch((e) => onNotify?.(errMsg(e, 'Close failed.'), 'error'))}>
                <CheckCircle2 className="size-4" /> Close Ticket
              </button>
            ) : null}
            <button type="button" className={BTN_OUTLINE} onClick={() => setModal('edit')}><Pencil className="size-4" /> Edit</button>
          </>
        ) : null}
      >
        {!ticket ? <p className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">Loading...</p> : (
          <div className="space-y-5">
            <DetailGrid rows={[
              ['Status', <span key="s" className="flex gap-1.5"><Pill>{ticket.status}</Pill>{ticket.is_overdue ? <Pill tone="red">Overdue</Pill> : null}</span>],
              ['Priority', <Pill key="p">{ticket.priority}</Pill>],
              ['Complaint Type', ticket.complaint_type],
              ['Complaint At', fmtDateTime(ticket.complaint_at)],
              ['Contact', ticket.contact_number ? <a key="c" className="text-[#0b65e5]" href={`tel:${ticket.contact_number}`}>{ticket.contact_number}</a> : ''],
              ['Assigned To', ticket.assigned_to_name],
              ['Expected Visit', fmtDate(ticket.expected_visit_date)],
              ['Resolved / Closed', [fmtDateTime(ticket.resolved_at), ticket.closed_at ? fmtDateTime(ticket.closed_at) : ''].filter((x) => x && x !== '—').join(' / ')],
              ['Issue', ticket.issue_description, true],
              ['Resolution', ticket.resolution, true],
              ['Remarks', ticket.remarks, true],
            ]} />
            <section>
              <h3 className="mb-2 text-[13px] font-extrabold text-[#1e3261]">Tasks ({tasks.length})</h3>
              {tasks.length ? tasks.map((t) => (
                <div key={t.id} className="mb-1.5 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#eef2f8] px-3 py-2 text-[12px] font-semibold text-[#1e3261]">
                  <span><b>{t.record_no}</b> · {t.assigned_engineer_name || 'Unassigned'} · {fmtDate(t.visit_date || t.due_date)}</span>
                  <Pill>{t.status}</Pill>
                </div>
              )) : <p className="text-[12px] font-semibold text-[#8a98af]">No task yet.</p>}
            </section>
            <section>
              <h3 className="mb-2 text-[13px] font-extrabold text-[#1e3261]">Site visits ({visits.length})</h3>
              {visits.length ? visits.map((v) => (
                <button key={v.id} type="button" onClick={() => setModal({ visit: v.id })} className="mb-1.5 flex w-full flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#eef2f8] px-3 py-2 text-left text-[12px] font-semibold text-[#1e3261] hover:bg-[#f8fbff]">
                  <span><b>{v.record_no}</b> · {fmtDate(v.date)} · {v.assigned_engineer_name || v.engineer} · {v.work_done?.slice(0, 60) || v.purpose}</span>
                  <Pill>{v.final_status || v.status}</Pill>
                </button>
              )) : <p className="text-[12px] font-semibold text-[#8a98af]">No visit yet.</p>}
            </section>
          </div>
        )}
      </Modal>
      {modal === 'edit' && ticket ? <TicketFormModal ticket={ticket} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} onNotify={onNotify} /> : null}
      {modal === 'task' && ticket ? <CreateTaskModal ticket={ticket} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} onNotify={onNotify} /> : null}
      {modal === 'resolve' && ticket ? <ResolveModal ticket={ticket} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} onNotify={onNotify} /> : null}
      {modal?.visit ? <VisitDetailModal visitId={modal.visit} onClose={() => setModal(null)} onNotify={onNotify} canEdit={caps.edit} /> : null}
    </>
  );
}

// ── Complaint Tickets page ────────────────────────────────────────────────────

const TICKET_CHIPS = [
  { value: 'open', label: 'All Open', params: { open: 1 } },
  { value: 'overdue', label: 'Overdue', params: { overdue: 1 } },
  ...TICKET_STATUSES.map((s) => ({ value: s, label: s, params: { status: s } })),
  { value: 'all', label: 'All', params: {} },
];

export function ComplaintTicketsList({ plant, caps, onNotify, embedded, focusId, onFocusConsumed }) {
  const [chip, setChip] = useState('open');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [type, setType] = useState('');
  const [modal, setModal] = useState(null);
  const chipParams = TICKET_CHIPS.find((c) => c.value === chip)?.params || {};
  const params = { page_size: 1000, ...chipParams, priority, complaint_type: type, plant: plant?.id || '' };
  const key = JSON.stringify(params);
  const { rows, loading, reload } = useRows(() => omTicketApi.list(params), [key]);

  useEffect(() => {
    if (!focusId) return;
    setModal({ detail: Number(focusId) });
    onFocusConsumed?.();
  }, [focusId, onFocusConsumed]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.record_no, r.subject, r.customer_name, r.plant_code, r.contact_number, r.site, r.assigned_to_name, r.complaint_type]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }, [rows, search]);

  const isOpen = (r) => !['Resolved', 'Closed'].includes(r.status);
  const actions = (r) => (caps.edit ? (
    <div className="flex flex-wrap gap-1">
      {isOpen(r) ? <button type="button" className={BTN_SMALL} onClick={stop(() => setModal({ task: r }))}><ClipboardList className="size-3.5" /> Task</button> : null}
      {isOpen(r) ? <button type="button" className={BTN_SMALL} onClick={stop(() => setModal({ resolve: r }))}><Phone className="size-3.5" /> Resolve</button> : null}
      {r.status === 'Resolved' ? (
        <button type="button" className={BTN_SMALL} onClick={stop(() => omTicketApi.close(r.id).then(() => { onNotify?.(`${r.record_no} closed.`, 'success'); reload(); }).catch((e) => onNotify?.(errMsg(e, 'Close failed.'), 'error')))}>
          <CheckCircle2 className="size-3.5" /> Close
        </button>
      ) : null}
    </div>
  ) : null);

  const columns = [
    { label: 'Ticket', render: (r) => <div><p className="font-extrabold text-[#0b65e5]">{r.record_no}</p><p className="text-[11px] text-[#8a98af]">{fmtDateTime(r.complaint_at || r.created_at)}</p></div> },
    ...(plant ? [] : [{ label: 'Plant / Customer', render: (r) => <div><p className="font-bold">{r.customer_name || r.site || '—'}</p><p className="text-[11px] text-[#8a98af]">{[r.plant_code, r.contact_number].filter(Boolean).join(' · ')}</p></div> }]),
    { label: 'Complaint', render: (r) => <div className="max-w-[260px]"><p className="font-bold">{r.subject}</p><p className="text-[11px] text-[#8a98af]">{r.complaint_type}</p></div> },
    { label: 'Priority', render: (r) => <Pill>{r.priority}</Pill> },
    { label: 'Engineer', render: (r) => <div><p>{r.assigned_to_name || '—'}</p>{r.expected_visit_date ? <p className={cx('text-[11px]', r.is_overdue ? 'font-extrabold text-[#dc2626]' : 'text-[#8a98af]')}>Visit {fmtDate(r.expected_visit_date)}</p> : null}</div> },
    { label: 'Status', render: (r) => <div className="flex flex-col items-start gap-1"><Pill>{r.status}</Pill>{r.is_overdue ? <Pill tone="red">Overdue</Pill> : null}</div> },
    ...(caps.edit ? [{ label: 'Actions', render: actions }] : []),
  ];

  return (
    <div className={cx(!embedded && PANEL, !embedded && 'p-3 sm:p-4', 'flex flex-col gap-3')}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchBox value={search} onChange={setSearch} placeholder="Search ticket, customer, mobile, PLT..." />
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <SelectInput value={priority} onChange={setPriority} options={PRIORITIES} placeholder="All priorities" className="lg:w-[150px]" />
          <SelectInput value={type} onChange={setType} options={COMPLAINT_TYPES} placeholder="All types" className="lg:w-[170px]" />
        </div>
        {caps.add ? <button type="button" className={BTN_PRIMARY} onClick={() => setModal({ form: true })}><Plus className="size-4" /> New Ticket</button> : null}
      </div>
      <FilterChips options={TICKET_CHIPS.map(({ value, label }) => ({ value, label }))} value={chip} onChange={setChip} />
      <DataList
        rows={visible}
        columns={columns}
        loading={loading}
        storageKey="om-tickets"
        resetKey={`${key}|${search}`}
        emptyIcon={Siren}
        emptyTitle="No tickets"
        onRowClick={(r) => setModal({ detail: r.id })}
        renderCard={(r) => (
          <MobileRecordCard
            key={r.id}
            icon={Siren}
            iconTone={r.priority === 'Critical' || r.priority === 'High' ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#f2eafe] text-[#7c3aed]'}
            title={r.subject}
            subtitle={`${r.record_no} · ${r.customer_name || r.site || ''}`}
            badges={<><Pill>{r.status}</Pill><Pill>{r.priority}</Pill>{r.is_overdue ? <Pill tone="red">Overdue</Pill> : null}</>}
            details={[
              { label: 'Type', value: r.complaint_type },
              { label: 'Engineer', value: r.assigned_to_name || 'Unassigned' },
              { label: 'Complaint', value: fmtDate(r.complaint_at) },
              { label: 'Visit', value: r.expected_visit_date ? fmtDate(r.expected_visit_date) : '' },
            ]}
            onOpen={() => setModal({ detail: r.id })}
            actions={[
              r.contact_number ? { label: 'Call', icon: Phone, tone: 'green', href: `tel:${r.contact_number}` } : null,
              caps.edit && isOpen(r) ? { label: 'Task', icon: ClipboardList, tone: 'blue', onClick: () => setModal({ task: r }) } : null,
              caps.edit && isOpen(r) ? { label: 'Resolve', icon: CheckCircle2, tone: 'purple', onClick: () => setModal({ resolve: r }) } : null,
            ]}
          />
        )}
      />
      {modal?.form ? <TicketFormModal plant={plant} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} onNotify={onNotify} /> : null}
      {modal?.task ? <CreateTaskModal ticket={modal.task} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} onNotify={onNotify} /> : null}
      {modal?.resolve ? <ResolveModal ticket={modal.resolve} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} onNotify={onNotify} /> : null}
      {modal?.detail ? <TicketDetailModal ticketId={modal.detail} caps={caps} onClose={() => setModal(null)} onNotify={onNotify} onChanged={reload} /> : null}
    </div>
  );
}

// ── Tasks (all / quarterly) ───────────────────────────────────────────────────

function AssignEngineerModal({ task, onClose, onSaved, onNotify }) {
  const engineers = useEngineers();
  const [engineer, setEngineer] = useState(task.assigned_engineer ? String(task.assigned_engineer) : '');
  const [visitDate, setVisitDate] = useState(task.visit_date || task.due_date || todayIso());
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!engineer) { onNotify?.('Select an engineer.', 'error'); return; }
    setSaving(true);
    try {
      const t = await omMaintenanceApi.assignEngineer(task.id, Number(engineer), { visit_date: visitDate || null });
      onNotify?.(`${t.record_no} assigned to ${t.assigned_engineer_name}.`, 'success');
      onSaved?.(t);
    } catch (e) {
      onNotify?.(errMsg(e, 'Could not assign.'), 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Assign Engineer · ${task.record_no}`} subtitle={task.title} onClose={onClose} size="sm"
      footer={<>
        <button type="button" className={BTN_OUTLINE} onClick={onClose}>Cancel</button>
        <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Assign'}</button>
      </>}
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="Engineer" required>
          <SelectInput value={engineer} onChange={setEngineer} placeholder="Select engineer..." options={engineers.map((u) => ({ value: String(u.id), label: u.role ? `${u.name} (${u.role})` : u.name }))} />
        </Field>
        <Field label="Visit Date"><input type="date" className={INPUT} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function TaskFormModal({ plant, onClose, onSaved, onNotify }) {
  const engineers = useEngineers();
  const plants = usePlantOptions(!plant);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    plant: plant ? String(plant.id) : '', title: '', task_type: 'Preventive', priority: 'Medium',
    assigned_engineer: '', visit_date: '', due_date: todayIso(), deadline: '', work_details: '',
  });
  const set = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));
  const save = async () => {
    if (!form.plant || !form.title.trim()) { onNotify?.('Plant and title are required.', 'error'); return; }
    setSaving(true);
    try {
      const t = await omMaintenanceApi.create({
        ...form,
        plant: Number(form.plant),
        source: 'Manual',
        status: 'Pending',
        assigned_engineer: form.assigned_engineer ? Number(form.assigned_engineer) : null,
        visit_date: form.visit_date || null,
        due_date: form.due_date || null,
        deadline: form.deadline || null,
      });
      onNotify?.(`${t.record_no} created.`, 'success');
      onSaved?.(t);
    } catch (e) {
      onNotify?.(errMsg(e, 'Could not create task.'), 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="New Service Task" onClose={onClose}
      footer={<>
        <button type="button" className={BTN_OUTLINE} onClick={onClose}>Cancel</button>
        <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Create Task'}</button>
      </>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!plant ? <Field label="Plant" required wide><PlantPicker value={form.plant} onChange={set('plant')} plants={plants} /></Field> : null}
        <Field label="Title" required wide><input className={INPUT} value={form.title} onChange={(e) => set('title')(e.target.value)} /></Field>
        <Field label="Task Type"><SelectInput value={form.task_type} onChange={set('task_type')} options={['Preventive', 'Corrective']} /></Field>
        <Field label="Priority"><SelectInput value={form.priority} onChange={set('priority')} options={PRIORITIES} /></Field>
        <Field label="Engineer" wide>
          <SelectInput value={form.assigned_engineer} onChange={set('assigned_engineer')} placeholder="Assign later" options={engineers.map((u) => ({ value: String(u.id), label: u.name }))} />
        </Field>
        <Field label="Due Date"><input type="date" className={INPUT} value={form.due_date} onChange={(e) => set('due_date')(e.target.value)} /></Field>
        <Field label="Visit Date"><input type="date" className={INPUT} value={form.visit_date} onChange={(e) => set('visit_date')(e.target.value)} /></Field>
        <Field label="Deadline"><input type="date" className={INPUT} value={form.deadline} onChange={(e) => set('deadline')(e.target.value)} /></Field>
        <Field label="Work Details" wide><textarea className={TEXTAREA} value={form.work_details} onChange={(e) => set('work_details')(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function TaskDetailModal({ task, caps, onClose, onNotify, onAction }) {
  const [visits, setVisits] = useState([]);
  const [visitId, setVisitId] = useState(null);
  useEffect(() => {
    omVisitApi.list({ task: task.id, page_size: 100 }).then((r) => setVisits(normalizeApiRows(r))).catch(() => {});
  }, [task.id]);
  const open = TASK_OPEN(task);
  return (
    <>
      <Modal title={`${task.record_no} · ${task.title}`} subtitle={`${task.plant_code || ''} — ${task.customer_name || task.site || ''}`} onClose={onClose} size="lg"
        footer={open ? (
          <>
            {caps.edit ? <button type="button" className={BTN_OUTLINE} onClick={() => onAction('assign', task)}><UserCheck className="size-4" /> Assign</button> : null}
            {caps.edit ? <button type="button" className={BTN_OUTLINE} onClick={() => onAction('cancel', task)}><XCircle className="size-4" /> Cancel task</button> : null}
            <button type="button" className={BTN_GREEN} onClick={() => onAction('service', task)}><ClipboardCheck className="size-4" /> Service Form</button>
          </>
        ) : null}
      >
        <div className="space-y-5">
          <DetailGrid rows={[
            ['Status', <span key="s" className="flex gap-1.5"><Pill>{task.status}</Pill>{task.is_overdue ? <Pill tone="red">Overdue</Pill> : null}</span>],
            ['Source', <Pill key="src">{task.source}</Pill>],
            ['Priority', <Pill key="p">{task.priority}</Pill>],
            ['Engineer', task.assigned_engineer_name],
            ['Due Date', fmtDate(task.due_date)],
            ['Visit Date', fmtDate(task.visit_date)],
            ['Deadline', fmtDate(task.deadline)],
            ['Completed', fmtDateTime(task.completed_at)],
            ['Ticket', task.ticket_no ? `${task.ticket_no} · ${task.ticket_subject || ''}` : ''],
            ['Customer Mobile', task.customer_mobile ? <a key="m" className="text-[#0b65e5]" href={`tel:${task.customer_mobile}`}>{task.customer_mobile}</a> : ''],
            ['Location', task.plant_location || task.site, true],
            ['Work Details', task.work_details, true],
          ]} />
          {Array.isArray(task.checklist) && task.checklist.length ? (
            <section>
              <h3 className="mb-2 text-[13px] font-extrabold text-[#1e3261]">Checklist</h3>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {task.checklist.map((c) => <li key={c.label} className="text-[12px] font-semibold text-[#1e3261]">• {c.label}</li>)}
              </ul>
            </section>
          ) : null}
          <section>
            <h3 className="mb-2 text-[13px] font-extrabold text-[#1e3261]">Visits ({visits.length})</h3>
            {visits.length ? visits.map((v) => (
              <button key={v.id} type="button" onClick={() => setVisitId(v.id)} className="mb-1.5 flex w-full flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#eef2f8] px-3 py-2 text-left text-[12px] font-semibold text-[#1e3261] hover:bg-[#f8fbff]">
                <span><b>{v.record_no}</b> · {fmtDate(v.date)} · {v.assigned_engineer_name || v.engineer}</span>
                <Pill>{v.final_status || v.status}</Pill>
              </button>
            )) : <p className="text-[12px] font-semibold text-[#8a98af]">No visit yet.</p>}
          </section>
        </div>
      </Modal>
      {visitId ? <VisitDetailModal visitId={visitId} onClose={() => setVisitId(null)} onNotify={onNotify} canEdit={caps.edit} /> : null}
    </>
  );
}

function taskChips(quarterly) {
  const today = todayIso();
  if (quarterly) {
    return [
      { value: 'due30', label: 'Due in 30 days', params: { open: 1, due_to: addDaysIso(30) } },
      { value: 'overdue', label: 'Overdue', params: { overdue: 1 } },
      { value: 'due15', label: 'Due in 15 days', params: { open: 1, due_from: today, due_to: addDaysIso(15) } },
      { value: 'open', label: 'All upcoming', params: { open: 1 } },
      { value: 'done', label: 'Completed', params: { status: 'Completed' } },
      { value: 'all', label: 'All', params: {} },
    ];
  }
  return [
    { value: 'open', label: 'Open', params: { open: 1 } },
    { value: 'today', label: 'Today', params: { open: 1, due_from: today, due_to: today } },
    { value: 'overdue', label: 'Overdue', params: { overdue: 1 } },
    { value: 'done', label: 'Completed', params: { status: 'Completed' } },
    { value: 'cancelled', label: 'Cancelled', params: { status: 'Cancelled' } },
    { value: 'all', label: 'All', params: {} },
  ];
}

export function ServiceTasksList({ quarterly = false, plant, caps, onNotify, embedded, focusId, onFocusConsumed }) {
  const chips = useMemo(() => taskChips(quarterly), [quarterly]);
  const [chip, setChip] = useState(plant ? (quarterly ? 'all' : 'open') : chips[0].value);
  const [search, setSearch] = useState('');
  const [engineer, setEngineer] = useState('');
  const [source, setSource] = useState('');
  const [modal, setModal] = useState(null);
  const engineers = useEngineers();
  const chipParams = chips.find((c) => c.value === chip)?.params || {};
  const params = {
    page_size: 1000, ordering: quarterly || plant ? 'due_date' : '-created_at', ...chipParams,
    source: quarterly ? 'Quarterly' : source, assigned_engineer: engineer, plant: plant?.id || '',
  };
  const key = JSON.stringify(params);
  const { rows, loading, reload } = useRows(() => omMaintenanceApi.list(params), [key]);

  useEffect(() => {
    if (!focusId) return;
    omMaintenanceApi.get(focusId).then((t) => setModal({ detail: t })).catch(() => {});
    onFocusConsumed?.();
  }, [focusId, onFocusConsumed]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.record_no, r.title, r.customer_name, r.plant_code, r.customer_mobile, r.site, r.assigned_engineer_name, r.ticket_no]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }, [rows, search]);

  const doAction = async (kind, task) => {
    if (kind === 'assign') { setModal({ assign: task }); return; }
    if (kind === 'service') { setModal({ service: task }); return; }
    if (kind === 'cancel') {
      if (!window.confirm(`Cancel ${task.record_no}?`)) return;
      try {
        await omMaintenanceApi.cancel(task.id);
        onNotify?.(`${task.record_no} cancelled.`, 'success');
        setModal(null);
        reload();
      } catch (e) {
        onNotify?.(errMsg(e, 'Cancel failed.'), 'error');
      }
    }
  };

  const when = (r) => r.visit_date || r.due_date;
  const columns = [
    { label: 'Task', render: (r) => <div><p className="font-extrabold text-[#0b65e5]">{r.record_no}</p>{r.ticket_no ? <p className="text-[11px] text-[#7c3aed]">{r.ticket_no}</p> : null}</div> },
    ...(plant ? [] : [{ label: 'Plant / Customer', render: (r) => <div><p className="font-bold">{r.customer_name || r.site || '—'}</p><p className="text-[11px] text-[#8a98af]">{[r.plant_code, r.customer_mobile].filter(Boolean).join(' · ')}</p></div> }]),
    { label: 'Title', render: (r) => <div className="max-w-[260px]"><p className="font-bold">{r.title}</p>{!quarterly ? <Pill className="mt-1">{r.source}</Pill> : null}</div> },
    { label: quarterly ? 'Due Date' : 'Due / Visit', render: (r) => <div><p className={cx(r.is_overdue && 'font-extrabold text-[#dc2626]')}>{fmtDate(when(r))}</p>{r.is_overdue ? <p className="text-[11px] font-bold text-[#dc2626]">Overdue</p> : null}</div> },
    { label: 'Engineer', render: (r) => r.assigned_engineer_name || <span className="text-[#8a98af]">Unassigned</span> },
    { label: 'Priority', render: (r) => <Pill>{r.priority}</Pill> },
    { label: 'Status', render: (r) => <Pill>{r.status}</Pill> },
    {
      label: 'Actions',
      render: (r) => (TASK_OPEN(r) ? (
        <div className="flex flex-wrap gap-1">
          {caps.edit ? <button type="button" className={BTN_SMALL} onClick={stop(() => doAction('assign', r))}><UserCheck className="size-3.5" /> Assign</button> : null}
          <button type="button" className={BTN_SMALL} onClick={stop(() => doAction('service', r))}><ClipboardCheck className="size-3.5" /> Service</button>
        </div>
      ) : null),
    },
  ];

  return (
    <div className={cx(!embedded && PANEL, !embedded && 'p-3 sm:p-4', 'flex flex-col gap-3')}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchBox value={search} onChange={setSearch} placeholder="Search task, customer, PLT, engineer..." />
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <SelectInput value={engineer} onChange={setEngineer} placeholder="All engineers" options={engineers.map((u) => ({ value: String(u.id), label: u.name }))} className="lg:w-[170px]" />
          {!quarterly ? <SelectInput value={source} onChange={setSource} placeholder="All sources" options={['Quarterly', 'Ticket', 'Manual']} className="lg:w-[140px]" /> : null}
        </div>
        {!quarterly && caps.add ? <button type="button" className={BTN_PRIMARY} onClick={() => setModal({ form: true })}><Plus className="size-4" /> New Task</button> : null}
      </div>
      <FilterChips options={chips.map(({ value, label }) => ({ value, label }))} value={chip} onChange={setChip} />
      <DataList
        rows={visible}
        columns={columns}
        loading={loading}
        storageKey={quarterly ? 'om-quarterly' : 'om-tasks'}
        resetKey={`${key}|${search}`}
        emptyIcon={ClipboardList}
        emptyTitle={quarterly ? 'No quarterly services in this view' : 'No tasks'}
        onRowClick={(r) => setModal({ detail: r })}
        rowClassName={(r) => (r.is_overdue ? 'bg-[#fff7f7]' : '')}
        renderCard={(r) => (
          <MobileRecordCard
            key={r.id}
            icon={r.source === 'Quarterly' ? Calendar : r.source === 'Ticket' ? Siren : Wrench}
            iconTone={r.is_overdue ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#eef4ff] text-[#0b65e5]'}
            title={r.title}
            subtitle={`${r.record_no} · ${r.customer_name || r.site || ''}`}
            badges={<><Pill>{r.status}</Pill>{r.is_overdue ? <Pill tone="red">Overdue</Pill> : null}{r.priority === 'Critical' || r.priority === 'High' ? <Pill>{r.priority}</Pill> : null}</>}
            details={[
              { label: quarterly ? 'Due' : 'Due / Visit', value: fmtDate(when(r)), tone: r.is_overdue ? 'danger' : undefined },
              { label: 'Engineer', value: r.assigned_engineer_name || 'Unassigned' },
              { label: 'Plant', value: r.plant_code },
            ]}
            onOpen={() => setModal({ detail: r })}
            actions={TASK_OPEN(r) ? [
              caps.edit ? { label: 'Assign', icon: UserCheck, tone: 'blue', onClick: () => doAction('assign', r) } : null,
              { label: 'Service', icon: ClipboardCheck, tone: 'green', onClick: () => doAction('service', r) },
            ] : []}
          />
        )}
      />
      {modal?.form ? <TaskFormModal plant={plant} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} onNotify={onNotify} /> : null}
      {modal?.assign ? <AssignEngineerModal task={modal.assign} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} onNotify={onNotify} /> : null}
      {modal?.service ? <ServiceFormWizard task={modal.service} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} onNotify={onNotify} /> : null}
      {modal?.detail ? <TaskDetailModal task={modal.detail} caps={caps} onClose={() => setModal(null)} onNotify={onNotify} onAction={doAction} /> : null}
    </div>
  );
}

// ── Service visits ────────────────────────────────────────────────────────────

export function ServiceVisitsList({ plant, caps, onNotify, embedded }) {
  const [type, setType] = useState('');
  const [engineer, setEngineer] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const engineers = useEngineers();
  const params = { page_size: 1000, ordering: '-date', service_type: type, assigned_engineer: engineer, plant: plant?.id || '' };
  const key = JSON.stringify(params);
  const { rows, loading, reload } = useRows(() => omVisitApi.list(params), [key]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.record_no, r.customer_name, r.plant_code, r.assigned_engineer_name, r.engineer, r.work_done, r.fault_found, r.ticket_no]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }, [rows, search]);

  const columns = [
    { label: 'Visit', render: (r) => <div><p className="font-extrabold text-[#0b65e5]">{r.record_no}</p><p className="text-[11px] text-[#8a98af]">{fmtDate(r.date)}</p></div> },
    ...(plant ? [] : [{ label: 'Plant / Customer', render: (r) => <div><p className="font-bold">{r.customer_name || r.site || '—'}</p><p className="text-[11px] text-[#8a98af]">{r.plant_code}</p></div> }]),
    { label: 'Type', render: (r) => <div className="flex flex-col items-start gap-1"><Pill>{r.service_type}</Pill>{r.ticket_no ? <span className="text-[11px] text-[#7c3aed]">{r.ticket_no}</span> : null}</div> },
    { label: 'Engineer', render: (r) => r.assigned_engineer_name || r.engineer || '—' },
    { label: 'Work Done', render: (r) => <p className="line-clamp-2 max-w-[300px]">{r.work_done || r.purpose || '—'}</p> },
    { label: 'Parts', render: (r) => (r.parts?.length ? `${r.parts.length} · ${fmtMoney(r.spare_cost)}` : '—') },
    { label: 'Status', render: (r) => <div className="flex flex-col items-start gap-1"><Pill>{r.status}</Pill>{r.final_status ? <Pill>{r.final_status}</Pill> : null}</div> },
  ];

  return (
    <div className={cx(!embedded && PANEL, !embedded && 'p-3 sm:p-4', 'flex flex-col gap-3')}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchBox value={search} onChange={setSearch} placeholder="Search visit, customer, engineer, work..." />
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <SelectInput value={type} onChange={setType} options={SERVICE_TYPES} placeholder="All types" className="lg:w-[150px]" />
          <SelectInput value={engineer} onChange={setEngineer} placeholder="All engineers" options={engineers.map((u) => ({ value: String(u.id), label: u.name }))} className="lg:w-[170px]" />
        </div>
        {caps.add || caps.field ? <button type="button" className={BTN_PRIMARY} onClick={() => setModal({ log: true })}><Plus className="size-4" /> Log Visit</button> : null}
      </div>
      <p className="text-[11px] font-semibold text-[#8a98af]">Service visits are permanent history — they can be cancelled but never deleted.</p>
      <DataList
        rows={visible}
        columns={columns}
        loading={loading}
        storageKey="om-visits"
        resetKey={`${key}|${search}`}
        emptyIcon={Wrench}
        emptyTitle="No service visits yet"
        onRowClick={(r) => setModal({ detail: r.id })}
        renderCard={(r) => (
          <MobileRecordCard
            key={r.id}
            icon={Wrench}
            title={r.customer_name || r.site || r.record_no}
            subtitle={`${r.record_no} · ${fmtDate(r.date)}`}
            badges={<><Pill>{r.service_type}</Pill><Pill>{r.final_status || r.status}</Pill></>}
            details={[
              { label: 'Engineer', value: r.assigned_engineer_name || r.engineer },
              { label: 'Plant', value: r.plant_code },
              { label: 'Work Done', value: r.work_done, wide: true },
            ]}
            onOpen={() => setModal({ detail: r.id })}
            actions={[{ label: 'View', icon: Eye, tone: 'blue', onClick: () => setModal({ detail: r.id }) }]}
          />
        )}
      />
      {modal?.log ? <ServiceFormWizard plant={plant} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} onNotify={onNotify} /> : null}
      {modal?.detail ? <VisitDetailModal visitId={modal.detail} onClose={() => setModal(null)} onNotify={onNotify} canEdit={caps.edit} onChanged={reload} /> : null}
    </div>
  );
}

// ── Engineer: My Tasks ────────────────────────────────────────────────────────

function MyTaskCard({ task, highlighted, onAccept, onStart, onService, busy }) {
  const location = task.plant_location || task.site;
  const when = task.visit_date || task.due_date;
  const open = TASK_OPEN(task);
  return (
    <article className={cx(PANEL, 'flex flex-col gap-3 p-3.5', highlighted && 'ring-2 ring-[#0b65e5]', task.priority === 'Critical' && 'border-[#fecaca]')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#8a98af]">{task.record_no}{task.ticket_no ? ` · ${task.ticket_no}` : ''}</p>
          <h3 className="mt-0.5 text-[15px] font-extrabold leading-snug text-[#1e3261]">{task.title}</h3>
          <p className="mt-0.5 text-[13px] font-bold text-[#53647f]">{task.customer_name || '—'} {task.plant_code ? <span className="text-[#8a98af]">· {task.plant_code}</span> : null}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Pill>{task.status}</Pill>
          {task.priority === 'Critical' || task.priority === 'High' ? <Pill>{task.priority}</Pill> : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[12px] font-semibold text-[#53647f]">
        <span className="flex items-center gap-1.5"><Calendar className="size-3.5" />{fmtDate(when)}</span>
        <span className="flex items-center gap-1.5"><Wrench className="size-3.5" />{task.source === 'Quarterly' ? 'Quarterly service' : task.source === 'Ticket' ? 'Complaint' : 'Manual'}</span>
        {location ? <span className="col-span-2 flex items-start gap-1.5"><MapPin className="mt-0.5 size-3.5 shrink-0" />{location}</span> : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {task.customer_mobile ? <a href={`tel:${task.customer_mobile}`} className={cx(BTN_OUTLINE, 'h-11 sm:h-10')}><Phone className="size-4" /> Call</a> : null}
        {location ? <a href={mapsUrl(location)} target="_blank" rel="noreferrer" className={cx(BTN_OUTLINE, 'h-11 sm:h-10')}><MapPin className="size-4" /> Map</a> : null}
        {open && task.status === 'Assigned' ? <button type="button" disabled={busy} onClick={onAccept} className={cx(BTN_PRIMARY, 'h-11 sm:h-10')}><UserCheck className="size-4" /> Accept</button> : null}
        {open && ['Assigned', 'Accepted', 'Pending', 'Scheduled'].includes(task.status) ? <button type="button" disabled={busy} onClick={onStart} className={cx(BTN_OUTLINE, 'h-11 sm:h-10')}><Play className="size-4" /> Start</button> : null}
        {open ? <button type="button" onClick={onService} className={cx(BTN_GREEN, 'col-span-2 h-11 sm:col-span-1 sm:h-10')}><ClipboardCheck className="size-4" /> Service Form</button> : null}
      </div>
    </article>
  );
}

export function OmMyTasksPage({ onNotify, Subnav, activeSection, onOpenSection, focus, onFocusConsumed }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('today');
  const [busy, setBusy] = useState(0);
  const [service, setService] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    let alive = true;
    omMaintenanceApi.myTasks()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) { setData({ today: [], overdue: [], upcoming: [], completed: [], counts: {} }); onNotify?.(errMsg(e, 'Could not load your tasks.'), 'error'); } });
    return () => { alive = false; };
  }, [tick, onNotify]);

  useEffect(() => {
    if (!focus?.task || !data) return;
    const id = Number(focus.task);
    const group = ['today', 'overdue', 'upcoming', 'completed'].find((g) => data[g]?.some((t) => t.id === id));
    if (group) setTab(group);
    setHighlight(id);
    onFocusConsumed?.();
  }, [focus, data, onFocusConsumed]);

  const act = async (task, fn, msg) => {
    setBusy(task.id);
    try {
      await fn(task.id);
      onNotify?.(msg, 'success');
      reload();
    } catch (e) {
      onNotify?.(errMsg(e, 'Action failed.'), 'error');
    } finally {
      setBusy(0);
    }
  };

  const counts = data?.counts || {};
  const list = data?.[tab] || [];
  const tabs = [
    { value: 'today', label: 'Today', count: counts.today },
    { value: 'overdue', label: 'Overdue', count: counts.overdue },
    { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { value: 'completed', label: 'Done (7 days)', count: data?.completed?.length },
  ];

  return (
    <div className="space-y-3">
      <OmHeading
        title="My Tasks"
        crumbs={[{ label: 'O&M' }, { label: 'My Tasks' }]}
        actions={<button type="button" onClick={reload} className={BTN_OUTLINE}><RefreshCw className="size-4" /> Refresh</button>}
      />
      {Subnav ? <Subnav activeSection={activeSection} onOpenSection={onOpenSection} /> : null}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <CounterTile label="Today" value={counts.today ?? '…'} icon={Calendar} tone="blue" onClick={() => setTab('today')} />
        <CounterTile label="Overdue" value={counts.overdue ?? '…'} icon={AlertTriangle} tone="red" onClick={() => setTab('overdue')} />
        <CounterTile label="Upcoming" value={counts.upcoming ?? '…'} icon={ClipboardList} tone="teal" onClick={() => setTab('upcoming')} />
        <CounterTile label="Quarterly today" value={counts.quarterly_today ?? '…'} icon={Wrench} tone="green" />
        <CounterTile label="Complaints today" value={counts.complaints_today ?? '…'} icon={Siren} tone="purple" />
        <CounterTile label="Emergency today" value={counts.emergency_today ?? '…'} icon={AlertTriangle} tone="amber" />
      </div>
      <FilterChips options={tabs} value={tab} onChange={setTab} />
      {!data ? <p className="py-10 text-center text-[13px] font-semibold text-[#8a98af]">Loading...</p> : list.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <MyTaskCard
              key={t.id}
              task={t}
              busy={busy === t.id}
              highlighted={highlight === t.id}
              onAccept={() => act(t, omMaintenanceApi.accept, `${t.record_no} accepted.`)}
              onStart={() => act(t, omMaintenanceApi.start, `${t.record_no} started.`)}
              onService={() => setService(t)}
            />
          ))}
        </div>
      ) : (
        <div className={cx(PANEL, 'py-12 text-center')}>
          <CheckCircle2 className="mx-auto size-9 text-[#c7d4e0]" />
          <p className="mt-2 text-[14px] font-extrabold text-[#53647f]">Nothing here</p>
        </div>
      )}
      {service ? <ServiceFormWizard task={service} onClose={() => setService(null)} onDone={() => { setService(null); reload(); }} onNotify={onNotify} /> : null}
    </div>
  );
}

export function OmListPage({ title, Subnav, activeSection, onOpenSection, children, actions }) {
  return (
    <div className="space-y-3">
      <OmHeading
        title={title}
        crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'O&M', onClick: () => onOpenSection('O&M Dashboard') }, { label: title }]}
        actions={actions}
      />
      {Subnav ? <Subnav activeSection={activeSection} onOpenSection={onOpenSection} /> : null}
      {children}
    </div>
  );
}
