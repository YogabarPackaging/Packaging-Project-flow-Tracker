import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  Download,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Search,
  ArrowRight,
  X,
  AlertTriangle,
  FileCheck,
  Package,
  Layers,
  Info,
  Loader2
} from 'lucide-react';
import {
  validateImport,
  commitImport,
  downloadImportTemplate,
  uploadImportExcel,
  uploadImportExcelCommit
} from '../../api';

const SAMPLE_TEMPLATE = [
  {
    "projectName": "Dark Chocolate Peanut Butter Bar 50g",
    "fgCode": "FG-PB-50G-NPD",
    "skuSize": "50g",
    "targetLaunchDate": "2026-11-30",
    "supplier": "Huhtamaki Packaging Ltd",
    "factory": "Bangalore Unit 1",
    "materials": [
      { "name": "Primary Cold Seal Wrapper", "type": "Flexible Pouch", "pmCode": "PM/PR/POU/50580", "printType": "Gravure Print" },
      { "name": "Display Monocarton 6-Pack", "type": "Monocarton", "pmCode": "PM/SE/MON/50581", "printType": "Digital Print" }
    ]
  }
];

export default function ImportDataModal({ isOpen, onClose, onImportSuccess }) {
  const [activeTab, setActiveTab] = useState('excel'); // 'excel' | 'json'

  // Excel state
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // JSON state
  const [jsonText, setJsonText] = useState(JSON.stringify(SAMPLE_TEMPLATE, null, 2));

  // Shared validation & processing state
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [parsedSummary, setParsedSummary] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // ── Download Excel Template ────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      setError('');
      const res = await downloadImportTemplate();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      link.setAttribute('download', `PKG_Tracker_Import_Template_${today}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to download template. Please try again.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // ── File Drop & Selection Handlers ─────────────────────────────────────────
  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith('.xlsx')) {
      setError('Please select an Excel (.xlsx) file.');
      return;
    }
    setFile(selectedFile);
    setError('');
    setSuccessMessage('');
    setValidationResult(null);
    setParsedSummary(null);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // ── Validate (Dry Run) ────────────────────────────────────────────────────
  const handleValidate = async () => {
    setError('');
    setSuccessMessage('');
    setValidating(true);
    try {
      if (activeTab === 'excel') {
        if (!file) {
          throw new Error('Please select an Excel (.xlsx) file first.');
        }
        const res = await uploadImportExcel(file, true);
        setValidationResult(res.data?.validation || null);
        setParsedSummary(res.data?.parsed || null);
      } else {
        let records;
        try {
          records = JSON.parse(jsonText);
        } catch {
          throw new Error('Invalid JSON format. Please verify JSON array syntax.');
        }
        if (!Array.isArray(records)) {
          throw new Error('Payload must be a JSON array of project records.');
        }
        const res = await validateImport(records);
        setValidationResult(res.data?.result || null);
        setParsedSummary({
          projectCount: records.length,
          materialCount: records.reduce((s, r) => s + (r.materials?.length || 0), 0)
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Validation request failed');
      setValidationResult(null);
      setParsedSummary(null);
    } finally {
      setValidating(false);
    }
  };

  // ── Commit & Ingest ────────────────────────────────────────────────────────
  const handleCommit = async () => {
    if (!validationResult || !validationResult.canCommit) return;
    setCommitting(true);
    setError('');
    try {
      if (activeTab === 'excel') {
        const res = await uploadImportExcelCommit(file);
        const imported = res.data?.result?.importedCount || res.data?.parsed?.projectCount || 0;
        const matCount = res.data?.result?.materialCount || res.data?.parsed?.materialCount || 0;
        setSuccessMessage(`Successfully ingested ${imported} project(s) with ${matCount} material(s) from Excel!`);
      } else {
        const records = JSON.parse(jsonText);
        const res = await commitImport(records);
        setSuccessMessage(`Successfully ingested ${res.data?.result?.importedCount || 0} project(s)!`);
      }

      if (onImportSuccess) onImportSuccess();
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to commit import');
    } finally {
      setCommitting(false);
    }
  };

  const handleCopyTemplate = () => {
    setJsonText(JSON.stringify(SAMPLE_TEMPLATE, null, 2));
    setValidationResult(null);
    setParsedSummary(null);
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={onClose}>
      <div
        className="modal-content"
        style={{
          width: '820px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--card-bg, #FFFFFF)',
          border: '1px solid var(--border-color, #E2EBE6)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px -12px rgba(16, 43, 54, 0.25), 0 0 0 1px rgba(0, 135, 103, 0.1)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color, #E2EBE6)',
            background: 'var(--surface-secondary, #F4F8F6)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(0, 135, 103, 0.12)',
                border: '1px solid rgba(0, 135, 103, 0.25)',
                color: 'var(--primary-accent, #008767)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <UploadCloud size={22} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: 'var(--text-main, #102B36)' }}>
                  Controlled Data Import
                </h3>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(0, 135, 103, 0.12)',
                    color: 'var(--primary-accent, #008767)',
                    border: '1px solid rgba(0, 135, 103, 0.25)'
                  }}
                >
                  Excel & JSON Batch
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary, #526B74)' }}>
                Import projects and materials in bulk with automated validation and duplicate prevention
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px', color: 'var(--text-secondary, #526B74)', borderRadius: '8px' }}
            title="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: 'var(--surface-secondary, #F4F8F6)',
            borderBottom: '1px solid var(--border-color, #E2EBE6)'
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('excel');
              setValidationResult(null);
              setParsedSummary(null);
              setError('');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: activeTab === 'excel' ? '700' : '500',
              border: '1px solid',
              borderColor: activeTab === 'excel' ? 'var(--primary-accent, #008767)' : 'transparent',
              background: activeTab === 'excel' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'excel' ? 'var(--primary-accent, #008767)' : 'var(--text-secondary, #526B74)',
              cursor: 'pointer',
              boxShadow: activeTab === 'excel' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Excel Spreadsheet (.xlsx)</span>
            <span
              style={{
                fontSize: '9px',
                fontWeight: '700',
                padding: '1px 6px',
                borderRadius: '10px',
                background: activeTab === 'excel' ? 'rgba(0, 135, 103, 0.15)' : 'rgba(0,0,0,0.06)',
                color: activeTab === 'excel' ? 'var(--primary-accent, #008767)' : 'var(--text-muted)'
              }}
            >
              Recommended
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('json');
              setValidationResult(null);
              setParsedSummary(null);
              setError('');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: activeTab === 'json' ? '700' : '500',
              border: '1px solid',
              borderColor: activeTab === 'json' ? 'var(--primary-accent, #008767)' : 'transparent',
              background: activeTab === 'json' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'json' ? 'var(--primary-accent, #008767)' : 'var(--text-secondary, #526B74)',
              cursor: 'pointer',
              boxShadow: activeTab === 'json' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <FileCode size={16} />
            <span>Raw JSON Array</span>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.25)', color: '#DC2626', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={17} style={{ flexShrink: 0 }} /> <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(0, 135, 103, 0.1)', border: '1px solid rgba(0, 135, 103, 0.25)', color: '#008767', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={17} style={{ flexShrink: 0 }} /> <span>{successMessage}</span>
            </div>
          )}

          {/* ════ TAB 1: EXCEL MODE ════ */}
          {activeTab === 'excel' && (
            <>
              {/* Step 1: Download Template Card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(0, 135, 103, 0.06) 0%, rgba(0, 180, 162, 0.04) 100%)',
                  border: '1px solid rgba(0, 135, 103, 0.2)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'rgba(0, 135, 103, 0.15)',
                      color: 'var(--primary-accent, #008767)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Download size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main, #102B36)' }}>
                      Step 1: Download the Excel Template
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary, #526B74)', marginTop: '2px' }}>
                      Pre-filled with validation dropdowns, sample rows, and separate <strong>Projects</strong> & <strong>Materials</strong> sheets.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--primary-accent, #008767)',
                    background: '#FFFFFF',
                    color: 'var(--primary-accent, #008767)',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 4px rgba(0, 135, 103, 0.1)'
                  }}
                >
                  {downloadingTemplate ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Download .xlsx Template</span>
                    </>
                  )}
                </button>
              </div>

              {/* Step 2: Upload Area */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main, #102B36)', marginBottom: '8px' }}>
                  Step 2: Upload Completed Excel File
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: 'none' }}
                  onChange={e => handleFileChange(e.target.files?.[0])}
                />

                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed',
                    borderColor: dragActive
                      ? 'var(--primary-accent, #008767)'
                      : file
                        ? 'rgba(0, 135, 103, 0.4)'
                        : 'var(--border-color, #E2EBE6)',
                    borderRadius: '12px',
                    padding: '28px 20px',
                    textAlign: 'center',
                    background: dragActive
                      ? 'rgba(0, 135, 103, 0.04)'
                      : file
                        ? 'rgba(0, 135, 103, 0.02)'
                        : 'var(--surface-secondary, #F4F8F6)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {file ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '12px',
                          background: 'rgba(0, 135, 103, 0.12)',
                          color: 'var(--primary-accent, #008767)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <FileSpreadsheet size={24} />
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main, #102B36)' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #829A9E)' }}>
                        {(file.size / 1024).toFixed(1)} KB • Ready for validation
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setValidationResult(null);
                          setParsedSummary(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        style={{
                          marginTop: '6px',
                          background: 'none',
                          border: 'none',
                          color: '#DC2626',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Remove and select another file
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '12px',
                          background: 'rgba(0, 135, 103, 0.08)',
                          color: 'var(--primary-accent, #008767)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <UploadCloud size={24} />
                      </div>
                      <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-main, #102B36)' }}>
                        Click to browse or drag and drop your Excel file here
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary, #526B74)' }}>
                        Supports <strong>.xlsx</strong> files created with the official template
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ════ TAB 2: JSON RAW MODE ════ */}
          {activeTab === 'json' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-main, #102B36)' }}>
                  Project Batch Records (JSON Array):
                </span>
                <button
                  type="button"
                  onClick={handleCopyTemplate}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-accent, #008767)',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'underline'
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Reset to Sample Template</span>
                </button>
              </div>

              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setValidationResult(null);
                  setParsedSummary(null);
                }}
                rows={9}
                style={{
                  width: '100%',
                  background: 'var(--surface-secondary, #F4F8F6)',
                  border: '1px solid var(--border-color, #E2EBE6)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: 'var(--text-main, #102B36)',
                  lineHeight: 1.5,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
                placeholder="Paste JSON array here..."
              />
            </>
          )}

          {/* ════ VALIDATION PREVIEW & FINDINGS ════ */}
          {validationResult && (
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--surface-secondary, #F4F8F6)',
                border: '1px solid var(--border-color, #E2EBE6)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {/* Summary Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {validationResult.canCommit ? (
                    <CheckCircle2 size={18} color="#008767" />
                  ) : (
                    <AlertCircle size={18} color="#DC2626" />
                  )}
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: validationResult.canCommit ? '#008767' : '#DC2626'
                    }}
                  >
                    {validationResult.canCommit
                      ? 'Validation Passed — Ready for Batch Import'
                      : 'Validation Issues Detected — Please Review'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11.5px', color: 'var(--text-secondary, #526B74)' }}>
                  {parsedSummary && (
                    <span style={{ fontWeight: '600', color: 'var(--text-main, #102B36)' }}>
                      📦 {parsedSummary.projectCount} Projects • 🏷️ {parsedSummary.materialCount} Materials
                    </span>
                  )}
                  <span>
                    ({validationResult.validCount} valid / {validationResult.invalidCount} invalid)
                  </span>
                </div>
              </div>

              {/* Records Breakdown List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                {validationResult.validationResults?.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#FFFFFF',
                      border: '1px solid var(--border-color, #E2EBE6)',
                      fontSize: '11.5px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-main, #102B36)' }}>
                        {r.projectName}
                      </span>
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: r.isValid ? 'rgba(0, 135, 103, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                          color: r.isValid ? '#008767' : '#DC2626'
                        }}
                      >
                        {r.isValid ? 'VALID' : 'INVALID'}
                      </span>
                    </div>

                    {r.errors?.map((err, errIdx) => (
                      <div key={errIdx} style={{ color: '#DC2626', fontSize: '11px', marginTop: '2px' }}>
                        • {err}
                      </div>
                    ))}
                    {r.warnings?.map((warn, wIdx) => (
                      <div key={wIdx} style={{ color: '#D97706', fontSize: '11px', marginTop: '2px' }}>
                        • Note: {warn}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color, #E2EBE6)',
            background: 'var(--surface-secondary, #F4F8F6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <button
            type="button"
            onClick={handleValidate}
            disabled={validating || committing || (activeTab === 'excel' && !file)}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: '600',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: (validating || committing || (activeTab === 'excel' && !file)) ? 'not-allowed' : 'pointer'
            }}
          >
            {validating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Validating...</span>
              </>
            ) : (
              <>
                <Search size={14} />
                <span>Validate Data (Dry Run)</span>
              </>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '12px', color: 'var(--text-secondary, #526B74)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={!validationResult?.canCommit || committing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: '700',
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: !validationResult?.canCommit || committing
                  ? '#CBD5E1'
                  : 'var(--primary-accent, #008767)',
                color: '#FFFFFF',
                cursor: !validationResult?.canCommit || committing ? 'not-allowed' : 'pointer',
                boxShadow: !validationResult?.canCommit || committing ? 'none' : '0 2px 6px rgba(0, 135, 103, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              {committing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <span>Commit Import</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

