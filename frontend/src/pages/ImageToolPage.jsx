import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import * as Icons from 'lucide-react';
import { ChevronRight, X, Download, Loader2, RefreshCw } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FileDrop from '../components/FileDrop';
import { TOOLS, ICON_TILE } from '../mock';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/image`;

const CHECKER = {
  backgroundImage:
    'linear-gradient(45deg,#d8dbe2 25%,transparent 25%),linear-gradient(-45deg,#d8dbe2 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d8dbe2 75%),linear-gradient(-45deg,transparent 75%,#d8dbe2 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0,0 10px,10px -10px,-10px 0',
};

const fmtSize = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MB` : `${(b / 1024).toFixed(0)} KB`);

const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

const Panel = ({ children }) => (
  <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5 sm:p-7 space-y-5">{children}</div>
);

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium mb-2">{label}</label>
    {children}
  </div>
);

const FileChip = ({ file, onRemove }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] px-4 py-3">
    <Icons.Image className="w-5 h-5 text-rose-500" />
    <span className="text-sm truncate flex-1">{file.name}</span>
    <span className="text-xs text-slate-400">{fmtSize(file.size)}</span>
    <button data-testid="remove-image-btn" onClick={onRemove} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"><X className="w-4 h-4" /></button>
  </div>
);

const PrimaryBtn = ({ busy, busyText, text, icon: I, onClick, testId }) => (
  <button data-testid={testId} onClick={onClick} disabled={busy}
    className="w-full btn-primary text-white font-semibold py-4 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-70">
    {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> {busyText}</> : <><I className="w-5 h-5" /> {text}</>}
  </button>
);

/* ---------------- Compress ---------------- */
const CompressTool = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [quality, setQuality] = useState(75);
  const [maxWidth, setMaxWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const onFiles = (list) => {
    const f = list[0];
    setFile(f); setResult(null); setError('');
    setPreview(URL.createObjectURL(f));
  };

  const run = async () => {
    setBusy(true); setError(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('quality', quality);
      fd.append('max_width', maxWidth);
      const res = await fetch(`${API}/compress`, { method: 'POST', body: fd });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.detail || 'Compression failed.'); }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      setResult({ blob, name: m ? m[1] : 'compressed.jpg', url: URL.createObjectURL(blob) });
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  if (result) {
    const saved = Math.max(0, Math.round((1 - result.blob.size / file.size) * 100));
    return (
      <Panel>
        <div className="text-center space-y-3" data-testid="compress-result">
          <img src={result.url} alt="Compressed" className="max-h-72 mx-auto rounded-xl border border-slate-200 dark:border-white/10 object-contain" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {fmtSize(file.size)} → <b className="text-emerald-500">{fmtSize(result.blob.size)}</b> · saved {saved}%
          </p>
          <button data-testid="download-compressed-btn" onClick={() => downloadBlob(result.blob, result.name)} className="btn-primary text-white font-semibold px-6 py-3 rounded-xl inline-flex items-center gap-2"><Download className="w-4 h-4" /> Download {result.name}</button>
          <div><button onClick={() => { setFile(null); setResult(null); setPreview(null); }} className="text-sm text-rose-500 font-semibold inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Compress another image</button></div>
        </div>
      </Panel>
    );
  }

  return !file ? (
    <FileDrop accept="image/jpeg,image/png,image/webp" multiple={false} onFiles={onFiles} label="Select image" hint="JPG, PNG or WebP · up to 20 MB" />
  ) : (
    <Panel>
      {preview && <div data-testid="file-preview" className="flex justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-3"><img src={preview} alt="Preview" className="max-h-72 rounded-lg object-contain" /></div>}
      <FileChip file={file} onRemove={() => { setFile(null); setPreview(null); }} />
      <Field label={`Quality: ${quality}%`}>
        <input data-testid="quality-slider" type="range" min="10" max="95" step="5" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-rose-500" />
        <p className="hint">Lower quality = smaller file. 70–80% usually looks identical.</p>
      </Field>
      <Field label="Max width">
        <div className="flex gap-2 flex-wrap">
          {[{ v: 0, l: 'Original' }, { v: 1920, l: '1920px' }, { v: 1280, l: '1280px' }, { v: 800, l: '800px' }].map((o) => (
            <button key={o.v} onClick={() => setMaxWidth(o.v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${maxWidth === o.v ? 'btn-primary text-white border-transparent' : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}`}>{o.l}</button>
          ))}
        </div>
      </Field>
      {error && <p className="text-sm text-rose-500 font-medium" data-testid="tool-error">{error}</p>}
      <PrimaryBtn testId="compress-btn" busy={busy} busyText="Compressing..." text="Compress image" icon={Icons.ImageDown} onClick={run} />
    </Panel>
  );
};

/* ---------------- Remove background ---------------- */
const RemoveBgTool = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const onFiles = (list) => { const f = list[0]; setFile(f); setResult(null); setError(''); setPreview(URL.createObjectURL(f)); };

  const run = async () => {
    setBusy(true); setError('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${API}/remove-bg`, { method: 'POST', body: fd });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.detail || 'Background removal failed.'); }
      const blob = await res.blob();
      setResult({ blob, name: file.name.replace(/\.[^.]+$/, '') + '_no_bg.png', url: URL.createObjectURL(blob) });
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  if (result) {
    return (
      <Panel>
        <div className="text-center space-y-3" data-testid="removebg-result">
          <div className="inline-block rounded-xl p-3 border border-slate-200 dark:border-white/10" style={CHECKER}>
            <img src={result.url} alt="No background" className="max-h-72 object-contain" />
          </div>
          <div><button data-testid="download-nobg-btn" onClick={() => downloadBlob(result.blob, result.name)} className="btn-primary text-white font-semibold px-6 py-3 rounded-xl inline-flex items-center gap-2"><Download className="w-4 h-4" /> Download transparent PNG</button></div>
          <button onClick={() => { setFile(null); setResult(null); setPreview(null); }} className="text-sm text-rose-500 font-semibold inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Try another photo</button>
        </div>
      </Panel>
    );
  }

  return !file ? (
    <FileDrop accept="image/jpeg,image/png,image/webp" multiple={false} onFiles={onFiles} label="Select photo" hint="Works best with people, products and animals" />
  ) : (
    <Panel>
      {preview && <div data-testid="file-preview" className="flex justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-3"><img src={preview} alt="Preview" className="max-h-72 rounded-lg object-contain" /></div>}
      <FileChip file={file} onRemove={() => { setFile(null); setPreview(null); }} />
      {error && <p className="text-sm text-rose-500 font-medium" data-testid="tool-error">{error}</p>}
      <PrimaryBtn testId="removebg-btn" busy={busy} busyText="Removing background..." text="Remove background" icon={Icons.Eraser} onClick={run} />
      <p className="hint text-center">Powered by AI · returns a transparent PNG</p>
    </Panel>
  );
};

/* ---------------- Crop ---------------- */
const ASPECTS = [
  { id: 'free', label: 'Free', v: null },
  { id: '1:1', label: 'Square 1:1', v: 1 },
  { id: '4:3', label: '4:3', v: 4 / 3 },
  { id: '3:4', label: '3:4', v: 3 / 4 },
  { id: '16:9', label: '16:9', v: 16 / 9 },
  { id: '3:2', label: 'Photo 3:2', v: 3 / 2 },
];

const CropTool = () => {
  const [file, setFile] = useState(null);
  const [src, setSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectId, setAspectId] = useState('free');
  const [customW, setCustomW] = useState('');
  const [customH, setCustomH] = useState('');
  const [areaPx, setAreaPx] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const aspect = useMemo(() => {
    if (customW > 0 && customH > 0) return Number(customW) / Number(customH);
    const a = ASPECTS.find((x) => x.id === aspectId);
    return a && a.v ? a.v : undefined;
  }, [aspectId, customW, customH]);

  const onFiles = (list) => { const f = list[0]; setFile(f); setSrc(URL.createObjectURL(f)); setResult(null); setError(''); setZoom(1); setCrop({ x: 0, y: 0 }); };
  const onCropComplete = useCallback((_, px) => setAreaPx(px), []);

  const apply = async () => {
    if (!areaPx) return;
    try {
      const img = new Image();
      img.src = src;
      await new Promise((r, j) => { img.onload = r; img.onerror = j; });
      const canvas = document.createElement('canvas');
      const outW = customW > 0 ? Number(customW) : Math.round(areaPx.width);
      const outH = customH > 0 ? Number(customH) : Math.round(areaPx.height);
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, areaPx.x, areaPx.y, areaPx.width, areaPx.height, 0, 0, outW, outH);
      const isPng = /png$/i.test(file.type);
      const blob = await new Promise((r) => canvas.toBlob(r, isPng ? 'image/png' : 'image/jpeg', 0.92));
      setResult({ blob, name: file.name.replace(/\.[^.]+$/, '') + `_cropped.${isPng ? 'png' : 'jpg'}`, url: URL.createObjectURL(blob), w: outW, h: outH });
    } catch (e) { setError('Could not crop this image.'); }
  };

  if (result) {
    return (
      <Panel>
        <div className="text-center space-y-3" data-testid="crop-result">
          <img src={result.url} alt="Cropped" className="max-h-72 mx-auto rounded-xl border border-slate-200 dark:border-white/10 object-contain" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{result.w} × {result.h} px · {fmtSize(result.blob.size)}</p>
          <button data-testid="download-cropped-btn" onClick={() => downloadBlob(result.blob, result.name)} className="btn-primary text-white font-semibold px-6 py-3 rounded-xl inline-flex items-center gap-2"><Download className="w-4 h-4" /> Download {result.name}</button>
          <div><button onClick={() => setResult(null)} className="text-sm text-rose-500 font-semibold inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Adjust crop again</button></div>
        </div>
      </Panel>
    );
  }

  return !file ? (
    <FileDrop accept="image/*" multiple={false} onFiles={onFiles} label="Select image" hint="Crop to presets or exact pixel sizes" />
  ) : (
    <Panel>
      <div data-testid="crop-editor" className="relative w-full h-[380px] rounded-xl overflow-hidden bg-slate-900">
        <Cropper image={src} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
      </div>
      <Field label={`Zoom: ${zoom.toFixed(1)}x`}>
        <input data-testid="zoom-slider" type="range" min="1" max="4" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-rose-500" />
      </Field>
      <Field label="Preset sizes">
        <div className="flex gap-2 flex-wrap">
          {ASPECTS.map((a) => (
            <button key={a.id} data-testid={`aspect-${a.id}`} onClick={() => { setAspectId(a.id); setCustomW(''); setCustomH(''); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${aspectId === a.id && !customW ? 'btn-primary text-white border-transparent' : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}`}>{a.label}</button>
          ))}
        </div>
      </Field>
      <Field label="Custom output size (px, optional)">
        <div className="flex items-center gap-2">
          <input data-testid="custom-width" type="number" min="1" placeholder="Width" value={customW} onChange={(e) => setCustomW(e.target.value)} className="input flex-1" />
          <span className="text-slate-400">×</span>
          <input data-testid="custom-height" type="number" min="1" placeholder="Height" value={customH} onChange={(e) => setCustomH(e.target.value)} className="input flex-1" />
        </div>
        <p className="hint">Fill both to lock the exact output dimensions (e.g. 600 × 600 for a profile photo).</p>
      </Field>
      <FileChip file={file} onRemove={() => { setFile(null); setSrc(null); }} />
      {error && <p className="text-sm text-rose-500 font-medium">{error}</p>}
      <PrimaryBtn testId="crop-apply-btn" busy={false} busyText="" text="Crop image" icon={Icons.Crop} onClick={apply} />
    </Panel>
  );
};

/* ---------------- Photo Name & DOB ---------------- */
const FONTS = [
  { id: "Georgia, 'Times New Roman', serif", label: 'Classic Serif' },
  { id: 'Arial, Helvetica, sans-serif', label: 'Clean Sans' },
  { id: "'Brush Script MT', 'Segoe Script', cursive", label: 'Handwriting' },
  { id: "'Comic Sans MS', 'Chalkboard SE', cursive", label: 'Playful' },
  { id: "Impact, 'Arial Black', sans-serif", label: 'Bold Impact' },
  { id: "'Courier New', monospace", label: 'Typewriter' },
];

const POSITIONS = [
  ['top-left', 'top-center', 'top-right'],
  ['middle-left', 'middle-center', 'middle-right'],
  ['bottom-left', 'bottom-center', 'bottom-right'],
];

const PhotoTextTool = () => {
  const [file, setFile] = useState(null);
  const [img, setImg] = useState(null);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [pos, setPos] = useState('bottom-center');
  const [font, setFont] = useState(FONTS[2].id);
  const [color, setColor] = useState('#ffffff');
  const [size, setSize] = useState(8);
  const [outline, setOutline] = useState(false);
  const canvasRef = useRef(null);

  const onFiles = (list) => {
    const f = list[0]; setFile(f);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = URL.createObjectURL(f);
  };

  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const lines = [];
    if (name.trim()) lines.push({ text: name.trim(), scale: 1 });
    if (dob.trim()) lines.push({ text: dob.trim(), scale: 0.62 });
    if (!lines.length) return;
    const base = (canvas.width * size) / 100;
    const pad = canvas.width * 0.045;
    const gap = base * 0.25;
    const heights = lines.map((l) => base * l.scale);
    const blockH = heights.reduce((a, b) => a + b, 0) + gap * (lines.length - 1);
    const [v, h] = pos.split('-');
    let y = v === 'top' ? pad : v === 'middle' ? (canvas.height - blockH) / 2 : canvas.height - pad - blockH;
    const x = h === 'left' ? pad : h === 'right' ? canvas.width - pad : canvas.width / 2;
    ctx.textAlign = h === 'left' ? 'left' : h === 'right' ? 'right' : 'center';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => {
      ctx.font = `${l.scale === 1 ? 'bold ' : ''}${heights[i]}px ${font}`;
      if (outline) {
        ctx.lineWidth = Math.max(2, heights[i] / 11);
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.strokeText(l.text, x, y);
      }
      ctx.fillStyle = color;
      ctx.fillText(l.text, x, y);
      y += heights[i] + gap;
    });
  }, [img, name, dob, pos, font, color, size, outline]);

  const save = async () => {
    const blob = await new Promise((r) => canvasRef.current.toBlob(r, 'image/jpeg', 0.95));
    downloadBlob(blob, (file.name.replace(/\.[^.]+$/, '') || 'photo') + '_named.jpg');
  };

  return !file ? (
    <FileDrop accept="image/*" multiple={false} onFiles={onFiles} label="Select photo" hint="Upload a photo, then add name & date of birth" />
  ) : (
    <Panel>
      <div data-testid="phototext-preview" className="flex justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-3">
        <canvas ref={canvasRef} className="max-h-[380px] max-w-full rounded-lg object-contain" style={{ width: 'auto', height: 'auto' }} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name">
          <input data-testid="name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aarav Sharma" className="input" />
        </Field>
        <Field label="Date of birth / extra text">
          <input data-testid="dob-input" value={dob} onChange={(e) => setDob(e.target.value)} placeholder="e.g. 14 June 2025" className="input" />
        </Field>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Position">
          <div className="grid grid-cols-3 gap-1 w-max">
            {POSITIONS.flat().map((p) => (
              <button key={p} data-testid={`pos-${p}`} onClick={() => setPos(p)} title={p}
                className={`w-9 h-9 rounded-lg border grid place-items-center transition-colors ${pos === p ? 'btn-primary text-white border-transparent' : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                <span className={`w-2 h-2 rounded-full ${pos === p ? 'bg-white' : 'bg-slate-400'}`} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Font style">
          <select data-testid="font-select" value={font} onChange={(e) => setFont(e.target.value)} className="input">
            {FONTS.map((f) => <option key={f.id} value={f.id} style={{ fontFamily: f.id }}>{f.label}</option>)}
          </select>
        </Field>
        <Field label="Text color">
          <div className="flex items-center gap-2">
            <input data-testid="color-picker" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 rounded-lg border border-slate-200 dark:border-white/10 cursor-pointer bg-transparent" />
            {['#ffffff', '#ffd6e0', '#ffe066', '#f43f5e', '#1e293b'].map((c) => (
              <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-rose-500' : 'border-slate-200 dark:border-white/20'}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={`Text size: ${size}%`}>
          <input data-testid="size-slider" type="range" min="3" max="16" step="0.5" value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-rose-500" />
        </Field>
        <Field label="Readability outline">
          <button data-testid="outline-toggle" onClick={() => setOutline(!outline)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${outline ? 'btn-primary text-white border-transparent' : 'border-slate-200 dark:border-white/10'}`}>
            {outline ? 'Outline on' : 'Outline off'}
          </button>
        </Field>
      </div>
      <FileChip file={file} onRemove={() => { setFile(null); setImg(null); }} />
      <PrimaryBtn testId="phototext-download-btn" busy={false} busyText="" text="Download photo" icon={Download} onClick={save} />
    </Panel>
  );
};

/* ---------------- Page shell ---------------- */
export default function ImageToolPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const slug = pathname.split('/').pop();
  const tool = TOOLS.find((t) => t.slug === slug);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);
  useEffect(() => { if (!tool) navigate('/'); }, [tool, navigate]);
  if (!tool) return null;

  const Icon = Icons[tool.icon] || Icons.Image;
  const body = {
    'compress-image': <CompressTool />,
    'crop-image': <CropTool />,
    'remove-background': <RemoveBgTool />,
    'photo-text': <PhotoTextTool />,
  }[slug];

  const related = TOOLS.filter((t) => t.slug !== slug && t.category === 'image');

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0d16] text-slate-900 dark:text-slate-100 transition-colors">
      <Header />
      <section className="relative overflow-hidden grid-hero border-b border-slate-200 dark:border-white/10">
        <div className="absolute -top-24 right-0 w-96 h-96 rounded-full bg-rose-500/15 blur-[110px]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mb-6">
            <Link to="/" className="hover:text-rose-500">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-700 dark:text-slate-200 font-medium">{tool.name}</span>
          </div>
          <div className={`grid place-items-center w-16 h-16 mx-auto rounded-2xl ${ICON_TILE[tool.color] || ICON_TILE.rose}`}>
            <Icon className="w-8 h-8" />
          </div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-5">{tool.name}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-xl mx-auto leading-relaxed">{tool.desc}</p>
        </div>
      </section>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        {body}
        {related.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-lg mb-4">More image tools</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {related.map((t) => {
                const RI = Icons[t.icon] || Icons.Image;
                return (
                  <Link key={t.slug} to={`/tool/${t.slug}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 hover:border-rose-300 dark:hover:border-rose-500/40 transition-colors">
                    <div className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${ICON_TILE[t.color] || ICON_TILE.rose}`}><RI className="w-5 h-5" /></div>
                    <span className="text-sm font-semibold">{t.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
}
