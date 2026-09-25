import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Palette, Save, RefreshCw, ExternalLink, CheckCircle2, AlertCircle,
  Terminal, Eye, Loader2, Info
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useCustomPages } from '../../lib/CustomPageContext';
import { CUSTOM_PAGE_REGISTRY, findPageLabel } from '../../lib/customPageRegistry';
import { routeToUrl } from '../../lib/routing';
import { CustomPageMode } from '../../types';

interface FormState {
  mode: CustomPageMode;
  html: string;
  css: string;
  hideChrome: boolean;
}

const EMPTY_FORM: FormState = { mode: 'off', html: '', css: '', hideChrome: false };

const MODE_OPTIONS: { value: CustomPageMode; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'Show the built-in page, untouched.' },
  { value: 'css', label: 'CSS Overlay', description: 'Keep the built-in page, layer your CSS on top of it.' },
  { value: 'replace', label: 'Full Replace', description: 'Swap the entire page for your own HTML + CSS.' }
];

export const AdminPageDesigner: React.FC = () => {
  const { refresh: refreshPublicPages } = useCustomPages();

  const [allConfigs, setAllConfigs] = useState<Record<string, FormState>>({});
  const [selectedPage, setSelectedPage] = useState<string>(CUSTOM_PAGE_REGISTRY[0].pages[0].key);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/admin/custom-pages');
      if (res.success && res.data) {
        setAllConfigs(res.data);
      } else {
        showToast('error', res.error?.message || 'Failed to load page overrides.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to load page overrides.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    setForm(allConfigs[selectedPage] || EMPTY_FORM);
  }, [selectedPage, allConfigs]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiRequest(`/admin/custom-pages/${selectedPage}`, {
        method: 'PUT',
        body: JSON.stringify({
          mode: form.mode,
          html: form.html,
          css: form.css,
          hideChrome: form.hideChrome
        })
      });
      if (res.success) {
        setAllConfigs(prev => ({ ...prev, [selectedPage]: form }));
        showToast('success', `Saved override for "${findPageLabel(selectedPage)}".`);
        refreshPublicPages();
      } else {
        showToast('error', res.error?.message || 'Failed to save.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await apiRequest(`/admin/custom-pages/${selectedPage}`, { method: 'DELETE' });
      if (res.success) {
        setAllConfigs(prev => {
          const next = { ...prev };
          delete next[selectedPage];
          return next;
        });
        setForm(EMPTY_FORM);
        showToast('success', `Reset "${findPageLabel(selectedPage)}" to the default look.`);
        refreshPublicPages();
      } else {
        showToast('error', res.error?.message || 'Failed to reset.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to reset.');
    } finally {
      setResetting(false);
    }
  };

  const previewSrcDoc = useMemo(() => {
    if (form.mode !== 'replace') return '';
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>html, body { margin: 0; padding: 0; background: #09090b; color: #fff; }</style>
    <style>${form.css}</style>
  </head>
  <body>${form.html}</body>
</html>`;
  }, [form.mode, form.html, form.css]);

  const liveUrl = routeToUrl(selectedPage, {});

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Palette className="h-6 w-6 text-amber-400" /> Page Designer
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Pick any page on the site and either layer your own CSS on top of it, or replace it entirely
            with your own HTML and CSS. Changes apply live to everyone who visits that page.
          </p>
        </div>
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Open Page</span>
        </a>
      </div>

      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold border ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-6 w-6 text-amber-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: controls */}
          <div className="space-y-5">
            {/* Page picker */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Page</label>
              <select
                value={selectedPage}
                onChange={(e) => setSelectedPage(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
              >
                {CUSTOM_PAGE_REGISTRY.map(group => (
                  <optgroup key={group.group} label={group.group}>
                    {group.pages.map(p => {
                      const cfg = allConfigs[p.key];
                      const badge = cfg && cfg.mode !== 'off' ? ` (${cfg.mode})` : '';
                      return (
                        <option key={p.key} value={p.key}>{p.label}{badge}</option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Mode selector */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {MODE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, mode: opt.value }))}
                    className={`text-left p-3 rounded-xl border text-xs transition-colors ${
                      form.mode === opt.value
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold mb-1">{opt.label}</div>
                    <div className="text-[10px] leading-snug opacity-80">{opt.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* CSS editor - shown for css and replace modes */}
            {(form.mode === 'css' || form.mode === 'replace') && (
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-amber-400" /> CSS
                  </label>
                  {form.mode === 'css' && (
                    <span className="text-[10px] text-zinc-500 font-mono">
                      scope with [data-custom-page="{selectedPage}"]
                    </span>
                  )}
                </div>
                <textarea
                  value={form.css}
                  onChange={(e) => setForm(f => ({ ...f, css: e.target.value }))}
                  placeholder={form.mode === 'css'
                    ? `[data-custom-page="${selectedPage}"] h1 {\n  color: #f59e0b;\n}`
                    : 'body {\n  font-family: sans-serif;\n}'}
                  spellCheck={false}
                  className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-amber-500/50 resize-y"
                />
              </div>
            )}

            {/* HTML editor - shown for replace mode only */}
            {form.mode === 'replace' && (
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-amber-400" /> HTML
                </label>
                <textarea
                  value={form.html}
                  onChange={(e) => setForm(f => ({ ...f, html: e.target.value }))}
                  placeholder={'<div style="padding: 4rem; text-align: center;">\n  <h1>Your custom page</h1>\n</div>'}
                  spellCheck={false}
                  className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-xs font-mono text-sky-300 focus:outline-none focus:border-amber-500/50 resize-y"
                />

                <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.hideChrome}
                    onChange={(e) => setForm(f => ({ ...f, hideChrome: e.target.checked }))}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-amber-500"
                  />
                  <span className="text-xs text-zinc-300">Hide navbar, sidebar & footer (full-bleed page)</span>
                </label>
              </div>
            )}

            {/* Info note */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-500 leading-relaxed">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-500" />
              <span>
                Full Replace renders your HTML/CSS inside a sandboxed frame, so a mistake here can't break the
                rest of the admin panel. Scripts are allowed to run inside that frame.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-zinc-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Save Changes</span>
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-60 transition-colors"
              >
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Right: preview */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden flex flex-col min-h-[420px]">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-800 text-xs font-bold text-zinc-300 uppercase tracking-wider">
              <Eye className="h-3.5 w-3.5 text-amber-400" /> Preview
            </div>

            {form.mode === 'off' && (
              <div className="flex-1 flex items-center justify-center text-center p-8 text-xs text-zinc-500">
                This page is showing its default, built-in design.
              </div>
            )}

            {form.mode === 'css' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
                <p className="text-xs text-zinc-500 max-w-sm">
                  CSS overlays apply on top of the live React page, so the most accurate preview is the real
                  page itself. Save your changes, then open the page to see them.
                </p>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open {findPageLabel(selectedPage)}
                </a>
              </div>
            )}

            {form.mode === 'replace' && (
              <iframe
                title="page-designer-preview"
                srcDoc={previewSrcDoc}
                className="flex-1 w-full border-0 bg-zinc-950"
                sandbox="allow-scripts allow-forms allow-popups"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
