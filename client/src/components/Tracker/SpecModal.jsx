import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Edit2, Eye, Save, Send, CheckCircle2, ShieldCheck, Printer, Download, Sparkles, Plus, Trash2, X, FileText, Check } from 'lucide-react';
import { getDefaultSpecSheet, generateDefaultPMCode, getArtworkCode, getMaterialSpecCategory } from '../../specTemplates';
import { saveSpecSheet, checkSpecSheet, approveSpecSheet, rejectSpecSheet, updateSpecInLibrary } from '../../api';
import SpecConverterModal from '../Specs/SpecConverterModal';
import { fmt } from '../../utils';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/* ─── Print-only styles injected once (A4 Standard 10mm Margins) ────────── */
const PRINT_STYLE_ID = 'spec-print-styles';
function injectPrintStyles() {
  let style = document.getElementById(PRINT_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
    @page {
      size: A4 portrait;
      margin: 0 !important;
    }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0 !important; padding: 0 !important; }
    }
  `;
}

/* ─── Pantone Color Palette Helper (Approximate Hex for Display) ────────── */
function getPantoneColorHex(colorName = '') {
  const c = String(colorName || '').toLowerCase();
  if (c.includes('gold')) return '#d4af37';
  if (c.includes('2346')) return '#d82c66';
  if (c.includes('1955')) return '#8a1c3d';
  if (c.includes('358')) return '#99cc66';
  if (c.includes('4210')) return '#668073';
  if (c.includes('136-8') || c.includes('136')) return '#20b2aa';
  if (c.includes('7-8')) return '#e6a117';
  if (c.includes('68-7') || c.includes('pink') || c.includes('magenta')) return '#d63384';
  if (c.includes('127-5') || c.includes('cyan') || c.includes('teal')) return '#3b82a6';
  if (c.includes('1505') || c.includes('orange')) return '#f97316';
  if (c.includes('116') || c.includes('yellow')) return '#eab308';
  if (c.includes('green') || c.includes('347')) return '#15803d';
  if (c.includes('blue') || c.includes('286')) return '#1d4ed8';
  if (c.includes('red') || c.includes('warm red')) return '#dc2626';
  if (c.includes('white')) return '#ffffff';
  if (c.includes('black')) return '#111827';
  return '#cbd5e1';
}

/* ─── Safe Color Array Helper ───────────────────────────────────────────── */
function getColorsArray(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/* ─── Safe Variant Artwork Resolver ──────────────────────────────────────── */
function resolveVariantArtworkFiles(variantObj, parentArtworkFiles = [], material = {}, specSheet = {}) {
  let files = Array.isArray(variantObj?.artworkFiles) && variantObj.artworkFiles.length > 0
    ? variantObj.artworkFiles
    : [];

  if (variantObj?.hasRemovedArtwork && files.length === 0) {
    return [];
  }

  if (files.length === 0 && (variantObj?.artworkUrl || variantObj?.artwork)) {
    const artUrl = variantObj.artworkUrl || variantObj.artwork;
    const vName = variantObj?.variantName || variantObj?.name || 'Variant';
    files = [{ name: `${vName} Artwork`, url: artUrl, type: 'image/png' }];
  }

  if (files.length === 0 && Array.isArray(parentArtworkFiles) && parentArtworkFiles.length > 0) {
    files = parentArtworkFiles;
  }

  if (files.length === 0 && Array.isArray(specSheet?.artworkFiles) && specSheet.artworkFiles.length > 0) {
    files = specSheet.artworkFiles;
  }

  if (files.length === 0 && Array.isArray(material?.artworkFiles) && material.artworkFiles.length > 0) {
    files = material.artworkFiles;
  }

  if (files.length === 0 && Array.isArray(material?.specSheet?.artworkFiles) && material.specSheet.artworkFiles.length > 0) {
    files = material.specSheet.artworkFiles;
  }

  if (files.length === 0 && (material?.artworkUrl || material?.artwork)) {
    const matName = material.name || variantObj?.variantName || 'Material';
    files = [{ name: `${matName} Artwork`, url: material.artworkUrl || material.artwork, type: 'image/png' }];
  }

  return (files || [])
    .filter(Boolean)
    .map(f => typeof f === 'string' ? { name: `${variantObj?.variantName || material?.name || 'Material'} Artwork`, url: f, type: 'image/png' } : f);
}

/* ─── Safe Variant Normalizer ───────────────────────────────────────────── */
function normalizeVariants(rawVariants, defaultItemCode, defaultName, defaultAwCode, defaultNetWeight, defaultArtworkFiles = []) {
  const safeDefaultFiles = (Array.isArray(defaultArtworkFiles) ? defaultArtworkFiles : (defaultArtworkFiles ? [defaultArtworkFiles] : []))
    .filter(Boolean)
    .map(f => typeof f === 'string' ? { name: `${defaultName || 'Standard SKU'} Artwork`, url: f, type: 'image/png' } : f);

  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    return [{
      id: 'var-1',
      variantName: defaultName || 'Standard SKU',
      name: defaultName || 'Standard SKU',
      itemCode: defaultItemCode || 'PM-TBD',
      code: defaultItemCode || 'PM-TBD',
      artworkCode: defaultAwCode || getArtworkCode(defaultItemCode),
      artworkFiles: safeDefaultFiles,
      pantoneColors: ['CMYK', 'Gold'],
      dimensions: 'Standard Dimensions',
      barcode: '',
      netWeight: defaultNetWeight || 'Standard',
      notes: ''
    }];
  }

  return rawVariants.map((v, idx) => {
    const vName = v.variantName || v.name || `Variant ${idx + 1}`;
    const vCode = v.itemCode || v.code || defaultItemCode || 'PM-TBD';
    const vAwCode = v.artworkCode || (v.code ? getArtworkCode(v.code) : '') || getArtworkCode(vCode);
    let files = Array.isArray(v.artworkFiles) && v.artworkFiles.length > 0 ? v.artworkFiles : [];
    if (!v.hasRemovedArtwork) {
      if (files.length === 0 && (v.artworkUrl || v.artwork)) {
        files = [{ name: `${vName} Artwork`, url: v.artworkUrl || v.artwork, type: 'image/png' }];
      }
      if (files.length === 0 && idx === 0 && safeDefaultFiles.length > 0) {
        files = safeDefaultFiles;
      }
    } else {
      files = [];
    }
    files = files.map(f => typeof f === 'string' ? { name: `${vName} Artwork`, url: f, type: 'image/png' } : f);

    return {
      ...v,
      id: v.id || `var-${idx + 1}`,
      variantName: vName,
      name: vName,
      itemCode: vCode,
      code: vCode,
      artworkCode: vAwCode,
      artworkFiles: files,
      hasRemovedArtwork: !!v.hasRemovedArtwork,
      pantoneColors: getColorsArray(v.pantoneColors),
      dimensions: v.dimensions || '240mm W × 115mm H',
      barcode: v.barcode || '',
      netWeight: v.netWeight || defaultNetWeight || 'Standard',
      notes: v.notes || ''
    };
  });
}

/* ─── Specification Pagination Engine ───────────────────────────────────── */
function getSpecPagination(specSheet, material = {}) {
  if (!specSheet) return { isMultiPage: false, hasMultiSections: false, totalPages: 2, specPagesCount: 1, artworkPageCount: 1, page1Params: [], page2Params: [], variants: [] };
  
  // Resolve category safely (checking material type, description, section title, docName)
  let category = specSheet.category;
  const checkStr = `${material?.type || ''} ${specSheet.general?.materialDescription || ''} ${specSheet.sectionTitle || ''} ${specSheet.docHeader?.docName || ''}`;
  const inferredCat = getMaterialSpecCategory(checkStr);
  if (!category || category === 'rigid_container' || category === 'generic') {
    if (inferredCat !== 'generic') {
      category = inferredCat;
    }
  }

  const params = Array.isArray(specSheet.parameters) ? specSheet.parameters : [];
  const rawVariants = Array.isArray(specSheet.variants) ? specSheet.variants : [];

  // Resolve effective artwork files across all potential locations
  let effectiveAwFiles = [];
  if (Array.isArray(specSheet.artworkFiles) && specSheet.artworkFiles.length > 0) {
    effectiveAwFiles = specSheet.artworkFiles;
  } else if (Array.isArray(material?.artworkFiles) && material.artworkFiles.length > 0) {
    effectiveAwFiles = material.artworkFiles;
  } else if (Array.isArray(material?.specSheet?.artworkFiles) && material.specSheet.artworkFiles.length > 0) {
    effectiveAwFiles = material.specSheet.artworkFiles;
  } else if (material?.artworkUrl || material?.artwork) {
    effectiveAwFiles = [{ name: `${material.name || 'Material'} Artwork`, url: material.artworkUrl || material.artwork, type: 'image/png' }];
  }

  const variants = normalizeVariants(
    rawVariants,
    specSheet.docHeader?.itemCode || material?.pmCode,
    specSheet.docHeader?.docName || material?.name,
    specSheet.docHeader?.artworkCode || material?.artworkCode,
    specSheet.general?.netWeight || 'Standard',
    effectiveAwFiles
  );
  const artworkFiles = Array.isArray(specSheet.artworkFiles) && specSheet.artworkFiles.length > 0
    ? specSheet.artworkFiles
    : effectiveAwFiles;
  
  // Artwork pages count: at least 1 page per variant if variants exist, or 1 page if artwork files exist
  const artworkPageCount = variants.length > 0 ? variants.length : Math.max(1, artworkFiles.length > 0 ? 1 : 1);

  // Check if this is a true multi-section assembly (e.g. PET Jar + Cap + WAD)
  const hasMultiSections = category === 'rigid_container' && Array.isArray(specSheet.sections) && specSheet.sections.length >= 2;

  let isMultiPage = false;
  let page1Params = params;
  let page2Params = [];

  if (hasMultiSections) {
    // Multi-section rigid container (e.g. PET Jar + Cap + WAD):
    // ALWAYS multi-page (2 spec pages + artwork pages) so that Page 1 never overflows
    // and both pages display their signature footers cleanly!
    // Page 1 gets Section 0 (Jar Details) + Section 1 (Cap Details)
    // Page 2 gets Section 2 (WAD Details) + Performance Tests + Critical Requirements + Packing & Storage
    isMultiPage = true;
    page1Params = [
      ...(specSheet.sections[0]?.parameters || []),
      ...(specSheet.sections[1]?.parameters || [])
    ];
    page2Params = (specSheet.sections.slice(2).flatMap(s => s.parameters || []));
  } else if (params.length > 20) {
    // Single section specs: up to 20 parameters fit comfortably on Page 1 alongside tests and packing/storage.
    // Only split if more than 20 parameters.
    isMultiPage = true;
    const splitIdx = Math.ceil(params.length / 2);
    page1Params = params.slice(0, splitIdx);
    page2Params = params.slice(splitIdx);
  } else {
    // All standard packaging materials (Labels, Shippers, Cartons, Pouches, Film Rolls, Tubes, Closures, Tins <= 20 parameters)
    // fit completely on Page 1: Technical Parameters, Performance Tests, and Packing & Storage all on Page 1!
    isMultiPage = false;
    page1Params = params;
    page2Params = [];
  }

  const specPagesCount = isMultiPage ? 2 : 1;
  const totalPages = specPagesCount + artworkPageCount;

  return {
    category,
    hasMultiSections,
    isMultiPage,
    specPagesCount,
    artworkPageCount,
    totalPages,
    page1Params,
    page2Params,
    variants
  };
}

export default function SpecModal({
  specData,
  onClose,
  onSave,
  canEdit = true,
  currentUser = {},
  isAdmin = false,
  isSuperAdmin = false,
  onRefresh,
  showToast
}) {
  const [activeTab, setActiveTab] = useState('combined'); // 'combined' | 'sheet' | 'artwork' | 'edit'
  const [specSheet, setSpecSheet] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConverter, setShowConverter] = useState(false);
  const [promptAction, setPromptAction] = useState(null);
  const [promptText, setPromptText] = useState('');
  const [previewArtworkModal, setPreviewArtworkModal] = useState(null);
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  
  // Active variant index in Artwork tab
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);

  // Artwork upload state
  const [artworkFiles, setArtworkFiles] = useState([]);
  const artworkInputRef = useRef(null);
  const variantArtworkInputRef = useRef(null);
  const [activeVariantUploadIdx, setActiveVariantUploadIdx] = useState(null);
  // Ref for synchronous access to the active upload index (state update is async)
  const activeVariantUploadIdxRef = useRef(null);
  const isPrintingRef = useRef(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');

  // Digital Signing Dialog State
  const [digitalSignModal, setDigitalSignModal] = useState({
    isOpen: false,
    roleKey: 'preparedBy',
    roleLabel: 'Prepared By',
    signerName: '',
    signerTitle: '',
    signerComments: '',
    acknowledged: true
  });

  const handleOpenDigitalSign = (roleKey = 'preparedBy', roleLabel = 'Prepared By') => {
    let defTitle = currentUser?.title || '';
    if (!defTitle) {
      if (roleKey === 'approvedBy') defTitle = 'Packaging Head';
      else if (roleKey === 'checkedBy') defTitle = 'Project Manager';
      else defTitle = 'Packaging Executive / Engineer';
    }
    setDigitalSignModal({
      isOpen: true,
      roleKey,
      roleLabel,
      signerName: currentUser?.name || '',
      signerTitle: defTitle,
      signerComments: '',
      acknowledged: true
    });
  };

  const handleConfirmDigitalSign = async () => {
    const { roleKey, roleLabel, signerName, signerTitle, signerComments, acknowledged } = digitalSignModal;
    if (!acknowledged) {
      if (showToast) showToast('⚠️ Please check the review confirmation box', 'warning');
      return;
    }
    if (!signerName.trim()) {
      if (showToast) showToast('⚠️ Signer name is required', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const digId = `DS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const signedObj = {
        name: signerName.trim(),
        title: signerTitle.trim() || 'Packaging Specialist',
        role: currentUser?.role || 'updater',
        email: currentUser?.email || '',
        date: new Date().toISOString(),
        signed: true,
        digitalId: digId,
        comments: signerComments.trim()
      };

      const updatedGov = { ...(specSheet.governance || {}) };
      updatedGov[roleKey] = signedObj;
      if (roleKey === 'approvedBy') {
        updatedGov.status = 'APPROVED';
      } else if (roleKey === 'checkedBy' && updatedGov.status !== 'APPROVED') {
        updatedGov.status = 'CHECKED_PENDING_APPROVAL';
      }

      const updatedSheet = {
        ...specSheet,
        governance: updatedGov
      };

      setSpecSheet(updatedSheet);
      setDigitalSignModal(prev => ({ ...prev, isOpen: false }));

      if (material.libId) {
        await updateSpecInLibrary(material.libId, {
          specData: updatedSheet,
          specName: updatedSheet.docHeader?.docName || material.name,
          itemCode: updatedSheet.docHeader?.itemCode || material.pmCode
        });
      } else if (project.id) {
        const res = await saveSpecSheet(project.id, mIdx, updatedSheet, false);
        if (res?.data?.specSheet) {
          setSpecSheet(res.data.specSheet);
        }
      }
      if (onSave) onSave(updatedSheet);

      if (showToast) showToast(`🛡️ Digitally Signed as ${roleLabel} by ${signerName.trim()} (${digId})!`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Digital sign error:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to apply digital signature';
      if (showToast) showToast(`❌ ${msg}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const triggerVariantArtworkUpload = (vIdx) => {
    // Set ref synchronously so handleVariantArtworkUpload reads correct index
    activeVariantUploadIdxRef.current = vIdx;
    setActiveVariantUploadIdx(vIdx);
    if (variantArtworkInputRef.current) {
      variantArtworkInputRef.current.value = '';
      variantArtworkInputRef.current.click();
    }
  };

  useEffect(() => {
    injectPrintStyles();
  }, []);

  useEffect(() => {
    if (specData && specData.material) {
      const { material, project, mIdx } = specData;
      const pm = material.pmCode || generateDefaultPMCode(material.type, mIdx || 0);
      const aw = getArtworkCode(pm);

      // Safe artwork files resolution across all potential locations
      let effectiveArtworkFiles = [];
      if (Array.isArray(material.artworkFiles) && material.artworkFiles.length > 0) {
        effectiveArtworkFiles = material.artworkFiles;
      } else if (Array.isArray(material.specSheet?.artworkFiles) && material.specSheet.artworkFiles.length > 0) {
        effectiveArtworkFiles = material.specSheet.artworkFiles;
      } else if (material.artworkUrl || material.artwork) {
        effectiveArtworkFiles = [{ name: `${material.name || 'Material'} Artwork`, url: material.artworkUrl || material.artwork, type: 'image/png' }];
      }

      if (material.specSheet && material.specSheet.docHeader) {
        const sheet = JSON.parse(JSON.stringify(material.specSheet));
        sheet.docHeader.itemCode = material.clubbedCodes || sheet.docHeader.clubbedCodes || sheet.docHeader.itemCode || pm;
        sheet.docHeader.artworkCode = aw;
        
        // Ensure sheet.artworkFiles has prefilled artwork if empty
        const sheetAwFiles = (Array.isArray(sheet.artworkFiles) && sheet.artworkFiles.length > 0)
          ? sheet.artworkFiles
          : effectiveArtworkFiles;
        sheet.artworkFiles = sheetAwFiles;

        // Sync variants safely
        const rawVars = (Array.isArray(sheet.variants) && sheet.variants.length > 0)
          ? sheet.variants
          : (Array.isArray(material.variants) && material.variants.length > 0 ? material.variants : []);
        sheet.variants = normalizeVariants(rawVars, pm, project?.projectName || material.name, aw, project?.skuSize || project?.grammage, sheetAwFiles);
        setSpecSheet(sheet);
        setArtworkFiles(sheetAwFiles);
      } else {
        const defaultSheet = getDefaultSpecSheet(
          material.type,
          project?.projectName || '',
          project?.skuSize || project?.grammage || '',
          mIdx || 0
        );
        defaultSheet.docHeader.itemCode = material.clubbedCodes || material.pmCode || pm;
        defaultSheet.docHeader.artworkCode = aw;
        defaultSheet.artworkFiles = effectiveArtworkFiles;

        const rawVars = Array.isArray(material.variants) && material.variants.length > 0
          ? material.variants
          : (Array.isArray(defaultSheet.variants) && defaultSheet.variants.length > 0 ? defaultSheet.variants : []);
        defaultSheet.variants = normalizeVariants(rawVars, pm, project?.projectName || material.name, aw, project?.skuSize || project?.grammage, effectiveArtworkFiles);
        setSpecSheet(defaultSheet);
        setArtworkFiles(effectiveArtworkFiles);
      }
      setPromptAction(null);
      setPromptText('');
      setSelectedVariantIdx(0);
    } else {
      setSpecSheet(null);
      setArtworkFiles([]);
    }
  }, [specData]);

  // NOTE: Guard moved below all hooks — see React Rules of Hooks
  const _project = specData?.project || null;
  const _material = specData?.material || null;
  const _mIdx = specData?.mIdx ?? null;

  const { project, material, mIdx } = specData || {};
  const gov = specSheet?.governance || {};
  const status = gov.status || 'DRAFT';

  const isApproved = status === 'APPROVED';
  const isChecked = status === 'CHECKED_PENDING_APPROVAL' || isApproved;
  const isPendingCheck = status === 'PENDING_CHECK';
  const isRevision = status === 'REVISION_REQUESTED';

  const isHead = isSuperAdmin || currentUser?.role === 'superadmin';
  const isPM = isAdmin || currentUser?.role === 'admin' || isHead;
  const canEditSpec = (!isApproved && canEdit) || isPM || isHead;

  /* ── Status Badge ─────────────────────────────────────────────────────── */
  const getStatusBadge = () => {
    const badges = {
      APPROVED: { bg: 'rgba(16,185,129,0.15)', color: '#059669', border: '#059669', icon: '✓', label: 'APPROVED' },
      CHECKED_PENDING_APPROVAL: { bg: 'rgba(124,58,237,0.15)', color: '#7c3aed', border: '#7c3aed', icon: '🛡', label: 'CHECKED — AWAITING APPROVAL' },
      PENDING_CHECK: { bg: 'rgba(245,158,11,0.15)', color: '#b45309', border: '#d97706', icon: '⏳', label: 'SUBMITTED — AWAITING CHECK' },
      REVISION_REQUESTED: { bg: 'rgba(239,68,68,0.15)', color: '#dc2626', border: '#ef4444', icon: '⚠', label: 'REVISION REQUESTED' },
    };
    const b = badges[status] || { bg: 'rgba(148,163,184,0.15)', color: '#475569', border: '#94a3b8', icon: '📝', label: 'DRAFT' };
    return (
      <span style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}`, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
        {b.icon} {b.label}
      </span>
    );
  };

  /* ── Form Handlers ────────────────────────────────────────────────────── */
  const handleHeaderChange = (field, val) =>
    setSpecSheet(prev => ({ ...prev, docHeader: { ...(prev.docHeader || {}), [field]: val } }));

  const handleGeneralChange = (field, val) =>
    setSpecSheet(prev => ({ ...prev, general: { ...(prev.general || {}), [field]: val } }));

  const handleParamChange = (index, field, val) =>
    setSpecSheet(prev => {
      const copy = [...(prev.parameters || [])];
      copy[index] = { ...copy[index], [field]: val };
      return { ...prev, parameters: copy };
    });

  const handleSectionParamChange = (sIdx, pIdx, field, val) =>
    setSpecSheet(prev => {
      const sections = [...(prev.sections || [])];
      if (sections[sIdx] && sections[sIdx].parameters) {
        const pCopy = [...sections[sIdx].parameters];
        pCopy[pIdx] = { ...pCopy[pIdx], [field]: val };
        sections[sIdx] = { ...sections[sIdx], parameters: pCopy };
      }
      return { ...prev, sections };
    });

  const handleAddParam = () =>
    setSpecSheet(prev => ({
      ...prev,
      parameters: [...(prev.parameters || []), { sNo: (prev.parameters?.length || 0) + 1, parameter: '', units: 'mm', standard: '', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' }]
    }));

  const handleRemoveParam = (index) =>
    setSpecSheet(prev => ({
      ...prev,
      parameters: (prev.parameters || []).filter((_, i) => i !== index).map((p, i) => ({ ...p, sNo: i + 1 }))
    }));

  const handleTestChange = (index, field, val) =>
    setSpecSheet(prev => {
      const copy = [...(prev.performanceTests || [])];
      copy[index] = { ...copy[index], [field]: val };
      return { ...prev, performanceTests: copy };
    });

  const handleAddTest = () =>
    setSpecSheet(prev => ({
      ...prev,
      performanceTests: [
        ...(prev.performanceTests || []),
        { test: '', unit: '', standard: '', defectType: 'CR', testStandard: '' }
      ]
    }));

  const handleRemoveTest = (index) =>
    setSpecSheet(prev => ({
      ...prev,
      performanceTests: (prev.performanceTests || []).filter((_, i) => i !== index)
    }));

  const handleAddSectionParam = (sIdx) =>
    setSpecSheet(prev => {
      const sections = [...(prev.sections || [])];
      if (sections[sIdx]) {
        const params = [...(sections[sIdx].parameters || [])];
        params.push({ sNo: params.length + 1, parameter: '', units: 'mm', standard: '', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' });
        sections[sIdx] = { ...sections[sIdx], parameters: params };
      }
      return { ...prev, sections };
    });

  const handleRemoveSectionParam = (sIdx, pIdx) =>
    setSpecSheet(prev => {
      const sections = [...(prev.sections || [])];
      if (sections[sIdx]) {
        const params = (sections[sIdx].parameters || []).filter((_, i) => i !== pIdx).map((p, i) => ({ ...p, sNo: i + 1 }));
        sections[sIdx] = { ...sections[sIdx], parameters: params };
      }
      return { ...prev, sections };
    });

  const handleStoragePackingChange = (field, val) =>
    setSpecSheet(prev => ({ ...prev, storageAndPacking: { ...(prev.storageAndPacking || {}), [field]: val } }));

  /* ── Variant & Clubbed Codes Handlers ─────────────────────────────────── */
  const handleClubbedCodesChange = (val) => {
    setSpecSheet(prev => {
      const header = { ...(prev.docHeader || {}), clubbedCodes: val, itemCode: val || prev.docHeader?.itemCode };
      return { ...prev, docHeader: header };
    });
  };

  const handleAddVariant = () => {
    const vCount = (specSheet.variants || []).length + 1;
    const newPm = generateDefaultPMCode(material.type, vCount + 10);
    const newAw = getArtworkCode(newPm);
    const newVar = {
      id: `var-${Date.now()}`,
      variantName: `Variant ${vCount}`,
      itemCode: newPm,
      artworkCode: newAw,
      artworkFiles: [],
      pantoneColors: ['CMYK', 'Gold'],
      dimensions: 'Standard Dimensions',
      barcode: '',
      netWeight: project.skuSize || 'Standard'
    };
    setSpecSheet(prev => {
      const updatedVars = [...(prev.variants || []), newVar];
      const joinedCodes = updatedVars.map(v => v.itemCode).filter(Boolean).join(', ');
      return {
        ...prev,
        variants: updatedVars,
        docHeader: {
          ...(prev.docHeader || {}),
          clubbedCodes: joinedCodes,
          itemCode: joinedCodes || prev.docHeader?.itemCode
        }
      };
    });
  };

  const handleUpdateVariant = (vIdx, field, val) => {
    setSpecSheet(prev => {
      const updatedVars = [...(prev.variants || [])];
      updatedVars[vIdx] = { ...updatedVars[vIdx], [field]: val };
      if (field === 'itemCode') {
        updatedVars[vIdx].artworkCode = getArtworkCode(val);
        const joinedCodes = updatedVars.map(v => v.itemCode).filter(Boolean).join(', ');
        return {
          ...prev,
          variants: updatedVars,
          docHeader: {
            ...(prev.docHeader || {}),
            clubbedCodes: joinedCodes,
            itemCode: joinedCodes || prev.docHeader?.itemCode
          }
        };
      }
      return { ...prev, variants: updatedVars };
    });
  };

  const handleRemoveVariant = (vIdx) => {
    if ((specSheet.variants || []).length <= 1) return;
    setSpecSheet(prev => {
      const updatedVars = (prev.variants || []).filter((_, i) => i !== vIdx);
      const joinedCodes = updatedVars.map(v => v.itemCode).filter(Boolean).join(', ');
      return {
        ...prev,
        variants: updatedVars,
        docHeader: {
          ...(prev.docHeader || {}),
          clubbedCodes: joinedCodes,
          itemCode: joinedCodes || prev.docHeader?.itemCode
        }
      };
    });
  };

  /* ── Blob URL Helper — converts data: URLs to blob: URLs for safe browser display ── */
  const dataUrlToBlobUrl = (dataUrl) => {
    try {
      if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
      const [header, b64] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: mime }));
    } catch {
      return dataUrl;
    }
  };

  /* ── Open file for viewing (handles data: → blob: conversion) ─────────── */
  const openArtworkFile = (fileObj, title = null) => {
    if (!fileObj?.url) return;
    setPreviewArtworkModal({
      ...fileObj,
      title: title || fileObj.title || fileObj.name || 'Artwork Preview'
    });
    setIsFullScreenPreview(false);
  };

  /* ── Artwork Upload Helper with Image Optimization ────────────────────── */
  const processUploadedFile = (file, customCode = null) => {
    return new Promise((resolve) => {
      if (!file) return resolve(null);
      if (file.size && file.size > 30 * 1024 * 1024) {
        if (showToast) showToast('⚠️ Uploaded file exceeds 30MB. Please use a file under 30MB.', 'warning');
        return resolve(null);
      }
      const pm = customCode || specSheet?.docHeader?.itemCode || material.pmCode || 'PM-SPEC';
      const aw = getArtworkCode(pm);
      const cleanOriginal = file.name.replace(/^AW-[^_]+_/, '').replace(/^PM-[^_]+_/, '');
      const standardizedName = file.name.startsWith(aw) ? file.name : `${aw}_${cleanOriginal}`;

      const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');

      // ── Allowed image & document types ──────────────────────────────────
      const ALLOWED_IMAGE_TYPES = [
        'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
        'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff'
      ];
      const ALLOWED_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff|tif|pdf|ai|psd)$/i;

      const isImage = ALLOWED_IMAGE_TYPES.includes(file.type) ||
        (!file.type && /\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff|tif)$/i.test(file.name));

      if (!isImage && !isPdf) {
        const ext = file.name.split('.').pop()?.toUpperCase() || 'file';
        if (showToast) showToast(
          `⛔ ${ext} files are not supported. Please upload a PDF document or image format (PNG, JPG, WebP, SVG).`,
          'error'
        );
        return resolve(null);
      }

      if (isPdf) {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            name: standardizedName,
            url: e.target.result,
            type: 'application/pdf',
            size: file.size,
            uploadedAt: new Date().toISOString()
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1800;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88);
          resolve({ name: standardizedName, url: compressedUrl, type: file.type });
        };
        img.onerror = () => resolve({ name: standardizedName, url: e.target.result, type: file.type });
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const handleGeneralArtworkUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    Promise.all(files.map(f => processUploadedFile(f))).then(results => {
      const valid = results.filter(Boolean);
      if (!valid.length) return;
      // REPLACE existing artwork (general upload always replaces)
      setArtworkFiles(valid);
      // Sync to all variants that don't have their own artwork
      setSpecSheet(prev => {
        const copyVars = [...(prev.variants || [])].map(v => ({
          ...v,
          artworkFiles: valid,
          hasRemovedArtwork: false,
          artworkUrl: valid[0]?.url || null
        }));
        return { ...prev, artworkFiles: valid, variants: copyVars };
      });
      if (showToast) showToast(`🖼️ ${valid.length} artwork file(s) uploaded`);
    });
    e.target.value = '';
  };



  const handleVariantArtworkUpload = (e) => {
    const files = Array.from(e.target.files || []);
    // Read from ref for synchronous accuracy (state may lag)
    const uploadIdx = activeVariantUploadIdxRef.current ?? activeVariantUploadIdx;
    if (!files.length || uploadIdx === null) return;
    const targetVar = (specSheet.variants || [])[uploadIdx];
    Promise.all(files.map(f => processUploadedFile(f, targetVar?.itemCode))).then(results => {
      const valid = results.filter(Boolean);
      if (!valid.length) return;
      // REPLACE (not append): new upload overwrites existing artwork files for this variant
      setSpecSheet(prev => {
        const copyVars = [...(prev.variants || [])];
        if (copyVars[uploadIdx]) {
          copyVars[uploadIdx] = {
            ...copyVars[uploadIdx],
            artworkFiles: valid, // ← replace, not append
            hasRemovedArtwork: false,
            artworkUrl: valid[0]?.url || null
          };
        }
        // Sync specSheet.artworkFiles when replacing the primary variant (idx 0)
        const nextArtworkFiles = uploadIdx === 0 ? valid : (prev.artworkFiles || []);
        return { ...prev, artworkFiles: nextArtworkFiles, variants: copyVars };
      });
      // Also sync the top-level artworkFiles state for the primary variant
      if (uploadIdx === 0) {
        setArtworkFiles(valid);
      }
      if (showToast) showToast(`🖼️ Artwork replaced: ${valid[0]?.name || 'file'} assigned to ${targetVar?.variantName || 'variant'}`);
    });
    e.target.value = '';
  };

  const handleRemoveVariantArtwork = (vIdx, fIdx) => {
    setSpecSheet(prev => {
      const copyVars = [...(prev.variants || [])];
      if (copyVars[vIdx]) {
        const remaining = (copyVars[vIdx].artworkFiles || []).filter((_, i) => i !== fIdx);
        copyVars[vIdx] = {
          ...copyVars[vIdx],
          artworkFiles: remaining,
          hasRemovedArtwork: remaining.length === 0,
          artworkUrl: null,
          artwork: null
        };
      }
      // If removing from the primary variant, clear the top-level artworkFiles too
      const nextArtworkFiles = vIdx === 0 ? [] : (prev.artworkFiles || []);
      return { ...prev, artworkFiles: nextArtworkFiles, variants: copyVars };
    });
    // Sync top-level artworkFiles state when clearing primary variant
    if (vIdx === 0) {
      setArtworkFiles([]);
    }
  };

  /* ── Action Handlers ──────────────────────────────────────────────────── */
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const effectiveFiles = (Array.isArray(artworkFiles) && artworkFiles.length > 0)
        ? artworkFiles
        : (Array.isArray(specSheet?.artworkFiles) && specSheet.artworkFiles.length > 0)
        ? specSheet.artworkFiles
        : [];

      const syncedVariants = Array.isArray(specSheet?.variants)
        ? specSheet.variants.map(v => ({
            ...v,
            hasRemovedArtwork: !!v.hasRemovedArtwork,
            artworkUrl: v.hasRemovedArtwork ? null : (v.artworkUrl || (v.artworkFiles?.[0]?.url || null)),
            artworkFiles: (Array.isArray(v.artworkFiles) && v.artworkFiles.length > 0)
              ? v.artworkFiles
              : (v.hasRemovedArtwork ? [] : effectiveFiles)
          }))
        : [];

      const sheetWithArtwork = {
        ...specSheet,
        hasRemovedArtwork: !!specSheet?.hasRemovedArtwork,
        artworkFiles: effectiveFiles,
        variants: syncedVariants.length > 0 ? syncedVariants : specSheet?.variants
      };

      if (material.libId) {
        await updateSpecInLibrary(material.libId, {
          specData: sheetWithArtwork,
          specName: sheetWithArtwork.docHeader?.docName || material.name,
          itemCode: sheetWithArtwork.docHeader?.itemCode || material.pmCode
        });
      } else if (project.id) {
        const res = await saveSpecSheet(project.id, mIdx, sheetWithArtwork, false);
        if (res?.data?.specSheet) {
          setSpecSheet(res.data.specSheet);
        }
      }
      if (onSave) onSave(sheetWithArtwork);

      if (showToast) showToast('💾 Specification draft saved');
      if (onRefresh) onRefresh();
      setActiveTab(prev => (prev === 'edit' ? 'combined' : prev));
    } catch (err) {
      console.error('Failed to save specification sheet:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to save specification sheet';
      if (showToast) showToast(`❌ ${msg}`, 'error');
    } finally { setIsSaving(false); }
  };

  const handleSubmitForCheck = async () => {
    setIsSaving(true);
    try {
      const effectiveFiles = (Array.isArray(artworkFiles) && artworkFiles.length > 0)
        ? artworkFiles
        : (Array.isArray(specSheet?.artworkFiles) && specSheet.artworkFiles.length > 0)
        ? specSheet.artworkFiles
        : [];

      const syncedVariants = Array.isArray(specSheet?.variants)
        ? specSheet.variants.map(v => ({
            ...v,
            hasRemovedArtwork: !!v.hasRemovedArtwork,
            artworkUrl: v.hasRemovedArtwork ? null : (v.artworkUrl || (v.artworkFiles?.[0]?.url || null)),
            artworkFiles: (Array.isArray(v.artworkFiles) && v.artworkFiles.length > 0)
              ? v.artworkFiles
              : (v.hasRemovedArtwork ? [] : effectiveFiles)
          }))
        : [];

      const sheetWithArtwork = {
        ...specSheet,
        hasRemovedArtwork: !!specSheet?.hasRemovedArtwork,
        artworkFiles: effectiveFiles,
        variants: syncedVariants.length > 0 ? syncedVariants : specSheet?.variants
      };

      const res = await saveSpecSheet(project.id, mIdx, sheetWithArtwork, true);
      if (res?.data?.specSheet) {
        setSpecSheet(res.data.specSheet);
      }
      if (showToast) showToast('📤 Specification submitted to Project Manager for verification');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to submit specifications:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to submit specifications';
      if (showToast) showToast(`❌ ${msg}`, 'error');
    } finally { setIsSaving(false); }
  };

  const handleExecuteCheck = async () => {
    setIsSaving(true);
    try {
      await checkSpecSheet(project.id, mIdx, promptText || 'Technical parameters verified.');
      if (showToast) showToast('🛡️ Specifications CHECKED by Project Manager!');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to check specifications:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to check specifications';
      if (showToast) showToast(`❌ ${msg}`, 'error');
    } finally { setIsSaving(false); }
  };

  const handleExecuteApprove = async () => {
    setIsSaving(true);
    try {
      await approveSpecSheet(project.id, mIdx, promptText || 'Formally approved for commercial procurement.');
      if (showToast) showToast('👑 Specifications APPROVED & LOCKED!');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to approve specifications:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to approve specifications';
      if (showToast) showToast(`❌ ${msg}`, 'error');
    } finally { setIsSaving(false); }
  };

  const handleExecuteReject = async () => {
    if (!promptText.trim()) {
      if (showToast) showToast('⚠️ Please provide the reason for revision', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      await rejectSpecSheet(project.id, mIdx, promptText.trim());
      if (showToast) showToast('↩ Specification returned for revision');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to request revision:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to request revision';
      if (showToast) showToast(`❌ ${msg}`, 'error');
    } finally { setIsSaving(false); }
  };

  /* ── A4 Print & PDF Generation Engine ─────────────────────────────────── */
  const pagination = getSpecPagination(specSheet, material);
  const { totalPages, isMultiPage, hasMultiSections, specPagesCount, page1Params, page2Params, variants = [] } = pagination;

  const getPageListHtml = () => {
    const list = [];

    // Page 1: Technical Spec Part 1
    list.push(`<div class="spec-print-page">${buildHtmlHeader(1, totalPages)}${buildHtmlPage1Content()}${buildHtmlSignatures(1, totalPages)}</div>`);

    // Page 2: Technical Spec Part 2 (if multi-page)
    if (isMultiPage) {
      list.push(`<div class="spec-print-page">${buildHtmlHeader(2, totalPages, true)}${buildHtmlPage2Content()}${buildHtmlSignatures(2, totalPages)}</div>`);
    }

    // Pages 3..N: Dedicated Artwork Page for each Variant
    const activeVariants = (variants && variants.length > 0) ? variants : [{
      variantName: project?.projectName || material?.name || 'Standard SKU',
      itemCode: specSheet?.docHeader?.itemCode || material?.pmCode || 'PM-TBD',
      artworkCode: getArtworkCode(specSheet?.docHeader?.itemCode || material?.pmCode || 'PM-TBD'),
      artworkFiles: artworkFiles,
      pantoneColors: ['CMYK', 'Gold'],
      dimensions: 'Standard Dimensions',
      barcode: '',
      netWeight: project?.skuSize || 'Standard'
    }];

    activeVariants.forEach((v, vIdx) => {
      const curPageNum = specPagesCount + vIdx + 1;
      list.push(`<div class="spec-print-page">${buildHtmlHeader(curPageNum, totalPages, false, v)}${buildHtmlVariantArtworkContent(v, vIdx + 1)}${buildHtmlSignatures(curPageNum, totalPages)}</div>`);
    });

    return list;
  };

  /* ── Direct PDF Download to Downloads folder (No print window) ────────── */
  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    setDownloadProgress('Preparing pages...');

    const cleanItemCode = (specSheet?.docHeader?.itemCode || material?.pmCode || 'SPEC')
      .replace(/[/\\?%*:|"<>]/g, '-').trim();
    const cleanDocName = (specSheet?.docHeader?.docName || material?.name || project?.projectName || 'Specification')
      .replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').trim();
    const filename = `${cleanItemCode}_${cleanDocName}.pdf`;

    const pageList = getPageListHtml();

    // Create an invisible container for rendering pages to canvas
    const container = document.createElement('div');
    container.id = 'spec-pdf-export-container';
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.zIndex = '-9999';
    container.style.width = '210mm';
    container.style.background = '#ffffff';
    container.style.pointerEvents = 'none';

    // Inject print stylesheet for high fidelity rendering
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      * { box-sizing: border-box; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px solid #000; color: #000; word-wrap: break-word; overflow-wrap: break-word; }
      img { max-width: 100%; }
      .peach-bar { background: #d9d9d9 !important; border: 1px solid #000; padding: 3px 6px; font-weight: 800; font-size: 9.5pt; text-align: center; margin-top: 5px; margin-bottom: 0px; color: #000; }
      .spec-print-page {
        width: 210mm;
        height: 297mm;
        max-height: 297mm;
        padding: 8mm 10mm 8mm 10mm;
        box-sizing: border-box;
        margin: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
        background: #fff;
        color: #000;
        font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
        font-size: 8.5pt;
      }
    `;
    container.appendChild(styleEl);

    const pageWrapperEls = [];
    pageList.forEach(html => {
      const pageWrapper = document.createElement('div');
      pageWrapper.innerHTML = html;
      container.appendChild(pageWrapper);
      pageWrapperEls.push(pageWrapper.firstElementChild || pageWrapper);
    });

    document.body.appendChild(container);

    try {
      // Ensure all images are loaded
      setDownloadProgress('Loading images...');
      const imgs = container.querySelectorAll('img');
      if (imgs.length > 0) {
        await Promise.all(Array.from(imgs).map(img => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 1500);
          });
        }));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      for (let i = 0; i < pageWrapperEls.length; i++) {
        setDownloadProgress(`Rendering Page ${i + 1} of ${pageWrapperEls.length}...`);
        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }

        const canvas = await html2canvas(pageWrapperEls[i], {
          scale: 2, // 2x scale gives 300 DPI print quality
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      setDownloadProgress('Saving file...');
      pdf.save(filename);
      if (showToast) showToast(`📥 Downloaded ${filename} directly to Downloads!`, 'success');
    } catch (err) {
      console.error('Direct PDF download failed:', err);
      if (showToast) showToast(`⚠️ Direct PDF download error: ${err.message}. Falling back to print window...`, 'warning');
      buildAndPrint();
    } finally {
      if (container.parentNode) container.remove();
      setIsDownloadingPdf(false);
      setDownloadProgress('');
    }
  };

  const buildAndPrint = () => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;

    const oldIframe = document.getElementById('spec-print-iframe');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'spec-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.left = '0';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    // Build pages
    const pagesHtml = getPageListHtml().join('');

    const iframeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page { size: A4 portrait; margin: 0 !important; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0 !important; padding: 0 !important; width: 210mm; background: #fff; color: #000; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 8.5pt; }
    .spec-print-page { width: 210mm; height: 297mm; max-height: 297mm; padding: 8mm 10mm 8mm 10mm; box-sizing: border-box; margin: 0 auto; page-break-after: always; break-after: page; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; background: #fff; }
    .spec-print-page:last-child { page-break-after: avoid; break-after: avoid; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #000; color: #000; word-wrap: break-word; overflow-wrap: break-word; }
    img { max-width: 100%; }
    .peach-bar { background: #d9d9d9 !important; border: 1px solid #000; padding: 3px 6px; font-weight: 800; font-size: 9.5pt; text-align: center; margin-top: 5px; margin-bottom: 0px; color: #000; }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(iframeHtml);
    doc.close();

    let hasPrinted = false;
    let fallbackTimer = null;
    let loadTimer = null;

    const executePrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (loadTimer) clearTimeout(loadTimer);

      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Print invocation failed:', err);
      }

      setTimeout(() => {
        if (iframe.parentNode) iframe.remove();
        isPrintingRef.current = false;
      }, 3000);
    };

    const imgs = doc.querySelectorAll('img');
    if (!imgs.length) {
      loadTimer = setTimeout(executePrint, 250);
    } else {
      let loaded = 0;
      const total = imgs.length;

      const onImgDone = () => {
        loaded++;
        if (loaded >= total) {
          if (loadTimer) clearTimeout(loadTimer);
          loadTimer = setTimeout(executePrint, 200);
        }
      };

      imgs.forEach(img => {
        if (img.complete) {
          loaded++;
        } else {
          img.onload = onImgDone;
          img.onerror = onImgDone;
        }
      });

      if (loaded >= total) {
        loadTimer = setTimeout(executePrint, 200);
      } else {
        fallbackTimer = setTimeout(executePrint, 1500);
      }
    }
  };

  /* ── Header HTML Builder (Strictly matching Yoga Bar reference tables) ── */
  const buildHtmlHeader = (pageNum, count, isContinuation = false, variantObj = null) => {
    const h = specSheet?.docHeader || {};
    const itemCodeToDisplay = variantObj ? (variantObj.itemCode || variantObj.code || '—') : (h.clubbedCodes || h.itemCode || material?.pmCode || '—');
    const docNameToDisplay = (variantObj && variants.length > 1) ? `${h.docName || material?.name || 'Material Spec'} — ${variantObj.variantName || variantObj.name || ''}` : (h.docName || material?.name || 'Material Spec');
    const logoSrc = h.logoUrl || '/yogabar-logo.png';

    return `
      <table style="width:100%;border-collapse:collapse;border:1.5px solid #000;margin-bottom:12px;table-layout:fixed;font-family:Arial, 'Helvetica Neue', Helvetica, sans-serif;">
        <tbody>
          <tr>
            <td style="width:24%;border:1px solid #000;text-align:center;vertical-align:middle;padding:6px 8px;background:#fff;">
              <img src="${logoSrc}" alt="Yoga Bar" style="max-height:56px;max-width:140px;object-fit:contain;display:inline-block;" />
            </td>
            <td style="width:76%;border:1px solid #000;padding:0;vertical-align:top;">
              <table style="width:100%;border-collapse:collapse;font-size:9pt;table-layout:fixed;">
                <tr>
                  <td colspan="4" style="border:1px solid #000;padding:4px 6px;font-weight:800;text-align:center;font-size:9.5pt;background:#fff;color:#000;">
                    Company Name : ${h.companyName || 'SPROUTLIFE FOODS PVT. LTD'}
                  </td>
                </tr>
                <tr>
                  <td style="border:1px solid #000;padding:3px 6px;font-weight:700;width:24%;background:#fff;color:#000;">Document name :</td>
                  <td colspan="3" style="border:1px solid #000;padding:3px 6px;font-weight:700;color:#000;white-space:normal;background:#fff;">${docNameToDisplay}</td>
                </tr>
                <tr>
                  <td style="border:1px solid #000;padding:3px 6px;font-weight:700;background:#fff;color:#000;">Item Code :</td>
                  <td style="border:1px solid #000;padding:3px 6px;font-weight:700;color:#000;background:#fff;">${itemCodeToDisplay}</td>
                  <td style="border:1px solid #000;padding:3px 6px;font-weight:700;width:18%;background:#fff;color:#000;">Revision :</td>
                  <td style="border:1px solid #000;padding:3px 6px;font-weight:700;width:12%;color:#000;background:#fff;">${h.revision ?? '0'}</td>
                </tr>
                <tr>
                  <td style="border:1px solid #000;padding:3px 6px;font-weight:700;background:#fff;color:#000;">Date of Issue:</td>
                  <td style="border:1px solid #000;padding:3px 6px;font-weight:700;color:#000;background:#fff;">${h.issueDate ? fmt(h.issueDate) : fmt(new Date())}</td>
                  <td style="border:1px solid #000;padding:3px 6px;font-weight:700;background:#fff;color:#000;">Data Source</td>
                  <td style="border:1px solid #000;padding:3px 6px;font-weight:700;color:#000;background:#fff;">${h.dataSource || 'Packaging Development team'}</td>
                </tr>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    `;
  };

  /* ── Signatures Block HTML Builder (Signature on every page) ──────────── */
  const buildHtmlSignatures = (pageNum = 1, count = totalPages) => {
    const g = specSheet?.governance || {};

    const sigCell = (person, label) => {
      if (person?.signed && person?.name) {
        return `
          <td style="border:1px solid #000;padding:2px 4px;text-align:center;width:33.33%;vertical-align:middle;background:#fff;height:52px;">
            <div style="display:inline-block;border:1px solid #059669;background:rgba(5,150,105,0.06);padding:1px 6px;border-radius:3px;margin-bottom:1px;">
              <span style="color:#059669;font-size:6.5pt;font-weight:800;">&#10003; DIGITALLY SIGNED &amp; VERIFIED</span>
            </div>
            <div style="font-weight:800;font-size:8.5pt;color:#000;line-height:1.2;">${person.name}</div>
            <div style="font-size:7pt;color:#333;">${person.title || ''}</div>
            <div style="font-size:6.5pt;font-weight:700;color:#059669;margin-top:1px;">&#10003; ${fmt(person.date)} ${person.digitalId ? `&bull; ${person.digitalId}` : ''}</div>
          </td>
        `;
      }
      return `
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;width:33.33%;vertical-align:middle;background:#fff;height:52px;">
          <div style="color:#666;font-size:8pt;font-style:italic;">Signed &amp; Date (${label})</div>
        </td>
      `;
    };

    return `
      <div style="margin-top:auto;width:100%;">
        <table style="width:100%;border-collapse:collapse;border:1.5px solid #000;font-size:8.5pt;table-layout:fixed;margin-bottom:2px;">
          <thead>
            <tr style="background:#fff;">
              <th style="border:1px solid #000;padding:4px;text-align:center;font-weight:800;color:#000;">Prepared By</th>
              <th style="border:1px solid #000;padding:4px;text-align:center;font-weight:800;color:#000;">Checked By</th>
              <th style="border:1px solid #000;padding:4px;text-align:center;font-weight:800;color:#000;">Approved By</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              ${sigCell(g.preparedBy, 'Prepared By')}
              ${sigCell(g.checkedBy, 'Checked By')}
              ${sigCell(g.approvedBy, 'Approved By')}
            </tr>
          </tbody>
        </table>
        <div style="text-align:right;font-size:9pt;font-weight:700;color:#000;margin-top:3px;">
          Page ${pageNum} of ${count}
        </div>
      </div>
    `;
  };

  /* ── Page 1 HTML Content ──────────────────────────────────────────────── */
  const buildHtmlPage1Content = () => {
    const gen = specSheet?.general || {};
    let category = specSheet?.category;
    const checkStr = `${material?.type || ''} ${gen.materialDescription || ''} ${specSheet.sectionTitle || ''} ${specSheet.docHeader?.docName || ''}`;
    const inferredCat = getMaterialSpecCategory(checkStr);
    if (!category || category === 'rigid_container' || category === 'generic') {
      if (inferredCat !== 'generic') category = inferredCat;
    }

    const hasMultiSections = category === 'rigid_container' && Array.isArray(specSheet.sections) && specSheet.sections.length >= 2;
    const tests = specSheet?.performanceTests || [];
    const clauses = specSheet?.criticalRequirements || specSheet?.qualityClauses || [];
    const storage = specSheet?.storageAndPacking || {};

    let basicInfoRows = '';
    if (category === 'carton' || gen.materialDescription || gen.materialConstruct || gen.style) {
      basicInfoRows = `
        <tr>
          <td style="width:30%;font-weight:700;border:1px solid #000;padding:3px 6px;background:#fff;color:#000;">Product Name</td>
          <td style="width:70%;font-weight:700;border:1px solid #000;padding:3px 6px;background:#fff;color:#000;">${gen.productName || project.projectName}</td>
        </tr>
        <tr>
          <td style="font-weight:700;border:1px solid #000;padding:3px 6px;background:#fff;color:#000;">Pack size</td>
          <td style="font-weight:700;border:1px solid #000;padding:3px 6px;background:#fff;color:#000;">${gen.packSize || project.skuSize || 'Standard'}</td>
        </tr>
        <tr>
          <td style="font-weight:700;border:1px solid #000;padding:3px 6px;background:#fff;color:#000;">Material Description</td>
          <td style="font-weight:700;border:1px solid #000;padding:3px 6px;background:#fff;color:#000;">${gen.materialDescription || 'Standard Packaging Material'}</td>
        </tr>
        <tr>
          <td style="font-weight:700;border:1px solid #000;padding:3px 6px;background:#fff;color:#000;">Material Construct</td>
          <td style="font-weight:700;border:1px solid #000;padding:3px 6px;background:#fff;color:#000;">${gen.materialConstruct || gen.structure || 'Standard'}</td>
        </tr>
        <tr>
          <td style="font-weight:700;border:1px solid #000;padding:3px 6px;background:#fff;color:#000;">Style</td>
          <td style="font-weight:700;border:1px solid #000;padding:3px 6px;background:#fff;color:#000;">${gen.style || 'Standard'}</td>
        </tr>
        <tr>
          <td style="font-weight:700;border:1px solid #000;padding:3px 6px;background:#fff;color:#000;">Adhesive</td>
          <td style="font-weight:700;border:1px solid #000;padding:3px 6px;background:#fff;color:#000;">${gen.adhesive || 'High Performance Adhesives – Starch Base / PVA'}</td>
        </tr>
      `;
    } else if (category === 'shipper') {
      basicInfoRows = `
        <tr><td style="width:25%;font-weight:700;background:#fff;padding:3px 6px;">Item Code</td><td colspan="3" style="font-family:monospace;font-weight:700;padding:3px 6px;">${specSheet.docHeader?.itemCode || material.pmCode}</td></tr>
        <tr><td style="font-weight:700;background:#fff;padding:3px 6px;">Product Name</td><td colspan="3" style="padding:3px 6px;">${gen.productName || project.projectName}</td></tr>
        <tr><td style="font-weight:700;background:#fff;padding:3px 6px;">Pack Size</td><td style="padding:3px 6px;">${gen.packSize || '12'}</td><td style="font-weight:700;background:#fff;padding:3px 6px;">Arrangement</td><td style="padding:3px 6px;">${gen.arrangement || '4 x 3 x 1 = 12'}</td></tr>
        <tr><td style="font-weight:700;background:#fff;padding:3px 6px;">Description</td><td colspan="3" style="padding:3px 6px;">${gen.description || '5 PLY semi virgin Kraft paper'}</td></tr>
        <tr><td style="font-weight:700;background:#fff;padding:3px 6px;">Shipper type</td><td style="padding:3px 6px;">${gen.shipperType || 'RSC'}</td><td style="font-weight:700;background:#fff;padding:3px 6px;">Print Color</td><td style="padding:3px 6px;">${gen.printColors || 'Green & Blue'}</td></tr>
      `;
    } else {
      basicInfoRows = `
        <tr><td style="width:25%;font-weight:700;background:#fff;padding:3px 6px;">Product Name</td><td colspan="3" style="padding:3px 6px;">${gen.productName || project.projectName}</td></tr>
        <tr><td style="font-weight:700;background:#fff;padding:3px 6px;">Pack size</td><td style="padding:3px 6px;">${gen.packSize || project.skuSize || 'Standard'}</td><td style="font-weight:700;background:#fff;padding:3px 6px;">Style / Format</td><td style="padding:3px 6px;">${gen.style || 'Standard'}</td></tr>
        <tr><td style="font-weight:700;background:#fff;padding:3px 6px;">Material Description</td><td colspan="3" style="padding:3px 6px;">${gen.materialDescription || ''}</td></tr>
        <tr><td style="font-weight:700;background:#fff;padding:3px 6px;">Material Construct / Structure</td><td colspan="3" style="font-weight:700;padding:3px 6px;">${gen.structure || ''}</td></tr>
        <tr><td style="font-weight:700;background:#fff;padding:3px 6px;">Print Colors / AW</td><td colspan="3" style="padding:3px 6px;">${gen.printColors || 'As per approved AW'}</td></tr>
      `;
    }

    const generalTableHtml = `
      <table style="width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:4px;font-size:8.5pt;table-layout:fixed;">
        <tbody>${basicInfoRows}</tbody>
      </table>
    `;

    // Sections for Rigid Containers or standard parameter table
    let paramsSectionHtml = '';
    if (hasMultiSections) {
      const jarSec = specSheet.sections[0] || {};
      const capSec = specSheet.sections[1] || {};
      paramsSectionHtml = `
        <div class="peach-bar" style="margin-top:4px;font-size:9pt;">${jarSec.title || 'Jar Details'}</div>
        ${buildHtmlParamTable(jarSec.parameters || [], true)}
        ${capSec.title || (capSec.parameters && capSec.parameters.length > 0) ? `
          <div class="peach-bar" style="margin-top:4px;font-size:9pt;">${capSec.title || 'Cap Details'}</div>
          ${buildHtmlParamTable(capSec.parameters || [], true)}
        ` : ''}
      `;
    } else {
      const secTitle = specSheet.sectionTitle || (category === 'carton' ? 'Monocarton Details' : category === 'label' ? 'Label Details' : 'Technical Parameters');
      paramsSectionHtml = `
        <div class="peach-bar" style="margin-top:4px;font-size:9pt;">${secTitle}</div>
        ${buildHtmlParamTable(page1Params, category !== 'shipper')}
      `;
    }

    let extraSectionsHtml = '';

    if (!isMultiPage) {
      // For all packaging materials (including multi-section rigid containers when on 1 page!):
      // Move up Performance Tests + Critical Requirements + Packing & Storage to Page 1!
      if (tests.length > 0) {
        extraSectionsHtml += `
          <div class="peach-bar" style="margin-top:4px;font-size:9pt;">PERFORMANCE TEST</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #000;font-size:8pt;margin-bottom:4px;table-layout:fixed;">
            <thead>
              <tr style="background:#fff;font-weight:800;">
                <th style="padding:2px 4px;text-align:center;width:22%;border:1px solid #000;">Test</th>
                <th style="padding:2px 2px;text-align:center;width:10%;border:1px solid #000;">Unit</th>
                <th style="padding:2px 4px;text-align:center;width:52%;border:1px solid #000;">Standard</th>
                <th style="padding:2px 2px;text-align:center;width:16%;border:1px solid #000;">Defect type</th>
              </tr>
            </thead>
            <tbody>
              ${tests.map(t => `
                <tr>
                  <td style="padding:2px 4px;text-align:center;font-weight:700;border:1px solid #000;">${t.test}</td>
                  <td style="padding:2px 2px;text-align:center;border:1px solid #000;">${t.unit || '-'}</td>
                  <td style="padding:2px 4px;text-align:center;font-weight:700;border:1px solid #000;">${(t.standard || '').replace(/\n/g, '<br/>')}</td>
                  <td style="padding:2px 2px;text-align:center;font-weight:800;border:1px solid #000;">${t.defectType || 'CR'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      if (clauses.length > 0 && category !== 'carton') {
        extraSectionsHtml += `
          <div style="border:1px solid #000;padding:2px 6px;margin-top:4px;margin-bottom:4px;font-size:7.5pt;background:#fff;">
            <div style="font-weight:800;margin-bottom:1px;">Critical Requirements:</div>
            <ol style="margin:0;padding-left:14px;line-height:1.25;">
              ${clauses.slice(0, 4).map(c => `<li>${c.replace(/^[0-9]+\)\s*/, '')}</li>`).join('')}
            </ol>
          </div>
        `;
      }

      if (storage.storage || storage.packing) {
        extraSectionsHtml += `
          <div class="peach-bar" style="margin-top:4px;font-size:9pt;">PACKING &amp; STORAGE</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #000;font-size:8pt;margin-bottom:4px;table-layout:fixed;">
            <tr>
              <td style="width:26%;font-weight:700;background:#fff;padding:2px 6px;border:1px solid #000;">Storage Condition</td>
              <td style="padding:2px 6px;font-weight:700;border:1px solid #000;">${storage.storage || 'Store in Cool & Dry place at ambient conditions.'}</td>
            </tr>
            <tr>
              <td style="font-weight:700;background:#fff;padding:2px 6px;border:1px solid #000;">Packing instruction</td>
              <td style="padding:2px 6px;font-weight:700;border:1px solid #000;">${storage.packing || 'Wrapped with stretch film or packed in polybag & placed inside master carton.'}</td>
            </tr>
            ${storage.shippingDocs && category !== 'carton' ? `
            <tr>
              <td style="font-weight:700;background:#fff;padding:2px 6px;border:1px solid #000;">Shipping Documents</td>
              <td style="padding:2px 6px;font-weight:700;border:1px solid #000;">${storage.shippingDocs}</td>
            </tr>` : ''}
            <tr>
              <td style="font-weight:700;background:#fff;padding:2px 6px;border:1px solid #000;">Reasons for revision</td>
              <td style="padding:2px 6px;font-weight:700;border:1px solid #000;">${storage.reasonsForRevision || 'NA'}</td>
            </tr>
          </table>
        `;
      }
    }

    return `<div>${generalTableHtml}${paramsSectionHtml}${extraSectionsHtml}</div>`;
  };

  /* ── Page 2 HTML Content ──────────────────────────────────────────────── */
  const buildHtmlPage2Content = () => {
    let category = specSheet?.category;
    const checkStr = `${material?.type || ''} ${specSheet?.general?.materialDescription || ''} ${specSheet?.sectionTitle || ''} ${specSheet?.docHeader?.docName || ''}`;
    const inferredCat = getMaterialSpecCategory(checkStr);
    if (!category || category === 'rigid_container' || category === 'generic') {
      if (inferredCat !== 'generic') category = inferredCat;
    }

    const hasMultiSections = category === 'rigid_container' && Array.isArray(specSheet.sections) && specSheet.sections.length >= 2;
    const tests = specSheet?.performanceTests || [];
    const clauses = specSheet?.criticalRequirements || specSheet?.qualityClauses || [];
    const storage = specSheet?.storageAndPacking || {};

    let content = '';

    if (hasMultiSections) {
      // Multi-page rigid container: Section 2 (WAD Details) & subsequent sections are on Page 2
      const remainingSections = specSheet.sections.slice(2);
      if (remainingSections.length > 0) {
        content = remainingSections.map(sec => `
          <div class="peach-bar" style="margin-top:4px;font-size:9pt;">${sec.title || 'WAD Details'}</div>
          ${buildHtmlParamTable(sec.parameters || [], true)}
        `).join('');
      }
    } else if (page2Params && page2Params.length > 0) {
      content += `
        <div class="peach-bar" style="margin-top:4px;font-size:9pt;">Technical Parameters (Continued)</div>
        ${buildHtmlParamTable(page2Params, category !== 'shipper')}
      `;
    }

    if (tests.length > 0) {
      content += `
        <div class="peach-bar" style="margin-top:4px;font-size:9pt;">PERFORMANCE TEST</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #000;font-size:8pt;margin-bottom:6px;table-layout:fixed;">
          <thead>
            <tr style="background:#fff;font-weight:800;">
              <th style="padding:3px 4px;text-align:center;width:22%;border:1px solid #000;">Test</th>
              <th style="padding:3px 2px;text-align:center;width:12%;border:1px solid #000;">Unit</th>
              <th style="padding:3px 4px;text-align:center;width:50%;border:1px solid #000;">Standard</th>
              <th style="padding:3px 2px;text-align:center;width:16%;border:1px solid #000;">Defect type</th>
            </tr>
          </thead>
          <tbody>
            ${tests.map(t => `
              <tr>
                <td style="padding:3px 4px;text-align:center;font-weight:700;border:1px solid #000;">${t.test}</td>
                <td style="padding:3px 2px;text-align:center;border:1px solid #000;">${t.unit || '-'}</td>
                <td style="padding:3px 4px;text-align:center;font-weight:700;border:1px solid #000;">${(t.standard || '').replace(/\n/g, '<br/>')}</td>
                <td style="padding:3px 2px;text-align:center;font-weight:800;border:1px solid #000;">${t.defectType || 'CR'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (clauses.length > 0 && category !== 'carton') {
      content += `
        <div style="border:1px solid #000;padding:3px 6px;margin-bottom:6px;font-size:7.5pt;background:#fff;">
          <div style="font-weight:800;margin-bottom:2px;">Critical Requirements:</div>
          <ol style="margin:0;padding-left:14px;line-height:1.3;">
            ${clauses.slice(0, 5).map(c => `<li>${c.replace(/^[0-9]+\)\s*/, '')}</li>`).join('')}
          </ol>
        </div>
      `;
    }

    content += `
      <div class="peach-bar" style="margin-top:4px;font-size:9pt;">PACKING &amp; STORAGE</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #000;font-size:8pt;margin-bottom:6px;table-layout:fixed;">
        <tr>
          <td style="width:26%;font-weight:700;background:#fff;padding:3px 6px;border:1px solid #000;">Storage Condition</td>
          <td style="padding:3px 6px;font-weight:700;border:1px solid #000;">${storage.storage || 'Store at room temperature & in a Dust-free environment'}</td>
        </tr>
        <tr>
          <td style="font-weight:700;background:#fff;padding:3px 6px;border:1px solid #000;">Packing instruction</td>
          <td style="padding:3px 6px;font-weight:700;border:1px solid #000;">${storage.packing || 'Monocartons of 20 No’s to be bundled and packed in a shipper. Strong enough to withstand the rigors of transit, handling and storage. Box to be labeled with item name, item code, supplier name, quantity, lot no. etc.'}</td>
        </tr>
        ${storage.shippingDocs && category !== 'carton' ? `
        <tr>
          <td style="font-weight:700;background:#fff;padding:3px 6px;border:1px solid #000;">Shipping Documents</td>
          <td style="padding:3px 6px;font-weight:700;border:1px solid #000;">${storage.shippingDocs}</td>
        </tr>` : ''}
        <tr>
          <td style="font-weight:700;background:#fff;padding:3px 6px;border:1px solid #000;">Reasons for revision</td>
          <td style="padding:3px 6px;font-weight:700;border:1px solid #000;">${storage.reasonsForRevision || 'NA'}</td>
        </tr>
      </table>
    `;

    return `<div>${content}</div>`;
  };

  /* ── Parameter Table HTML Builder ─────────────────────────────────────── */
  const buildHtmlParamTable = (paramList = [], showTestAndFactory = true) => {
    if (showTestAndFactory) {
      return `
        <table style="width:100%;border-collapse:collapse;border:1px solid #000;font-size:8.5pt;margin-bottom:6px;table-layout:fixed;">
          <thead>
            <tr style="background:#fff;font-weight:800;">
              <th style="padding:4px 2px;text-align:center;width:5%;border:1px solid #000;white-space:normal;vertical-align:middle;line-height:1.2;">S.No.</th>
              <th style="padding:4px 4px;text-align:center;width:23%;border:1px solid #000;white-space:normal;vertical-align:middle;line-height:1.2;">Parameter</th>
              <th style="padding:4px 2px;text-align:center;width:7%;border:1px solid #000;white-space:normal;vertical-align:middle;line-height:1.2;">Units</th>
              <th style="padding:4px 4px;text-align:center;width:33%;border:1px solid #000;white-space:normal;vertical-align:middle;line-height:1.2;">Standard</th>
              <th style="padding:4px 2px;text-align:center;width:13%;border:1px solid #000;white-space:normal;vertical-align:middle;line-height:1.2;">Test<br/>Standard</th>
              <th style="padding:4px 2px;text-align:center;width:9%;border:1px solid #000;white-space:normal;vertical-align:middle;line-height:1.2;">Defect<br/>Type</th>
              <th style="padding:4px 2px;text-align:center;width:10%;border:1px solid #000;white-space:normal;vertical-align:middle;line-height:1.2;">Factory<br/>Check</th>
            </tr>
          </thead>
          <tbody>
            ${paramList.map((p, idx) => `
              <tr>
                <td style="padding:3px 2px;text-align:center;font-weight:700;border:1px solid #000;vertical-align:middle;">${p.sNo || idx + 1}</td>
                <td style="padding:3px 4px;text-align:center;font-weight:700;border:1px solid #000;vertical-align:middle;">${p.parameter}</td>
                <td style="padding:3px 2px;text-align:center;border:1px solid #000;vertical-align:middle;">${p.units || '-'}</td>
                <td style="padding:3px 6px;text-align:center;font-weight:700;border:1px solid #000;vertical-align:middle;">${(p.standard || '').replace(/\n/g, '<br/>')}</td>
                <td style="padding:3px 2px;text-align:center;border:1px solid #000;vertical-align:middle;">${p.testStandard || 'NA'}</td>
                <td style="padding:3px 2px;text-align:center;font-weight:800;border:1px solid #000;vertical-align:middle;">${p.defectType || 'CR'}</td>
                <td style="padding:3px 2px;text-align:center;border:1px solid #000;vertical-align:middle;">${p.factoryCheck || 'Yes'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    // Shipper format (4 columns)
    return `
      <table style="width:100%;border-collapse:collapse;border:1px solid #000;font-size:8.5pt;margin-bottom:6px;table-layout:fixed;">
        <thead>
          <tr style="background:#fff;font-weight:800;">
            <th style="padding:4px 6px;text-align:left;width:35%;border:1px solid #000;">Parameter</th>
            <th style="padding:4px 2px;text-align:center;width:60px;border:1px solid #000;">Unit</th>
            <th style="padding:4px 6px;text-align:left;border:1px solid #000;">Standard</th>
            <th style="padding:4px 2px;text-align:center;width:80px;border:1px solid #000;">Defect Type</th>
          </tr>
        </thead>
        <tbody>
          ${paramList.map(p => `
            <tr>
              <td style="padding:4px 6px;font-weight:700;border:1px solid #000;">${p.parameter}</td>
              <td style="padding:4px 2px;text-align:center;border:1px solid #000;">${p.units || '-'}</td>
              <td style="padding:4px 6px;font-weight:700;border:1px solid #000;">${(p.standard || '').replace(/\n/g, '<br/>')}</td>
              <td style="padding:4px 2px;text-align:center;font-weight:800;border:1px solid #000;">${p.defectType || 'CR'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  /* ── Variant Artwork Page HTML Builder ────────────────────────────────── */
  const buildHtmlVariantArtworkContent = (variantObj, vNum) => {
    const vName = variantObj.variantName || variantObj.name || `Variant ${vNum}`;
    const vCode = variantObj.itemCode || variantObj.code || specSheet.docHeader?.itemCode || material.pmCode || 'PM-TBD';
    const vAwCode = variantObj.artworkCode || (variantObj.code ? getArtworkCode(variantObj.code) : '') || getArtworkCode(vCode);
    const awFiles = resolveVariantArtworkFiles(variantObj, artworkFiles, material, specSheet);

    const hasMultipleVariants = variants.length > 1;
    const artworkHeading = hasMultipleVariants
      ? `Artwork: Variant ${vNum} &mdash; ${vName} (${vCode})`
      : 'Artwork';

    return `
      <div>
        <div class="peach-bar" style="margin-top:0;font-size:11pt;">
          ${artworkHeading}
        </div>

        <div style="border:1px solid #000;padding:8px;background:#fff;margin-top:8px;margin-bottom:8px;">
          ${awFiles.length === 0 ? `
            <div style="border:1.5px dashed #000;padding:45px 20px;text-align:center;background:#fafafa;">
              <div style="font-size:11pt;font-weight:800;color:#000;margin-bottom:6px;">APPROVED ARTWORK REFERENCE PENDING</div>
              <div style="font-size:8.5pt;color:#333;margin-bottom:4px;">Item Code: <strong>${vCode}</strong> &bull; Artwork Code: <strong style="color:#be185d;">${vAwCode}</strong></div>
              <div style="font-size:8pt;color:#666;">Approved commercial artwork file to be attached in specification manager before production release.</div>
            </div>
          ` : `
            <div style="text-align:center;min-height:260px;display:flex;align-items:center;justify-content:center;background:#fafafa;border:1px solid #ddd;padding:10px;">
              ${awFiles[0].type?.startsWith('image/') || (!awFiles[0].type && !awFiles[0].name?.toLowerCase().endsWith('.pdf')) ? `
                <img src="${awFiles[0].url}" alt="${vName}" style="max-height:340px;max-width:100%;object-fit:contain;" />
              ` : `
                <div style="padding:28px;text-align:center;">
                  <div style="font-size:28pt;margin-bottom:6px;">📄</div>
                  <div style="font-size:11.5pt;font-weight:800;color:#000;">${awFiles[0].name}</div>
                  <div style="font-size:8.5pt;color:#666;margin-top:2px;">Approved Artwork Reference File (${vAwCode})</div>
                </div>
              `}
            </div>
          `}
        </div>

        <div style="font-size:8pt;color:#000;padding:6px 8px;border:1px solid #000;background:#fff;margin-top:6px;">
          <strong>Note:</strong> ${hasMultipleVariants ? `Approved artwork reference shown above is linked to master item code ${vCode}. ` : `Approved commercial artwork reference shown above. `}Commercial print proofs must match target Pantone shades and the Keyline as per the Final approved artwork.
        </div>
      </div>
    `;
  };

  /* ═══════════════════════════════════════════════════════════════════════
      REACT COMPONENT RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  const pageSheetStyle = {
    background: '#ffffff',
    color: '#000000',
    width: '210mm',
    maxWidth: '100%',
    minHeight: '297mm',
    padding: '10mm',
    margin: '0 auto',
    boxShadow: '0 4px 24px rgba(0,0,0,0.22)',
    fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  };

  const peachBarStyle = {
    background: '#d9d9d9',
    border: '1px solid #000',
    padding: '4px 6px',
    fontWeight: 800,
    fontSize: '12px',
    textAlign: 'center',
    marginTop: '6px',
    marginBottom: '0px',
    color: '#000',
    letterSpacing: '0.3px'
  };

  const renderReactHeader = (pageNum, count, variantObj = null) => {
    const h = specSheet.docHeader || {};
    const itemCodeToDisplay = variantObj ? (variantObj.itemCode || variantObj.code || '—') : (h.clubbedCodes || h.itemCode || material.pmCode || '—');
    const docNameToDisplay = (variantObj && variants.length > 1) ? `${h.docName} — ${variantObj.variantName || variantObj.name || ''}` : (h.docName || material.name);
    const logoSrc = h.logoUrl || '/yogabar-logo.png';

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', marginBottom: '8px', tableLayout: 'fixed', fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}>
        <tbody>
          <tr>
            <td style={{ width: '24%', border: '1px solid #000', textAlign: 'center', verticalAlign: 'middle', padding: '6px 8px', background: '#fff' }}>
              <img src={logoSrc} alt="Yoga Bar" style={{ maxHeight: '56px', maxWidth: '140px', objectFit: 'contain', display: 'inline-block' }} />
            </td>
            <td style={{ width: '76%', border: '1px solid #000', padding: 0, verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
                <tbody>
                  <tr>
                    <td colSpan={4} style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 800, textAlign: 'center', fontSize: '12px', background: '#fff', color: '#000' }}>
                      Company Name : {h.companyName || 'SPROUTLIFE FOODS PVT. LTD'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700, width: '24%', background: '#fff', color: '#000' }}>Document name :</td>
                    <td colSpan={3} style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700, color: '#000', background: '#fff' }}>{docNameToDisplay}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700, background: '#fff', color: '#000' }}>Item Code :</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700, color: '#000', background: '#fff' }}>{itemCodeToDisplay}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700, width: '18%', background: '#fff', color: '#000' }}>Revision :</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700, width: '12%', color: '#000', background: '#fff' }}>{h.revision ?? '0'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700, background: '#fff', color: '#000' }}>Date of Issue:</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700, color: '#000', background: '#fff' }}>{h.issueDate ? fmt(h.issueDate) : fmt(new Date())}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700, background: '#fff', color: '#000' }}>Data Source</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700, color: '#000', background: '#fff' }}>{h.dataSource || 'Packaging Development team'}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    );
  };

  const renderReactSignatures = (pageNum = 1, count = totalPages) => {
    const g = specSheet?.governance || {};

    const renderSigCell = (person, roleKey, label) => {
      if (person?.signed && person?.name) {
        return (
          <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'center', verticalAlign: 'middle', background: '#fff', height: '56px' }}>
            <div style={{ display: 'inline-block', border: '1px solid #059669', background: 'rgba(5,150,105,0.06)', padding: '1px 6px', borderRadius: '3px', marginBottom: '2px' }}>
              <span className="no-black-override" style={{ color: '#059669', fontSize: '8.5px', fontWeight: 800 }}>✓ DIGITALLY SIGNED &amp; VERIFIED</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: '11px', color: '#000', lineHeight: 1.2 }}>{person.name}</div>
            <div style={{ fontSize: '9px', color: '#333' }}>{person.title || ''}</div>
            <div className="no-black-override" style={{ fontSize: '8.5px', fontWeight: 700, color: '#059669', marginTop: '1px' }}>
              ✓ {fmt(person.date)} {person.digitalId ? `• ${person.digitalId}` : ''}
            </div>
            {canEdit && (
              <button
                type="button"
                className="btn btn-ghost btn-sm no-print"
                onClick={() => handleOpenDigitalSign(roleKey, label)}
                style={{ fontSize: '8px', padding: '0 4px', color: '#0284c7', marginTop: '2px', height: 'auto', lineHeight: '14px' }}
                title="Update digital signature"
              >
                🔄 Re-sign
              </button>
            )}
          </td>
        );
      }
      return (
        <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', verticalAlign: 'middle', background: '#fff', color: '#000', height: '56px' }}>
          <div style={{ color: '#666', fontSize: '9.5px', fontStyle: 'italic', marginBottom: '4px' }}>
            Signed &amp; Date ({label})
          </div>
          {canEdit && (
            <button
              type="button"
              className="btn btn-sm no-print"
              onClick={() => handleOpenDigitalSign(roleKey, label)}
              style={{
                background: 'rgba(0, 200, 215, 0.1)',
                color: 'var(--teal)',
                border: '1px solid var(--teal)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 8px',
                fontSize: '9px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <CheckCircle2 size={10} /> Digitally Sign
            </button>
          )}
        </td>
      );
    };

    return (
      <div style={{ marginTop: 'auto', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '10px', tableLayout: 'fixed', marginBottom: '2px', background: '#fff' }}>
          <thead>
            <tr style={{ background: '#fff' }}>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 800, color: '#000', background: '#fff' }}>Prepared By</th>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 800, color: '#000', background: '#fff' }}>Checked By</th>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 800, color: '#000', background: '#fff' }}>Approved By</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: '#fff' }}>
              {renderSigCell(g.preparedBy, 'preparedBy', 'Prepared By')}
              {renderSigCell(g.checkedBy, 'checkedBy', 'Checked By')}
              {renderSigCell(g.approvedBy, 'approvedBy', 'Approved By')}
            </tr>
          </tbody>
        </table>
        <div style={{ textAlign: 'right', fontSize: '10px', fontWeight: 700, color: '#000', marginTop: '3px' }}>
          Page {pageNum} of {count}
        </div>
      </div>
    );
  };

  const renderReactGeneralTable = () => {
    const gen = specSheet?.general || {};
    const category = specSheet?.category || getMaterialSpecCategory(material?.type || '');

    if (category === 'carton' || gen.materialDescription || gen.materialConstruct || gen.style) {
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '12px', fontSize: '11px', tableLayout: 'fixed' }}>
          <tbody>
            <tr>
              <td style={{ width: '30%', fontWeight: 700, border: '1px solid #000', padding: '4px 8px', background: '#fff', color: '#000' }}>Product Name</td>
              <td style={{ width: '70%', fontWeight: 700, border: '1px solid #000', padding: '4px 8px', background: '#fff', color: '#000' }}>{gen.productName || project.projectName}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700, border: '1px solid #000', padding: '4px 8px', background: '#fff', color: '#000' }}>Pack size</td>
              <td style={{ fontWeight: 700, border: '1px solid #000', padding: '4px 8px', background: '#fff', color: '#000' }}>{gen.packSize || project.skuSize || 'Standard'}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700, border: '1px solid #000', padding: '4px 8px', background: '#fff', color: '#000' }}>Material Description</td>
              <td style={{ fontWeight: 700, border: '1px solid #000', padding: '4px 8px', background: '#fff', color: '#000' }}>{gen.materialDescription || 'Monocarton with die Cut & Pasted'}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700, border: '1px solid #000', padding: '4px 8px', background: '#fff', color: '#000' }}>Material Construct</td>
              <td style={{ fontWeight: 700, border: '1px solid #000', padding: '4px 8px', background: '#fff', color: '#000' }}>{gen.materialConstruct || gen.structure || 'Cyber XL (ITC) - 300 GSM Board'}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700, border: '1px solid #000', padding: '4px 8px', background: '#fff', color: '#000' }}>Style</td>
              <td style={{ fontWeight: 700, border: '1px solid #000', padding: '4px 8px', background: '#fff', color: '#000' }}>{gen.style || 'Die Punched with Auto lock bottom & Top tuck in'}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700, border: '1px solid #000', padding: '4px 8px', background: '#fff', color: '#000' }}>Adhesive</td>
              <td style={{ fontWeight: 700, border: '1px solid #000', padding: '4px 8px', background: '#fff', color: '#000' }}>{gen.adhesive || 'High Performance Adhesives – Starch Base / PVA'}</td>
            </tr>
          </tbody>
        </table>
      );
    }

    if (category === 'shipper') {
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '8px', fontSize: '10px', background: '#fff' }}>
          <tbody>
            <tr style={{ background: '#fff' }}><td style={{ width: '25%', fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Item Code</td><td colSpan={3} style={{ fontFamily: 'monospace', fontWeight: 700, padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{specSheet.docHeader?.itemCode || material.pmCode}</td></tr>
            <tr style={{ background: '#fff' }}><td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Product Name</td><td colSpan={3} style={{ padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{gen.productName || project.projectName}</td></tr>
            <tr style={{ background: '#fff' }}><td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Pack Size</td><td style={{ padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{gen.packSize || '12'}</td><td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Arrangement</td><td style={{ padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{gen.arrangement || '4 x 3 x 1 = 12'}</td></tr>
            <tr style={{ background: '#fff' }}><td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Description</td><td colSpan={3} style={{ padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{gen.description || '5 PLY semi virgin Kraft paper'}</td></tr>
            <tr style={{ background: '#fff' }}><td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Shipper type</td><td style={{ padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{gen.shipperType || 'RSC'}</td><td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Print Color</td><td style={{ padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{gen.printColors || 'Green & Blue'}</td></tr>
          </tbody>
        </table>
      );
    }

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '8px', fontSize: '10px', background: '#fff' }}>
        <tbody>
          <tr style={{ background: '#fff' }}><td style={{ width: '25%', fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Product Name</td><td colSpan={3} style={{ padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{gen.productName || project.projectName}</td></tr>
          <tr style={{ background: '#fff' }}><td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Pack size</td><td style={{ padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{gen.packSize || project.skuSize || 'Standard'}</td><td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Style / Format</td><td style={{ padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{gen.style || 'Standard'}</td></tr>
          <tr style={{ background: '#fff' }}><td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Material Description</td><td colSpan={3} style={{ padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{gen.materialDescription || ''}</td></tr>
          <tr style={{ background: '#fff' }}><td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Material Construct / Structure</td><td colSpan={3} style={{ fontWeight: 700, padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{gen.structure || ''}</td></tr>
          <tr style={{ background: '#fff' }}><td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 6px', border: '1px solid #000' }}>Print Colors / AW</td><td colSpan={3} style={{ padding: '3px 6px', background: '#fff', color: '#000', border: '1px solid #000' }}>{gen.printColors || 'As per approved AW'}</td></tr>
        </tbody>
      </table>
    );
  };

  const renderReactParamTable = (paramList = [], showTestAndFactory = true) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '10.5px', marginBottom: '8px', tableLayout: 'fixed', background: '#fff' }}>
      <thead>
        <tr style={{ background: '#fff', fontWeight: 800 }}>
          {showTestAndFactory ? (
            <>
              <th style={{ padding: '4px 2px', textAlign: 'center', width: '5%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal', verticalAlign: 'middle', lineHeight: 1.25, fontSize: '10px' }}>S.No.</th>
              <th style={{ padding: '4px 4px', textAlign: 'center', width: '23%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal', verticalAlign: 'middle', lineHeight: 1.25, fontSize: '10px' }}>Parameter</th>
              <th style={{ padding: '4px 2px', textAlign: 'center', width: '7%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal', verticalAlign: 'middle', lineHeight: 1.25, fontSize: '10px' }}>Units</th>
              <th style={{ padding: '4px 4px', textAlign: 'center', width: '33%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal', verticalAlign: 'middle', lineHeight: 1.25, fontSize: '10px' }}>Standard</th>
              <th style={{ padding: '4px 2px', textAlign: 'center', width: '13%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal', verticalAlign: 'middle', lineHeight: 1.25, fontSize: '10px' }}>Test<br />Standard</th>
              <th style={{ padding: '4px 2px', textAlign: 'center', width: '9%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal', verticalAlign: 'middle', lineHeight: 1.25, fontSize: '10px' }}>Defect<br />Type</th>
              <th style={{ padding: '4px 2px', textAlign: 'center', width: '10%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal', verticalAlign: 'middle', lineHeight: 1.25, fontSize: '10px' }}>Factory<br />Check</th>
            </>
          ) : (
            <>
              <th style={{ padding: '4px 6px', textAlign: 'left', width: '35%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal', verticalAlign: 'middle', fontSize: '10px' }}>Parameter</th>
              <th style={{ padding: '4px 2px', textAlign: 'center', width: '60px', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal', verticalAlign: 'middle', fontSize: '10px' }}>Unit</th>
              <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal', verticalAlign: 'middle', fontSize: '10px' }}>Standard</th>
              <th style={{ padding: '4px 2px', textAlign: 'center', width: '80px', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal', verticalAlign: 'middle', fontSize: '10px' }}>Defect<br />Type</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {paramList.map((p, idx) => (
          <tr key={idx} style={{ background: '#fff' }}>
            {showTestAndFactory ? (
              <>
                <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700, border: '1px solid #000', background: '#fff', color: '#000', verticalAlign: 'middle' }}>{p.sNo || idx + 1}</td>
                <td style={{ padding: '4px 4px', textAlign: 'center', fontWeight: 700, border: '1px solid #000', background: '#fff', color: '#000', verticalAlign: 'middle' }}>{p.parameter}</td>
                <td style={{ padding: '4px 2px', textAlign: 'center', border: '1px solid #000', background: '#fff', color: '#000', verticalAlign: 'middle' }}>{p.units || '-'}</td>
                <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 700, whiteSpace: 'pre-line', border: '1px solid #000', background: '#fff', color: '#000', verticalAlign: 'middle' }}>{p.standard}</td>
                <td style={{ padding: '4px 2px', textAlign: 'center', border: '1px solid #000', background: '#fff', color: '#000', verticalAlign: 'middle' }}>{p.testStandard || 'NA'}</td>
                <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 800, border: '1px solid #000', background: '#fff', color: '#000', verticalAlign: 'middle' }}>{p.defectType || 'CR'}</td>
                <td style={{ padding: '4px 2px', textAlign: 'center', border: '1px solid #000', background: '#fff', color: '#000', verticalAlign: 'middle' }}>{p.factoryCheck || 'Yes'}</td>
              </>
            ) : (
              <>
                <td style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700, border: '1px solid #000', background: '#fff', color: '#000', verticalAlign: 'middle' }}>{p.parameter}</td>
                <td style={{ padding: '4px 2px', textAlign: 'center', border: '1px solid #000', background: '#fff', color: '#000', verticalAlign: 'middle' }}>{p.units || '-'}</td>
                <td style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700, whiteSpace: 'pre-line', border: '1px solid #000', background: '#fff', color: '#000', verticalAlign: 'middle' }}>{p.standard}</td>
                <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 800, border: '1px solid #000', background: '#fff', color: '#000', verticalAlign: 'middle' }}>{p.defectType || 'CR'}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderReactVariantArtworkPage = (variantObj, vNum, pageIndex, totalCount) => {
    const vName = variantObj.variantName || variantObj.name || `Variant ${vNum}`;
    const vCode = variantObj.itemCode || variantObj.code || specSheet.docHeader?.itemCode || material.pmCode || 'PM-TBD';
    const vAwCode = variantObj.artworkCode || (variantObj.code ? getArtworkCode(variantObj.code) : '') || getArtworkCode(vCode);
    const awFiles = resolveVariantArtworkFiles(variantObj, artworkFiles, material, specSheet);

    return (
      <div className="spec-sheet-page" style={pageSheetStyle}>
        <div>
          {renderReactHeader(pageIndex, totalCount, variantObj)}
          <div style={peachBarStyle}>
            {variants.length > 1 ? `Artwork: Variant ${vNum} — ${vName} (${vCode})` : 'Artwork'}
          </div>

          <div style={{ border: '1px solid #000', padding: '12px', background: '#fff', marginTop: '10px', marginBottom: '10px' }}>
            {awFiles.length === 0 ? (
              <div style={{ border: '2px dashed #0284c7', background: 'rgba(2, 132, 199, 0.03)', padding: '45px 20px', textAlign: 'center', borderRadius: '6px' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎨</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                  {variants.length > 1 ? `Approved Artwork Reference Required for ${vName}` : 'Approved Artwork Reference Required'}
                </div>
                <div style={{ fontSize: '11px', color: '#475569', maxWidth: '460px', margin: '0 auto 14px auto', lineHeight: 1.5 }}>
                  Please attach or upload the approved commercial pack graphics, dieline, or print proof for Item Code <strong>{vCode}</strong> ({vAwCode}).
                </div>
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-primary no-print"
                    onClick={() => triggerVariantArtworkUpload(vNum - 1)}
                    style={{
                      padding: '8px 18px',
                      fontSize: '11.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Plus size={14} />
                    <span>Upload Approved Artwork File</span>
                  </button>
                )}
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px' }}>
                  Supported formats: PDF, PNG, JPG, WebP, SVG, AI, PSD (Max 30MB)
                </div>
              </div>
            ) : (
              <div style={{ background: '#fafafa', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#10b981' }}>✓</span>
                    <span>Approved Artwork: <strong>{awFiles[0].name}</strong></span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {canEdit && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => triggerVariantArtworkUpload(vNum - 1)}
                        style={{ fontSize: '10.5px', padding: '2px 8px' }}
                      >
                        🔄 Replace
                      </button>
                    )}
                    {awFiles[0].url && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openArtworkFile(awFiles[0], `Artwork: Variant ${vNum} — ${vName} (${vAwCode})`)}
                        style={{ fontSize: '10.5px', padding: '2px 8px' }}
                      >
                        ↗ Open Full
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRemoveVariantArtwork(vNum - 1, 0)}
                        style={{ fontSize: '10.5px', padding: '2px 8px', color: '#ef4444' }}
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'center', minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
                  {awFiles[0].type?.startsWith('image/') || (!awFiles[0].type && !awFiles[0].name?.toLowerCase().endsWith('.pdf') && !awFiles[0].url?.startsWith('data:application/pdf')) ? (
                    <img src={awFiles[0].url} alt={vName} style={{ maxHeight: '300px', maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: '40px', marginBottom: '6px' }}>📄</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{awFiles[0].name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                        Approved Commercial Artwork Reference &bull; {vAwCode}
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm no-print"
                        onClick={() => openArtworkFile(awFiles[0], `Artwork: Variant ${vNum} — ${vName} (${vAwCode})`)}
                        style={{ marginTop: '12px', fontSize: '11px' }}
                      >
                        ↗ Open Artwork Document
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          <div style={{ fontSize: '9.5px', color: '#000', padding: '6px 8px', border: '1px solid #000', background: '#fff', marginTop: '6px' }}>
            <strong>Note:</strong> {variants.length > 1 ? `Approved artwork reference shown above is linked to master item code ${vCode}. ` : `Approved commercial artwork reference shown above. `}Commercial print proofs must match target Pantone shades and the Keyline as per the Final approved artwork.
          </div>
        </div>

        {renderReactSignatures(pageIndex, totalCount)}
      </div>
    );
  };

  if (!specData || !specData.material || !specData.project || !specSheet) return null;

  return (
    <div className="modal-overlay open" style={{ zIndex: 1100, overflow: 'auto', padding: '16px', boxSizing: 'border-box' }}>
      <div
        className="modal spec-framework-modal"
        style={{
          width: '96vw',
          maxWidth: '1140px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >

        {/* MODAL HEADER */}
        <div
          className="modal-head"
          style={{
            borderBottom: '1px solid var(--border)',
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--navy-dark)',
            flexWrap: 'wrap',
            gap: '12px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', minWidth: '280px', flex: 1 }}>
            <span style={{ fontSize: '20px' }}>📋</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--white)', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>{specSheet.docHeader?.docName || `${specSheet.docHeader?.itemCode || material.pmCode} — ${material.name}`}</span>
                {getStatusBadge()}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--white-dim)', marginTop: '2px', lineHeight: 1.4 }}>
                PM Code: <strong style={{ color: 'var(--teal)', fontFamily: 'var(--mono)' }}>{specSheet.docHeader?.itemCode || material.pmCode || '—'}</strong>
                {' · '}Artwork Code: <strong style={{ color: '#f472b6', fontFamily: 'var(--mono)' }}>{getArtworkCode(specSheet.docHeader?.itemCode || material.pmCode)}</strong>
                {' · '}Rev {specSheet.docHeader?.revision || '0.0'}
                {' · '}Project: {project.projectName}
                {' · '}Total Pages: <strong>{totalPages}</strong>
                {variants.length > 1 && (
                  <span style={{ marginLeft: '6px', background: 'rgba(236,72,153,0.15)', color: '#f472b6', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(236,72,153,0.4)', fontWeight: 700 }}>
                    ✨ {variants.length} Clubbed Variants
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {canEditSpec && (
              <button
                type="button"
                className={activeTab === 'edit' ? "btn btn-secondary btn-sm no-print" : "btn btn-primary btn-sm no-print"}
                onClick={() => setActiveTab(activeTab === 'edit' ? 'combined' : 'edit')}
                title={activeTab === 'edit' ? 'Switch to Spec Preview' : 'Edit Technical Parameters, Tolerances, Standards, and Materials'}
                style={{
                  fontSize: '11.5px',
                  padding: '6px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {activeTab === 'edit' ? (
                  <>
                    <Eye size={12} />
                    <span>View Spec Preview</span>
                  </>
                ) : (
                  <>
                    <Edit2 size={12} />
                    <span>Edit Specification</span>
                  </>
                )}
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                className="btn btn-secondary btn-sm no-print"
                onClick={() => handleOpenDigitalSign(isHead ? 'approvedBy' : isPM ? 'checkedBy' : 'preparedBy', isHead ? 'Approved By' : isPM ? 'Checked By' : 'Prepared By')}
                title="Review and apply digital signature"
                style={{ color: 'var(--success)', borderColor: 'rgba(56, 201, 138, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle2 size={12} /> Digitally Sign
              </button>
            )}
            {canEdit && !isApproved && (
              <button
                type="button"
                className="btn btn-secondary btn-sm no-print"
                onClick={() => setShowConverter(true)}
                title="Convert existing legacy PDF spec into enterprise format"
                style={{ color: 'var(--teal)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={12} /> Convert from PDF
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm no-print"
              onClick={buildAndPrint}
              title="Open browser print dialog"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={12} /> Print Spec
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm no-print"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              style={{
                fontSize: '11px',
                padding: '6px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Directly save PDF specification to your Downloads folder"
            >
              {isDownloadingPdf ? (
                <>Generating ({downloadProgress || 'PDF'})...</>
              ) : (
                <>
                  <Download size={12} />
                  <span>Download Spec (PDF)</span>
                </>
              )}
            </button>
            <button className="modal-close" onClick={onClose} style={{ fontSize: '18px' }}>✕</button>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border)', padding: '0 16px', overflowX: 'auto', flexShrink: 0 }}>
          {[
            { key: 'combined', label: `📑 Combined Spec (All ${totalPages} Pages)` },
            { key: 'sheet', label: isMultiPage ? '📄 Tech Spec (Pages 1 & 2)' : '📄 Page 1 (Tech Spec)' },
            { key: 'artwork', label: `🖼️ Artwork & Variants (${variants.length || 1} SKUs)` },
            ...(canEditSpec ? [{ key: 'edit', label: '✏️ Edit Specification Data', isEdit: true }] : [])
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '11px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                color: activeTab === tab.key ? (tab.isEdit ? '#fbbf24' : 'var(--teal)') : 'var(--white-dim)',
                background: activeTab === tab.key && tab.isEdit ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? `2px solid ${tab.isEdit ? '#f59e0b' : 'var(--teal)'}` : '2px solid transparent',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {tab.label}
              {tab.isEdit && (
                <span style={{ fontSize: '9px', background: '#f59e0b', color: '#000', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
                  Editable
                </span>
              )}
            </button>
          ))}
        </div>

        {/* REVISION REQUEST BANNER */}
        {isRevision && gov.revisionRequest && (
          <div style={{ padding: '8px 20px', background: 'rgba(239,68,68,0.15)', borderBottom: '1px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#fca5a5', flexShrink: 0 }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <div>
              <strong>Revision Requested by {gov.revisionRequest.by} ({gov.revisionRequest.role}):</strong>{' '}
              "{gov.revisionRequest.reason}" ({fmt(gov.revisionRequest.date)})
            </div>
          </div>
        )}

        {/* MODAL BODY */}
        <div
          className="modal-body"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            padding: '20px',
            background: activeTab === 'edit' ? 'var(--navy)' : '#cbd5e1',
            boxSizing: 'border-box'
          }}
        >

          {/* ══ COMBINED OR TECH SPEC VIEW ══════════════════════════════════════ */}
          {(activeTab === 'combined' || activeTab === 'sheet') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>

              {/* SPEC DATA VERIFICATION & EDIT CALLOUT BANNER */}
              {canEditSpec && (
                <div style={{
                  width: '100%',
                  maxWidth: '210mm',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 18px',
                  flexWrap: 'wrap',
                  gap: '12px',
                  boxShadow: 'var(--shadow-sm)',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Edit2 size={16} style={{ color: 'var(--teal)' }} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                        Need to update or correct parameters before final approval?
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Ensure all technical dimensions, GSM, test standards, and defects are verified.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveTab('edit')}
                    style={{
                      fontSize: '11px',
                      padding: '6px 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Edit2 size={12} />
                    <span>Edit Specification Now</span>
                  </button>
                </div>
              )}

              {/* PAGE 1: TECHNICAL SPEC PART 1 */}
              <div className="spec-sheet-page" style={pageSheetStyle}>
                <div>
                  {renderReactHeader(1, totalPages)}
                  {renderReactGeneralTable()}

                  {hasMultiSections ? (
                    <>
                      <div style={peachBarStyle}>{specSheet.sections[0]?.title || 'Jar Details'}</div>
                      {renderReactParamTable(specSheet.sections[0]?.parameters || [], true)}
                      {specSheet.sections[1] && (
                        <>
                          <div style={peachBarStyle}>{specSheet.sections[1]?.title || 'Cap Details'}</div>
                          {renderReactParamTable(specSheet.sections[1]?.parameters || [], true)}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={peachBarStyle}>{specSheet.sectionTitle || 'Technical Parameters'}</div>
                      {renderReactParamTable(page1Params, specSheet.category !== 'shipper')}
                    </>
                  )}

                  {!isMultiPage && (
                    <>
                      {specSheet.performanceTests?.length > 0 && (
                        <>
                          <div style={peachBarStyle}>PERFORMANCE TEST</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '10px', marginBottom: '8px', tableLayout: 'fixed', background: '#fff' }}>
                            <thead>
                              <tr style={{ background: '#fff', fontWeight: 800 }}>
                                <th style={{ padding: '3px 6px', textAlign: 'center', width: '22%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal' }}>Test</th>
                                <th style={{ padding: '3px 2px', textAlign: 'center', width: '12%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal' }}>Unit</th>
                                <th style={{ padding: '3px 6px', textAlign: 'center', width: '50%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal' }}>Standard</th>
                                <th style={{ padding: '3px 2px', textAlign: 'center', width: '16%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal' }}>Defect type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {specSheet.performanceTests.map((t, idx) => (
                                <tr key={idx} style={{ background: '#fff' }}>
                                  <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700, border: '1px solid #000', background: '#fff', color: '#000' }}>{t.test}</td>
                                  <td style={{ padding: '3px 2px', textAlign: 'center', border: '1px solid #000', background: '#fff', color: '#000' }}>{t.unit || '-'}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700, whiteSpace: 'pre-line', border: '1px solid #000', background: '#fff', color: '#000' }}>{t.standard}</td>
                                  <td style={{ padding: '3px 2px', textAlign: 'center', fontWeight: 800, border: '1px solid #000', background: '#fff', color: '#000' }}>{t.defectType || 'CR'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      )}

                      {(specSheet.criticalRequirements || specSheet.qualityClauses)?.length > 0 && specSheet.category !== 'carton' && (
                        <div style={{ border: '1px solid #000', padding: '4px 8px', marginTop: '6px', marginBottom: '6px', fontSize: '9px', background: '#fff', color: '#000' }}>
                          <div style={{ fontWeight: 800, marginBottom: '2px', color: '#000' }}>Critical Requirements:</div>
                          <ol style={{ margin: 0, paddingLeft: '14px', lineHeight: 1.3, color: '#000' }}>
                            {(specSheet.criticalRequirements || specSheet.qualityClauses).slice(0, 4).map((c, idx) => (
                              <li key={idx} style={{ color: '#000' }}>{c.replace(/^[0-9]+\)\s*/, '')}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      <div style={peachBarStyle}>PACKING &amp; STORAGE</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '10px', marginBottom: '8px', tableLayout: 'fixed', background: '#fff' }}>
                        <tbody>
                          <tr style={{ background: '#fff' }}>
                            <td style={{ width: '26%', fontWeight: 700, background: '#fff', color: '#000', padding: '3px 8px', border: '1px solid #000' }}>Storage Condition</td>
                            <td style={{ padding: '3px 8px', fontWeight: 700, background: '#fff', color: '#000', border: '1px solid #000' }}>{specSheet.storageAndPacking?.storage || 'Store at room temperature & in a Dust-free environment'}</td>
                          </tr>
                          <tr style={{ background: '#fff' }}>
                            <td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 8px', border: '1px solid #000' }}>Packing instruction</td>
                            <td style={{ padding: '3px 8px', fontWeight: 700, background: '#fff', color: '#000', border: '1px solid #000' }}>{specSheet.storageAndPacking?.packing || 'Monocartons of 20 No’s to be bundled and packed in a shipper. Strong enough to withstand the rigors of transit, handling and storage. Box to be labeled with item name, item code, supplier name, quantity, lot no. etc.'}</td>
                          </tr>
                          {specSheet.storageAndPacking?.shippingDocs && specSheet.category !== 'carton' && (
                            <tr style={{ background: '#fff' }}>
                              <td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 8px', border: '1px solid #000' }}>Shipping Documents</td>
                              <td style={{ padding: '3px 8px', fontWeight: 700, background: '#fff', color: '#000', border: '1px solid #000' }}>{specSheet.storageAndPacking.shippingDocs}</td>
                            </tr>
                          )}
                          <tr style={{ background: '#fff' }}>
                            <td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '3px 8px', border: '1px solid #000' }}>Reasons for revision</td>
                            <td style={{ padding: '3px 8px', fontWeight: 700, background: '#fff', color: '#000', border: '1px solid #000' }}>{specSheet.storageAndPacking?.reasonsForRevision || 'NA'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}
                </div>

                {renderReactSignatures(1, totalPages)}
              </div>

              {/* PAGE 2: TECHNICAL SPEC PART 2 (WHEN MULTI-PAGE) */}
              {isMultiPage && (
                <div className="spec-sheet-page" style={pageSheetStyle}>
                  <div>
                    {renderReactHeader(2, totalPages)}

                    {hasMultiSections ? (
                      <>
                        {specSheet.sections.slice(2).map((sec, sIdx) => (
                          <React.Fragment key={sIdx}>
                            <div style={peachBarStyle}>{sec.title || 'WAD Details'}</div>
                            {renderReactParamTable(sec.parameters || [], true)}
                          </React.Fragment>
                        ))}
                      </>
                    ) : (
                      page2Params?.length > 0 && (
                        <>
                          <div style={peachBarStyle}>Technical Parameters (Continued)</div>
                          {renderReactParamTable(page2Params, specSheet.category !== 'shipper')}
                        </>
                      )
                    )}

                    {specSheet.performanceTests?.length > 0 && (
                      <>
                        <div style={peachBarStyle}>PERFORMANCE TEST</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '10px', marginBottom: '12px', tableLayout: 'fixed', background: '#fff' }}>
                          <thead>
                            <tr style={{ background: '#fff', fontWeight: 800 }}>
                              <th style={{ padding: '4px 6px', textAlign: 'center', width: '22%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal' }}>Test</th>
                              <th style={{ padding: '4px 2px', textAlign: 'center', width: '12%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal' }}>Unit</th>
                              <th style={{ padding: '4px 6px', textAlign: 'center', width: '50%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal' }}>Standard</th>
                              <th style={{ padding: '4px 2px', textAlign: 'center', width: '16%', border: '1px solid #000', background: '#fff', color: '#000', textTransform: 'none', letterSpacing: 'normal' }}>Defect type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {specSheet.performanceTests.map((t, idx) => (
                              <tr key={idx} style={{ background: '#fff' }}>
                                <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 700, border: '1px solid #000', background: '#fff', color: '#000' }}>{t.test}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', border: '1px solid #000', background: '#fff', color: '#000' }}>{t.unit || '-'}</td>
                                <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 700, whiteSpace: 'pre-line', border: '1px solid #000', background: '#fff', color: '#000' }}>{t.standard}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 800, border: '1px solid #000', background: '#fff', color: '#000' }}>{t.defectType || 'CR'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {(specSheet.criticalRequirements || specSheet.qualityClauses)?.length > 0 && specSheet.category !== 'carton' && (
                      <div style={{ border: '1px solid #000', padding: '6px 10px', marginBottom: '8px', fontSize: '9px', background: '#fff', color: '#000' }}>
                        <div style={{ fontWeight: 800, marginBottom: '3px', color: '#000' }}>Critical Requirements:</div>
                        <ol style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.4, color: '#000' }}>
                          {(specSheet.criticalRequirements || specSheet.qualityClauses).map((c, idx) => (
                            <li key={idx} style={{ color: '#000' }}>{c.replace(/^[0-9]+\)\s*/, '')}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div style={peachBarStyle}>PACKING &amp; STORAGE</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '10px', marginBottom: '8px', tableLayout: 'fixed', background: '#fff' }}>
                      <tbody>
                        <tr style={{ background: '#fff' }}>
                          <td style={{ width: '26%', fontWeight: 700, background: '#fff', color: '#000', padding: '4px 8px', border: '1px solid #000' }}>Storage Condition</td>
                          <td style={{ padding: '4px 8px', fontWeight: 700, background: '#fff', color: '#000', border: '1px solid #000' }}>{specSheet.storageAndPacking?.storage || 'Store at room temperature & in a Dust-free environment'}</td>
                        </tr>
                        <tr style={{ background: '#fff' }}>
                          <td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '4px 8px', border: '1px solid #000' }}>Packing instruction</td>
                          <td style={{ padding: '4px 8px', fontWeight: 700, background: '#fff', color: '#000', border: '1px solid #000' }}>{specSheet.storageAndPacking?.packing || 'Monocartons of 20 No’s to be bundled and packed in a shipper. Strong enough to withstand the rigors of transit, handling and storage. Box to be labeled with item name, item code, supplier name, quantity, lot no. etc.'}</td>
                        </tr>
                        {specSheet.storageAndPacking?.shippingDocs && specSheet.category !== 'carton' && (
                          <tr style={{ background: '#fff' }}>
                            <td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '4px 8px', border: '1px solid #000' }}>Shipping Documents</td>
                            <td style={{ padding: '4px 8px', fontWeight: 700, background: '#fff', color: '#000', border: '1px solid #000' }}>{specSheet.storageAndPacking.shippingDocs}</td>
                          </tr>
                        )}
                        <tr style={{ background: '#fff' }}>
                          <td style={{ fontWeight: 700, background: '#fff', color: '#000', padding: '4px 8px', border: '1px solid #000' }}>Reasons for revision</td>
                          <td style={{ padding: '4px 8px', fontWeight: 700, background: '#fff', color: '#000', border: '1px solid #000' }}>{specSheet.storageAndPacking?.reasonsForRevision || 'NA'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {renderReactSignatures(2, totalPages)}
                </div>
              )}

              {/* PAGES 3..N: DEDICATED ARTWORK PAGES FOR EACH VARIANT IN COMBINED VIEW */}
              {activeTab === 'combined' && variants.map((v, vIdx) => (
                <React.Fragment key={v.id || vIdx}>
                  {renderReactVariantArtworkPage(v, vIdx + 1, specPagesCount + vIdx + 1, totalPages)}
                </React.Fragment>
              ))}

            </div>
          )}

          {/* ══ ARTWORK & VARIANTS TAB ════════════════════════════════════════ */}
          {activeTab === 'artwork' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {variants.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  {variants.map((v, idx) => (
                    <button
                      key={v.id || idx}
                      type="button"
                      onClick={() => setSelectedVariantIdx(idx)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: selectedVariantIdx === idx ? '1px solid var(--teal)' : '1px solid var(--border)',
                        background: selectedVariantIdx === idx ? 'rgba(0,243,255,0.15)' : 'var(--card-bg)',
                        color: selectedVariantIdx === idx ? 'var(--teal)' : 'var(--white-dim)',
                        cursor: 'pointer',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      🎨 Variant {idx + 1}: {v.variantName || v.name || `Variant ${idx + 1}`}
                    </button>
                  ))}
                </div>
              )}

              {variants[selectedVariantIdx] && renderReactVariantArtworkPage(
                variants[selectedVariantIdx],
                selectedVariantIdx + 1,
                specPagesCount + selectedVariantIdx + 1,
                totalPages
              )}
            </div>
          )}

          {/* ══ EDIT DATA & VARIANTS TAB ══════════════════════════════════════ */}
          {activeTab === 'edit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* SECTION 1: Document Control & Clubbed Codes */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--teal)', marginBottom: '12px' }}>
                  🏢 1. Document Control &amp; Master Identification
                </div>
                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Document Name *</label>
                    <input
                      className="form-input"
                      value={specSheet.docHeader?.docName || ''}
                      onChange={e => handleHeaderChange('docName', e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">
                      Item Code(s) &bull; Comma-separated for Clubbed Variants *
                    </label>
                    <input
                      className="form-input"
                      value={specSheet.docHeader?.clubbedCodes || specSheet.docHeader?.itemCode || ''}
                      onChange={e => handleClubbedCodesChange(e.target.value)}
                      placeholder="e.g. PM/PR/FLM/12691, 12687, 12686, 12688, 12689, 12838"
                      style={{ fontFamily: 'monospace', color: '#14b8a6', fontWeight: 700 }}
                    />
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '3px' }}>
                      When multiple variants share the same technical substrate, list all PM item codes here or manage in the Variants section below.
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Revision</label>
                    <input
                      className="form-input"
                      value={specSheet.docHeader?.revision || '0.0'}
                      onChange={e => handleHeaderChange('revision', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Product Name</label>
                    <input
                      className="form-input"
                      value={specSheet.general?.productName || ''}
                      onChange={e => handleGeneralChange('productName', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Pack Size / Grammage</label>
                    <input
                      className="form-input"
                      value={specSheet.general?.packSize || ''}
                      onChange={e => handleGeneralChange('packSize', e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Material Construct / Structure *</label>
                    <input
                      className="form-input"
                      value={specSheet.general?.structure || ''}
                      onChange={e => handleGeneralChange('structure', e.target.value)}
                      placeholder="e.g. 18 µ Matt Bopp + 12 µ METPET + 40 µ PE"
                      style={{ fontWeight: 700 }}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Material Description</label>
                    <input
                      className="form-input"
                      value={specSheet.general?.materialDescription || ''}
                      onChange={e => handleGeneralChange('materialDescription', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Style / Format</label>
                    <input
                      className="form-input"
                      value={specSheet.general?.style || ''}
                      onChange={e => handleGeneralChange('style', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Preferred Supplier</label>
                    <input
                      className="form-input"
                      value={specSheet.general?.preferredSupplier || ''}
                      onChange={e => handleGeneralChange('preferredSupplier', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Clubbed Variants & Dedicated Artwork Manager */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#f472b6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>🎨 2. Variants &amp; Dedicated Artwork Manager ({variants.length} SKUs)</span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
                      Each variant has its own Item Code, Artwork Code, Pantone colors, and artwork reference page.
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAddVariant} style={{ background: '#db2777' }}>
                    ＋ Add Variant SKU
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {variants.map((v, vIdx) => (
                    <div key={v.id || vIdx} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontWeight: 800, fontSize: '12px', color: 'var(--teal)' }}>
                          Variant #{vIdx + 1}: {v.variantName || v.name || `Variant ${vIdx + 1}`}
                        </div>
                        {variants.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRemoveVariant(vIdx)}
                            style={{ padding: '2px 8px', fontSize: '10px' }}
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <div className="form-group">
                          <label className="form-label">Variant Name *</label>
                          <input
                            className="form-input"
                            value={v.variantName || v.name || ''}
                            onChange={e => handleUpdateVariant(vIdx, 'variantName', e.target.value)}
                            placeholder="e.g. Trail Mix, Roasted Pistachio"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Item Code (PM) *</label>
                          <input
                            className="form-input"
                            value={v.itemCode || v.code || ''}
                            onChange={e => handleUpdateVariant(vIdx, 'itemCode', e.target.value)}
                            placeholder="e.g. PM/PR/FLM/12838"
                            style={{ fontFamily: 'monospace', color: '#14b8a6' }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Artwork Code (AW)</label>
                          <input
                            className="form-input"
                            value={v.artworkCode || getArtworkCode(v.itemCode || v.code)}
                            onChange={e => handleUpdateVariant(vIdx, 'artworkCode', e.target.value)}
                            style={{ fontFamily: 'monospace', color: '#f472b6' }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Dieline / Size</label>
                          <input
                            className="form-input"
                            value={v.dimensions || ''}
                            onChange={e => handleUpdateVariant(vIdx, 'dimensions', e.target.value)}
                            placeholder="e.g. 240mm W × 115mm H"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Barcode (EAN-13)</label>
                          <input
                            className="form-input"
                            value={v.barcode || ''}
                            onChange={e => handleUpdateVariant(vIdx, 'barcode', e.target.value)}
                            placeholder="e.g. 8904335602750"
                          />
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label className="form-label">Pantone Colors (comma-separated)</label>
                          <input
                            className="form-input"
                            value={Array.isArray(v.pantoneColors) ? v.pantoneColors.join(', ') : (typeof v.pantoneColors === 'string' ? v.pantoneColors : '')}
                            onChange={e => handleUpdateVariant(vIdx, 'pantoneColors', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            placeholder="e.g. Pantone 2346 C, Pantone 1955 C, Gold"
                          />
                        </div>
                      </div>

                      {/* Artwork File Upload & Visual Preview for this Variant */}
                      {(() => {
                        const vAwFiles = resolveVariantArtworkFiles(v, artworkFiles, material, specSheet);
                        const vActiveFile = (vAwFiles && vAwFiles.length > 0) ? vAwFiles[0] : null;
                        const hasFile = Boolean(vActiveFile && (vActiveFile.name || vActiveFile.url));
                        const isImage = Boolean(
                          vActiveFile?.type?.startsWith('image/') ||
                          (!vActiveFile?.type && (
                            vActiveFile?.name?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|svg)$/i) ||
                            vActiveFile?.url?.startsWith('data:image/')
                          ))
                        );

                        return (
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: hasFile && vActiveFile.url ? '10px' : '0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                  Artwork File:{' '}
                                  {hasFile ? (
                                    <strong style={{ color: '#10b981' }}>{vActiveFile.name}</strong>
                                  ) : (
                                    <span style={{ color: '#f59e0b' }}>Pending upload</span>
                                  )}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ background: '#db2777', color: '#fff', fontSize: '10px', padding: '4px 10px' }}
                                  onClick={() => {
                                    setActiveVariantUploadIdx(vIdx);
                                    if (variantArtworkInputRef.current) {
                                      variantArtworkInputRef.current.value = '';
                                      variantArtworkInputRef.current.click();
                                    }
                                  }}
                                >
                                  🖼️ {hasFile ? 'Change Variant Artwork' : 'Upload Variant Artwork'}
                                </button>
                                {hasFile && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: '#ef4444', fontSize: '10px', padding: '4px 8px' }}
                                    onClick={() => handleRemoveVariantArtwork(vIdx, 0)}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Visual Artwork Preview Box */}
                            {hasFile && vActiveFile.url ? (
                              <div style={{
                                background: 'rgba(3, 14, 18, 0.75)',
                                border: '1px solid rgba(0, 243, 255, 0.25)',
                                borderRadius: '8px',
                                padding: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--teal)' }}>
                                      🔍 Variant Artwork Preview ({v.variantName || `Variant ${vIdx + 1}`})
                                    </span>
                                    <span style={{
                                      fontSize: '9.5px',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      color: '#34d399',
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                      fontWeight: 600
                                    }}>
                                      {isImage ? 'Commercial Graphic' : 'PDF Proof Document'}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      onClick={() => openArtworkFile(vActiveFile, `${v.variantName || 'Variant'} (${v.itemCode || 'PM-TBD'}) — Artwork Reference`)}
                                      title="Open full-resolution preview"
                                    >
                                      <Eye size={12} />
                                      <span>Full Preview</span>
                                    </button>
                                    <a
                                      href={vActiveFile.url}
                                      download={vActiveFile.name || 'artwork'}
                                      className="btn btn-outline btn-sm"
                                      style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      title="Download artwork file"
                                    >
                                      <Download size={12} />
                                    </a>
                                  </div>
                                </div>

                                <div
                                  onClick={() => openArtworkFile(vActiveFile, `${v.variantName || 'Variant'} (${v.itemCode || 'PM-TBD'}) — Artwork Reference`)}
                                  style={{
                                    width: '100%',
                                    minHeight: '160px',
                                    maxHeight: '280px',
                                    background: '#0a1417',
                                    borderRadius: '6px',
                                    border: '1px dashed rgba(255, 255, 255, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    padding: '10px',
                                    boxSizing: 'border-box',
                                    transition: 'border-color 0.2s, background 0.2s'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'var(--teal)';
                                    e.currentTarget.style.background = '#0e1a1e';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                    e.currentTarget.style.background = '#0a1417';
                                  }}
                                  title="Click to view full preview"
                                >
                                  {isImage ? (
                                    <img
                                      src={vActiveFile.url}
                                      alt={v.variantName || 'Artwork Preview'}
                                      style={{
                                        maxHeight: '260px',
                                        maxWidth: '100%',
                                        objectFit: 'contain',
                                        borderRadius: '4px',
                                        display: 'block'
                                      }}
                                    />
                                  ) : (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                      <div style={{ fontSize: '38px', marginBottom: '6px' }}>📄</div>
                                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>{vActiveFile.name}</div>
                                      <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                        PDF Artwork Proof &bull; Click to open
                                      </div>
                                    </div>
                                  )}
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '8px',
                                    right: '8px',
                                    background: 'rgba(0, 0, 0, 0.75)',
                                    color: '#ffffff',
                                    fontSize: '9.5px',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(255, 255, 255, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    pointerEvents: 'none'
                                  }}>
                                    <Eye size={11} />
                                    <span>Click to enlarge</span>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 3: Standard Technical Parameters */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--teal)' }}>
                      📐 3. Technical Parameters Data (Shared across all codes)
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>
                      Parameters and testing methods are standardized per Yoga Bar guidelines. Input target values/tolerances against each parameter.
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAddParam}>
                    ＋ Add Row
                  </button>
                </div>

                {/* If rigid container with sections */}
                {specSheet.category === 'rigid_container' && Array.isArray(specSheet.sections) ? (
                  specSheet.sections.map((sec, sIdx) => (
                    <div key={sIdx} style={{ marginBottom: '16px' }}>
                      <div style={{ fontWeight: 800, fontSize: '11px', color: '#f8cbad', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{sec.title}</span>
                        <button type="button" className="btn btn-primary btn-sm" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => handleAddSectionParam(sIdx)}>
                          ＋ Add Row
                        </button>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="modern-mat-table" style={{ fontSize: '11px', width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                              <th style={{ width: '25%' }}>Parameter *</th>
                              <th style={{ width: '70px' }}>Units</th>
                              <th>Standard Target / Tolerance *</th>
                              <th style={{ width: '120px' }}>Test Standard</th>
                              <th style={{ width: '85px' }}>Defect</th>
                              <th style={{ width: '75px' }}>Factory</th>
                              <th style={{ width: '35px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(sec.parameters || []).map((p, pIdx) => (
                              <tr key={pIdx}>
                                <td style={{ textAlign: 'center', fontWeight: 700 }}>{p.sNo || pIdx + 1}</td>
                                <td><input className="modern-form-input" value={p.parameter} onChange={e => handleSectionParamChange(sIdx, pIdx, 'parameter', e.target.value)} /></td>
                                <td><input className="modern-form-input" value={p.units || ''} onChange={e => handleSectionParamChange(sIdx, pIdx, 'units', e.target.value)} /></td>
                                <td><input className="modern-form-input" value={p.standard} onChange={e => handleSectionParamChange(sIdx, pIdx, 'standard', e.target.value)} style={{ fontWeight: 700 }} /></td>
                                <td><input className="modern-form-input" value={p.testStandard || ''} onChange={e => handleSectionParamChange(sIdx, pIdx, 'testStandard', e.target.value)} /></td>
                                <td>
                                  <select className="modern-form-select" value={p.defectType || 'MJ'} onChange={e => handleSectionParamChange(sIdx, pIdx, 'defectType', e.target.value)}>
                                    <option value="CR">CR (Critical)</option>
                                    <option value="MJ">MJ (Major)</option>
                                    <option value="MI">MI (Minor)</option>
                                  </select>
                                </td>
                                <td>
                                  <select className="modern-form-select" value={p.factoryCheck || 'Yes'} onChange={e => handleSectionParamChange(sIdx, pIdx, 'factoryCheck', e.target.value)}>
                                    <option value="Yes">Yes</option>
                                    <option value="NA">NA</option>
                                  </select>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRemoveSectionParam(sIdx, pIdx)} style={{ color: 'var(--red)', padding: '2px 6px' }}>✕</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="modern-mat-table" style={{ fontSize: '11px', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                          <th style={{ width: '25%' }}>Parameter *</th>
                          <th style={{ width: '70px' }}>Units</th>
                          <th>Standard Target / Tolerance *</th>
                          <th style={{ width: '120px' }}>Test Standard</th>
                          <th style={{ width: '85px' }}>Defect</th>
                          <th style={{ width: '75px' }}>Factory</th>
                          <th style={{ width: '35px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(specSheet.parameters || []).map((p, idx) => (
                          <tr key={idx}>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                            <td><input className="modern-form-input" value={p.parameter} onChange={e => handleParamChange(idx, 'parameter', e.target.value)} /></td>
                            <td><input className="modern-form-input" value={p.units || ''} onChange={e => handleParamChange(idx, 'units', e.target.value)} /></td>
                            <td><input className="modern-form-input" value={p.standard} onChange={e => handleParamChange(idx, 'standard', e.target.value)} style={{ fontWeight: 700 }} /></td>
                            <td><input className="modern-form-input" value={p.testStandard || ''} onChange={e => handleParamChange(idx, 'testStandard', e.target.value)} /></td>
                            <td>
                              <select className="modern-form-select" value={p.defectType || 'MJ'} onChange={e => handleParamChange(idx, 'defectType', e.target.value)}>
                                <option value="CR">CR (Critical)</option>
                                <option value="MJ">MJ (Major)</option>
                                <option value="MI">MI (Minor)</option>
                              </select>
                            </td>
                            <td>
                              <select className="modern-form-select" value={p.factoryCheck || 'Yes'} onChange={e => handleParamChange(idx, 'factoryCheck', e.target.value)}>
                                <option value="Yes">Yes</option>
                                <option value="NA">NA</option>
                              </select>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRemoveParam(idx)} style={{ color: 'var(--red)', padding: '2px 6px' }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* SECTION 4: Performance Tests */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--teal)' }}>
                      🔬 4. Performance Tests &amp; Critical Verification
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>
                      Define critical quality, endurance, and physical performance testing standards.
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAddTest}>
                    ＋ Add Row
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="modern-mat-table" style={{ fontSize: '11px', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '25%' }}>Test Name *</th>
                        <th style={{ width: '85px' }}>Unit</th>
                        <th>Standard Acceptance Threshold *</th>
                        <th style={{ width: '90px' }}>Defect</th>
                        <th style={{ width: '130px' }}>Test Standard</th>
                        <th style={{ width: '35px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(specSheet.performanceTests || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>
                            No performance tests defined. Click <strong>＋ Add Row</strong> to add a test.
                          </td>
                        </tr>
                      ) : (
                        specSheet.performanceTests.map((t, idx) => (
                          <tr key={idx}>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                            <td><input className="modern-form-input" placeholder="e.g. Scuff Test" value={t.test} onChange={e => handleTestChange(idx, 'test', e.target.value)} /></td>
                            <td><input className="modern-form-input" placeholder="e.g. Rev/min" value={t.unit || ''} onChange={e => handleTestChange(idx, 'unit', e.target.value)} /></td>
                            <td><input className="modern-form-input" placeholder="e.g. 300 Revolutions at 2 Lbs." value={t.standard} onChange={e => handleTestChange(idx, 'standard', e.target.value)} style={{ fontWeight: 700 }} /></td>
                            <td>
                              <select className="modern-form-select" value={t.defectType || 'CR'} onChange={e => handleTestChange(idx, 'defectType', e.target.value)}>
                                <option value="CR">CR</option>
                                <option value="MJ">MJ</option>
                                <option value="MI">MI</option>
                              </select>
                            </td>
                            <td><input className="modern-form-input" placeholder="e.g. ASTM D3359" value={t.testStandard || ''} onChange={e => handleTestChange(idx, 'testStandard', e.target.value)} /></td>
                            <td style={{ textAlign: 'center' }}>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRemoveTest(idx)} style={{ color: 'var(--red)', padding: '2px 6px' }}>✕</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 5: Storage & Packing Mandates */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--teal)', marginBottom: '12px' }}>
                  📦 5. Storage Conditions, Packing &amp; Shipping
                </div>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Storage Conditions</label>
                    <input
                      className="form-input"
                      value={specSheet.storageAndPacking?.storage || ''}
                      onChange={e => handleStoragePackingChange('storage', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Packing Instructions</label>
                    <input
                      className="form-input"
                      value={specSheet.storageAndPacking?.packing || ''}
                      onChange={e => handleStoragePackingChange('packing', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shipping Documents Required</label>
                    <input
                      className="form-input"
                      value={specSheet.storageAndPacking?.shippingDocs || ''}
                      onChange={e => handleStoragePackingChange('shippingDocs', e.target.value)}
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* PROMPT ACTION DIALOG */}
        {promptAction && (
          <div style={{ padding: '14px 20px', background: promptAction === 'reject' ? 'rgba(239,68,68,0.18)' : promptAction === 'approve' ? 'rgba(16,185,129,0.18)' : 'rgba(124,58,237,0.18)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: promptAction === 'reject' ? '#fca5a5' : promptAction === 'approve' ? '#6ee7b7' : '#c4b5fd' }}>
              {promptAction === 'check' && '🛡️ Project Manager Verification & Sign-off'}
              {promptAction === 'approve' && '👑 Final Approval by Packaging Head'}
              {promptAction === 'reject' && '↩ Request Engineering Revision'}
            </div>
            <input
              className="form-input"
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              placeholder={promptAction === 'reject' ? 'State clearly what parameters need to be revised...' : 'Add technical sign-off comments (optional)...'}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPromptAction(null)} disabled={isSaving}>Cancel</button>
              {promptAction === 'check' && <button className="btn btn-primary btn-sm" onClick={handleExecuteCheck} disabled={isSaving}>{isSaving ? 'Checking...' : '✓ Confirm PM Check & Sign-off'}</button>}
              {promptAction === 'approve' && <button className="btn btn-sm" onClick={handleExecuteApprove} disabled={isSaving} style={{ background: '#10b981', color: '#fff', fontWeight: 800 }}>{isSaving ? 'Approving...' : '👑 Grant Final Approval'}</button>}
              {promptAction === 'reject' && <button className="btn btn-sm" onClick={handleExecuteReject} disabled={isSaving} style={{ background: '#ef4444', color: '#fff', fontWeight: 800 }}>{isSaving ? 'Submitting...' : '↩ Return for Revision'}</button>}
            </div>
          </div>
        )}

        {/* MODAL FOOTER */}
        <div
          className="modal-foot"
          style={{
            borderTop: '1px solid var(--border)',
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--navy-dark)',
            flexWrap: 'wrap',
            gap: '10px',
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--white-dim)', whiteSpace: 'nowrap' }}>
            Logged in as: <strong>{currentUser?.name || 'User'}</strong> ({currentUser?.title || currentUser?.role})
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>

            {canEditSpec && activeTab !== 'edit' && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setActiveTab('edit')}
                style={{
                  fontSize: '11px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Edit2 size={12} />
                <span>Edit Spec Data</span>
              </button>
            )}

            {activeTab === 'edit' && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveTab('combined')}
                style={{
                  color: 'var(--teal)',
                  fontSize: '11px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Eye size={12} />
                <span>View Spec Preview</span>
              </button>
            )}

            {canEditSpec && (activeTab === 'edit' || status === 'DRAFT' || status === 'REVISION_REQUESTED') && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSaveDraft}
                disabled={isSaving}
                style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={12} />
                <span>Save Draft / Changes</span>
              </button>
            )}

            {canEdit && !isApproved && (status === 'DRAFT' || status === 'REVISION_REQUESTED') && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmitForCheck}
                disabled={isSaving}
                style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={12} />
                <span>Submit for PM Check →</span>
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenDigitalSign(isHead ? 'approvedBy' : isPM ? 'checkedBy' : 'preparedBy', isHead ? 'Approved By' : isPM ? 'Checked By' : 'Prepared By')}
                style={{
                  color: 'var(--teal)',
                  borderColor: 'rgba(0, 200, 215, 0.3)',
                  fontSize: '11px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CheckCircle2 size={12} />
                <span>Review &amp; Digitally Sign</span>
              </button>
            )}

            {isPM && !isApproved && (
              <>
                {status !== 'DRAFT' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setPromptAction('reject'); setPromptText(''); }}
                    disabled={isSaving}
                    style={{ color: 'var(--danger)', fontSize: '11px' }}
                  >
                    Request Changes
                  </button>
                )}
                {!isChecked && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setPromptAction('check'); setPromptText(''); }}
                    disabled={isSaving}
                    style={{ color: 'var(--info)', borderColor: 'rgba(79, 140, 255, 0.3)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ShieldCheck size={12} />
                    <span>Check &amp; Verify (PM)</span>
                  </button>
                )}
              </>
            )}

            {isHead && !isApproved && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setPromptAction('approve'); setPromptText(''); }}
                disabled={isSaving}
                style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Check size={12} />
                <span>Final Approve (Head)</span>
              </button>
            )}

            {isApproved && (
              <span style={{ color: 'var(--success)', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} />
                <span>Specification Approved &amp; Locked</span>
              </span>
            )}
          </div>
        </div>

        {/* Hidden inputs for artwork uploads (always mounted in modal root) */}
        <input
          ref={artworkInputRef}
          type="file"
          accept="image/*,application/pdf,.pdf,.ai,.psd"
          style={{ display: 'none' }}
          onChange={handleGeneralArtworkUpload}
        />
        <input
          ref={variantArtworkInputRef}
          type="file"
          accept="image/*,application/pdf,.pdf,.ai,.psd"
          style={{ display: 'none' }}
          onChange={handleVariantArtworkUpload}
        />

        {/* Digital Signature Modal */}
        {digitalSignModal.isOpen && (
          <div className="modal-overlay open" style={{ zIndex: 1300, background: 'rgba(0,0,0,0.7)' }}>
            <div className="modal" style={{ maxWidth: '540px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--teal)' }} />
                  <span>Review &amp; Digital Signature Sign-Off</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDigitalSignModal(prev => ({ ...prev, isOpen: false }))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '10px 12px', background: 'var(--card-bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Specification: <strong style={{ color: 'var(--text-main)' }}>{specSheet.docHeader?.docName || material.name}</strong><br/>
                  Item Code: <strong style={{ color: 'var(--teal)' }}>{specSheet.docHeader?.itemCode || material.pmCode}</strong> &bull; Rev {specSheet.docHeader?.revision || '0'}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Signing Role</label>
                  <select
                    className="form-input"
                    value={digitalSignModal.roleKey}
                    onChange={e => {
                      const rKey = e.target.value;
                      let rLbl = 'Prepared By';
                      let defTitle = 'Packaging Executive / Engineer';
                      if (rKey === 'checkedBy') { rLbl = 'Checked By'; defTitle = 'Project Manager'; }
                      else if (rKey === 'approvedBy') { rLbl = 'Approved By'; defTitle = 'Packaging Head'; }
                      setDigitalSignModal(prev => ({
                        ...prev,
                        roleKey: rKey,
                        roleLabel: rLbl,
                        signerTitle: defTitle
                      }));
                    }}
                    style={{ fontSize: '12px' }}
                  >
                    <option value="preparedBy">Prepared By (Packaging Engineer / Author)</option>
                    <option value="checkedBy">Checked By (Project Manager / Technical Lead)</option>
                    <option value="approvedBy">Approved By (Packaging Head / Authority)</option>
                  </select>
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Signer Full Name *</label>
                    <input
                      className="form-input"
                      value={digitalSignModal.signerName}
                      onChange={e => setDigitalSignModal(prev => ({ ...prev, signerName: e.target.value }))}
                      placeholder="e.g. Amudhan S"
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Designation / Title</label>
                    <input
                      className="form-input"
                      value={digitalSignModal.signerTitle}
                      onChange={e => setDigitalSignModal(prev => ({ ...prev, signerTitle: e.target.value }))}
                      placeholder="e.g. Packaging Specialist"
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Technical Review Comments (Optional)</label>
                  <input
                    className="form-input"
                    value={digitalSignModal.signerComments}
                    onChange={e => setDigitalSignModal(prev => ({ ...prev, signerComments: e.target.value }))}
                    placeholder="e.g. Dimensions, board GSM and scuff test verified per standard."
                    style={{ fontSize: '12px' }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: '4px', lineHeight: 1.4 }}>
                  <input
                    type="checkbox"
                    checked={digitalSignModal.acknowledged}
                    onChange={e => setDigitalSignModal(prev => ({ ...prev, acknowledged: e.target.checked }))}
                    style={{ marginTop: '2px', cursor: 'pointer' }}
                  />
                  <span>
                    I confirm that I have reviewed the technical specifications, parameters, tolerances, performance criteria, and packaging instructions, and verify that this specification conforms to Sproutlife Foods / Yoga Bar quality standards.
                  </span>
                </label>
              </div>

              <div style={{ padding: '12px 20px', background: 'var(--card-bg-subtle)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDigitalSignModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleConfirmDigitalSign}
                  disabled={isSaving || !digitalSignModal.acknowledged || !digitalSignModal.signerName.trim()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <CheckCircle2 size={13} />
                  <span>{isSaving ? 'Applying Signature...' : 'Apply Digital Signature'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Spec Converter from Legacy PDF */}
        {showConverter && (
          <SpecConverterModal
            isOpen={showConverter}
            onClose={() => setShowConverter(false)}
            projects={[project]}
            initialProjectId={project.id}
            initialMaterialIdx={mIdx}
            onSpecSaved={(savedSpec) => {
              if (savedSpec?.specData) {
                const sheet = savedSpec.specData;
                const effectiveAw = (Array.isArray(sheet.artworkFiles) && sheet.artworkFiles.length > 0)
                  ? sheet.artworkFiles
                  : (Array.isArray(material?.artworkFiles) && material.artworkFiles.length > 0)
                  ? material.artworkFiles
                  : [];
                sheet.artworkFiles = effectiveAw;
                if (Array.isArray(sheet.variants)) {
                  sheet.variants = normalizeVariants(sheet.variants, sheet.docHeader?.itemCode, sheet.docHeader?.docName, sheet.docHeader?.artworkCode, sheet.general?.netWeight, effectiveAw);
                }
                setSpecSheet(sheet);
                setArtworkFiles(effectiveAw);
              }
              if (onRefresh) onRefresh();
            }}
            showToast={showToast}
          />
        )}

        {/* Full Artwork Preview Modal / Lightbox */}
        {previewArtworkModal && (() => {
          const isPdf = previewArtworkModal.type?.includes('pdf') ||
            previewArtworkModal.name?.toLowerCase().endsWith('.pdf') ||
            previewArtworkModal.url?.startsWith('data:application/pdf') ||
            previewArtworkModal.url?.toLowerCase().includes('.pdf');
          // Convert data: URLs to blob: URLs so the browser can display them
          const viewUrl = previewArtworkModal.url?.startsWith('data:')
            ? dataUrlToBlobUrl(previewArtworkModal.url)
            : previewArtworkModal.url;

          return (
            <div
              className="modal-overlay open"
              style={{
                zIndex: 1350,
                background: 'rgba(3, 14, 18, 0.92)',
                backdropFilter: 'blur(8px)',
                padding: isFullScreenPreview ? 0 : '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={() => setPreviewArtworkModal(null)}
            >
              <div
                className="modal"
                style={{
                  maxWidth: isFullScreenPreview ? '100vw' : '92vw',
                  width: isFullScreenPreview ? '100vw' : '960px',
                  maxHeight: isFullScreenPreview ? '100vh' : '92vh',
                  height: isFullScreenPreview ? '100vh' : 'auto',
                  background: 'var(--card-bg, #FFFFFF)',
                  border: isFullScreenPreview ? 'none' : '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: isFullScreenPreview ? 0 : 'var(--radius-lg, 12px)',
                  padding: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{
                  padding: '12px 18px',
                  background: 'var(--surface-secondary, #F4F8F6)',
                  borderBottom: '1px solid var(--border-color, #e2e8f0)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <Eye size={15} style={{ color: 'var(--primary, #008767)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main, #102B36)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {previewArtworkModal.title || previewArtworkModal.name || 'Artwork Preview'}
                    </span>
                    {isPdf ? (
                      <span style={{ fontSize: '10px', background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0 }}>PDF</span>
                    ) : (
                      <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0 }}>Image Proof</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setIsFullScreenPreview(!isFullScreenPreview)}
                      style={{ padding: '3px 8px', fontSize: '10.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title={isFullScreenPreview ? "Exit Fullscreen" : "Toggle Fullscreen"}
                    >
                      <span>{isFullScreenPreview ? '⤓ Window' : '⤢ Fullscreen'}</span>
                    </button>
                    {viewUrl && (
                      <a
                        href={viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-sm"
                        style={{ padding: '3px 8px', fontSize: '10.5px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                        title="Open in new browser tab"
                      >
                        <Eye size={11} />
                        <span>New Tab</span>
                      </a>
                    )}
                    {previewArtworkModal.url && (
                      <a
                        href={previewArtworkModal.url}
                        download={previewArtworkModal.name || 'artwork'}
                        className="btn btn-outline btn-sm"
                        style={{ padding: '3px 8px', fontSize: '10.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Download original file"
                      >
                        <Download size={12} />
                        <span>Download</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewArtworkModal(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted, #94a3b8)',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: isPdf ? 0 : '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isPdf ? '#525659' : '#090d16',
                  minHeight: isFullScreenPreview ? 'calc(100vh - 55px)' : '420px'
                }}>
                  {isPdf ? (
                    <iframe
                      src={viewUrl}
                      title={previewArtworkModal.name || 'PDF Preview'}
                      style={{ width: '100%', height: isFullScreenPreview ? 'calc(100vh - 55px)' : '75vh', border: 'none', display: 'block' }}
                    />
                  ) : (
                    <>
                      <img
                        src={viewUrl}
                        alt={previewArtworkModal.name || 'Artwork'}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const fallback = e.target.nextElementSibling;
                          if (fallback) fallback.style.display = 'block';
                        }}
                        style={{
                          maxWidth: '100%',
                          maxHeight: isFullScreenPreview ? 'calc(100vh - 75px)' : '78vh',
                          objectFit: 'contain',
                          borderRadius: '6px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                        }}
                      />
                      <div style={{ display: 'none', textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>🖼️</div>
                        <p style={{ fontWeight: 600, fontSize: '13px', color: '#f1f5f9' }}>Image Preview Unavailable</p>
                        <p style={{ fontSize: '11px' }}>The artwork proof could not be loaded.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
