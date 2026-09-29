import React, { useState, useEffect, useRef } from 'react';
import { MAT_TYPES, PRINT_TYPES, isPouch, getMaterialLeadTime, POUCH_PRINT_LEAD, getSpecFields } from '../../constants';
import { getDefaultSpecSheet, generateDefaultPMCode, getArtworkCode, getPMPrefix, extractPMNumber } from '../../specTemplates';
import { today, calcProjectMilestones, fmt } from '../../utils';
import { getPackagingFormats } from '../../api';
import { FileText, Layers, Plus, Calendar, Clock, AlertTriangle, ArrowLeft, Eye, RefreshCw, Trash2, X, Download, ExternalLink, Image as ImageIcon } from 'lucide-react';

export default function AddProjectPage({ onCancel, onSave, editProject }) {
  const [fgCode, setFgCode] = useState('');
  const [projectName, setProjectName] = useState('');
  const [skuSize, setSkuSize] = useState('');
  const [briefDate, setBriefDate] = useState(today());
  const [targetLaunchDate, setTargetLaunchDate] = useState('');
  const [status, setStatus] = useState('On Track');
  const [risk, setRisk] = useState('Low');
  const [factory, setFactory] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState('Regular');
  const [projectCategory, setProjectCategory] = useState('NPD');

  const [materials, setMaterials] = useState([
    { name: '', pmCode: '', clubbedCodes: '', packagingFormatId: 'PF-01', type: MAT_TYPES[0], printType: 'Not Applicable', supplier: '', specs: {}, specSheet: null, artworkUrl: '', artworkFileName: '', variants: [], briefDate: today() }
  ]);
  const [packagingFormats, setPackagingFormats] = useState([]);
  const [expandedSpecRows, setExpandedSpecRows] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [previewArtworkModal, setPreviewArtworkModal] = useState(null);
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);

  const materialFileInputRefs = useRef({});
  const variantFileInputRefs = useRef({});

  useEffect(() => {
    let isMounted = true;
    getPackagingFormats()
      .then(res => {
        if (isMounted && res.data?.formats) {
          setPackagingFormats(res.data.formats);
        }
      })
      .catch(err => {
        console.warn('Could not load packaging formats from API:', err);
      });
    return () => { isMounted = false; };
  }, []);

  const estReadyDate = (briefDate && materials.length) ? calcProjectMilestones(briefDate, materials)?.Connectivity : null;

  useEffect(() => {
    if (editProject) {
      setFgCode(editProject.fgCode || '');
      setProjectName(editProject.projectName || '');
      setSkuSize(editProject.skuSize || editProject.grammage || '');
      setBriefDate(editProject.briefDate || today());
      setTargetLaunchDate(editProject.targetLaunchDate || '');
      setStatus(editProject.status || 'On Track');
      setRisk(editProject.risk || 'Low');
      setFactory(editProject.factory || '');
      setDescription(editProject.description || editProject.comments || '');
      setProjectType(editProject.projectType || 'Regular');
      setProjectCategory(editProject.projectCategory || 'NPD');
      setMaterials(editProject.materials ? editProject.materials.map((m, idx) => ({
        id: m.id || `${editProject.id}-mat-${idx}`,
        name: m.name,
        pmCode: m.pmCode || '',
        clubbedCodes: m.clubbedCodes || m.specSheet?.docHeader?.clubbedCodes || '',
        packagingFormatId: m.packagingFormatId || m.packaging_format_id || m.formatId || '',
        type: m.type,
        printType: m.printType || (isPouch(m.type) ? 'Digital Print' : 'Not Applicable'),
        supplier: m.supplier || '',
        customLeadTime: m.customLeadTime,
        poStatus: m.poStatus || 'RFQ in progress',
        poNumber: m.poNumber || '',
        specs: m.specs || {},
        specSheet: m.specSheet || null,
        artworkUrl: m.artworkUrl || m.specSheet?.artworkFiles?.[0]?.url || '',
        artworkFileName: m.specSheet?.artworkFiles?.[0]?.name || '',
        variants: m.variants || m.specSheet?.variants || [],
        briefDate: m.briefDate || m.milestones?.Brief || editProject.briefDate || today()
      })) : [{ name: '', pmCode: '', clubbedCodes: '', packagingFormatId: 'PF-01', type: MAT_TYPES[0], printType: 'Not Applicable', supplier: '', customLeadTime: '', poStatus: 'RFQ in progress', poNumber: '', specs: {}, specSheet: null, artworkUrl: '', artworkFileName: '', variants: [], briefDate: today() }]);
    } else {
      setFgCode('');
      setProjectName('');
      setSkuSize('');
      setBriefDate(today());
      setTargetLaunchDate('');
      setStatus('On Track');
      setRisk('Low');
      setFactory('');
      setDescription('');
      setProjectType('Regular');
      setProjectCategory('NPD');
      setMaterials([{ name: '', pmCode: '', clubbedCodes: '', packagingFormatId: 'PF-01', type: MAT_TYPES[0], printType: 'Not Applicable', supplier: '', customLeadTime: '', poStatus: 'RFQ in progress', poNumber: '', specs: {}, specSheet: null, artworkUrl: '', artworkFileName: '', variants: [], briefDate: today() }]);
    }
  }, [editProject]);

  const handleProjectBriefDateChange = (newDate) => {
    setBriefDate(newDate);
    setMaterials(prev => prev.map(m => ({ ...m, briefDate: newDate })));
  };

  const handleAddMaterialRow = () => {
    const defaultFmt = packagingFormats[0] || null;
    const defaultType = defaultFmt ? defaultFmt.name : MAT_TYPES[0];
    const defaultFmtId = defaultFmt ? defaultFmt.id : 'PF-01';
    setMaterials(prev => [...prev, {
      name: '', pmCode: '', clubbedCodes: '', packagingFormatId: defaultFmtId, type: defaultType, printType: 'Not Applicable',
      supplier: '', customLeadTime: '', poStatus: 'RFQ in progress', poNumber: '',
      specs: {}, specSheet: null, artworkUrl: '', artworkFileName: '', variants: [], briefDate
    }]);
  };

  const handleRemoveMaterialRow = (idx) => {
    if (materials.length <= 1) return;
    setMaterials(prev => prev.filter((_, i) => i !== idx));
  };

  const handleMatChange = (idx, field, val) => {
    setMaterials(prev => {
      const copy = [...prev];
      const updated = { ...copy[idx], [field]: val };
      if (field === 'packagingFormatId' || field === 'type') {
        const fmt = packagingFormats.find(f => f.id === val || f.name === val);
        const formatName = fmt ? fmt.name : val;
        const formatId = fmt ? fmt.id : (copy[idx].packagingFormatId || 'PF-24');
        updated.packagingFormatId = formatId;
        updated.type = formatName;

        const newPrefix = fmt?.codePrefix || getPMPrefix(formatName);
        const existingNum = extractPMNumber(copy[idx].pmCode, copy[idx].type);
        if (existingNum) {
          updated.pmCode = `${newPrefix}${existingNum}`;
        }
        const isFmtPouch = fmt ? fmt.isPouch : isPouch(formatName);
        if (isFmtPouch && (!updated.printType || updated.printType === 'Not Applicable')) {
          updated.printType = 'Digital Print';
        }
        if (updated.specSheet) {
          const newSheet = getDefaultSpecSheet(formatName, projectName.trim(), skuSize.trim(), idx);
          newSheet.docHeader.itemCode = updated.pmCode || newSheet.docHeader.itemCode;
          newSheet.docHeader.clubbedCodes = updated.clubbedCodes || '';
          newSheet.general.preferredSupplier = updated.supplier || '';
          updated.specSheet = newSheet;
        }
      }
      if (field === 'pmCode') {
        if (updated.specSheet?.docHeader) {
          const finalCode = val ? val.trim() : generateDefaultPMCode(updated.type, idx);
          updated.specSheet = {
            ...updated.specSheet,
            docHeader: {
              ...updated.specSheet.docHeader,
              itemCode: finalCode,
              artworkCode: getArtworkCode(finalCode)
            }
          };
        }
      }
      copy[idx] = updated;
      return copy;
    });
  };

  const toggleSpecRow = (idx) => {
    setMaterials(prev => {
      const copy = [...prev];
      if (!copy[idx].specSheet) {
        const defaultSheet = getDefaultSpecSheet(copy[idx].type, projectName.trim(), skuSize.trim(), idx);
        if (copy[idx].pmCode) defaultSheet.docHeader.itemCode = copy[idx].pmCode;
        if (copy[idx].clubbedCodes) defaultSheet.docHeader.clubbedCodes = copy[idx].clubbedCodes;
        if (copy[idx].supplier) defaultSheet.general.preferredSupplier = copy[idx].supplier;
        copy[idx].specSheet = defaultSheet;
      }
      return copy;
    });
    setExpandedSpecRows(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleParamValueChange = (matIdx, pIdx, field, val) => {
    setMaterials(prev => {
      const copy = [...prev];
      const m = { ...copy[matIdx] };
      if (!m.specSheet) m.specSheet = getDefaultSpecSheet(m.type, projectName, skuSize, matIdx);
      const params = [...(m.specSheet.parameters || [])];
      params[pIdx] = { ...params[pIdx], [field]: val };
      m.specSheet = { ...m.specSheet, parameters: params };
      copy[matIdx] = m;
      return copy;
    });
  };

  const handleAddParamRow = (matIdx) => {
    setMaterials(prev => {
      const copy = [...prev];
      const m = { ...copy[matIdx] };
      if (!m.specSheet) m.specSheet = getDefaultSpecSheet(m.type, projectName, skuSize, matIdx);
      const params = [...(m.specSheet.parameters || [])];
      params.push({ sNo: params.length + 1, parameter: 'New Parameter', units: 'mm', standard: '', testStandard: 'NA', defectType: 'MJ', factoryCheck: 'Yes' });
      m.specSheet = { ...m.specSheet, parameters: params };
      copy[matIdx] = m;
      return copy;
    });
  };

  const handleDeleteParamRow = (matIdx, pIdx) => {
    setMaterials(prev => {
      const copy = [...prev];
      const m = { ...copy[matIdx] };
      if (!m.specSheet) return copy;
      const params = (m.specSheet.parameters || []).filter((_, i) => i !== pIdx).map((p, i) => ({ ...p, sNo: i + 1 }));
      m.specSheet = { ...m.specSheet, parameters: params };
      copy[matIdx] = m;
      return copy;
    });
  };

  const handleGeneralFieldChange = (matIdx, field, val) => {
    setMaterials(prev => {
      const copy = [...prev];
      const m = { ...copy[matIdx] };
      if (!m.specSheet) m.specSheet = getDefaultSpecSheet(m.type, projectName, skuSize, matIdx);
      m.specSheet = { ...m.specSheet, general: { ...(m.specSheet.general || {}), [field]: val } };
      copy[matIdx] = m;
      return copy;
    });
  };

  const handleClubbedCodesChange = (matIdx, val) => {
    setMaterials(prev => {
      const copy = [...prev];
      const m = { ...copy[matIdx], clubbedCodes: val };
      if (!m.specSheet) m.specSheet = getDefaultSpecSheet(m.type, projectName, skuSize, matIdx);
      m.specSheet = { ...m.specSheet, docHeader: { ...(m.specSheet.docHeader || {}), clubbedCodes: val } };
      copy[matIdx] = m;
      return copy;
    });
  };

  const isPdfArtwork = (url, name) => {
    if (url && (url.startsWith('data:application/pdf') || url.toLowerCase().includes('.pdf'))) return true;
    if (name && name.toLowerCase().endsWith('.pdf')) return true;
    return false;
  };

  const validateArtworkFile = (file) => {
    if (!file) return false;
    if (file.size && file.size > 35 * 1024 * 1024) {
      alert('⚠️ Uploaded file exceeds 35MB. Please upload an artwork file under 35MB.');
      return false;
    }
    const ALLOWED_TYPES = [
      'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
      'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
      'application/pdf'
    ];
    const ALLOWED_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff|tif|pdf|ai|psd)$/i;
    const isAllowed = ALLOWED_TYPES.includes(file.type) || (!file.type && ALLOWED_EXTENSIONS.test(file.name)) || ALLOWED_EXTENSIONS.test(file.name);
    if (!isAllowed) {
      const ext = file.name.split('.').pop()?.toUpperCase() || 'file';
      alert(`⛔ ${ext} files are not allowed. Only artwork formats (PDF, PNG, JPG, WebP, SVG, TIFF, AI, PSD) are accepted.`);
      return false;
    }
    return true;
  };

  const handleArtworkUpload = (matIdx, file) => {
    if (!file) return;
    if (!validateArtworkFile(file)) return;
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setMaterials(prev => {
        const copy = [...prev];
        const m = { ...copy[matIdx], artworkUrl: dataUrl, artworkFileName: file.name, hasRemovedArtwork: false };
        if (!m.specSheet) m.specSheet = getDefaultSpecSheet(m.type, projectName, skuSize, matIdx);
        const artworkFiles = [{ name: file.name, url: dataUrl, type: isPdf ? 'application/pdf' : (file.type || 'image/png'), uploadedAt: new Date().toISOString() }];
        m.specSheet = { ...m.specSheet, artworkFiles, hasRemovedArtwork: false };
        if (m.specSheet.variants && m.specSheet.variants.length > 0) {
          const curVars = [...m.specSheet.variants];
          curVars[0] = {
            ...curVars[0],
            artworkUrl: dataUrl,
            artworkFileName: file.name,
            artworkFiles,
            hasRemovedArtwork: false
          };
          m.specSheet.variants = curVars;
          m.variants = curVars;
        }
        copy[matIdx] = m;
        return copy;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleVariantArtworkUpload = (matIdx, vIdx, file) => {
    if (!file) return;
    if (!validateArtworkFile(file)) return;
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setMaterials(prev => {
        const copy = [...prev];
        const m = { ...copy[matIdx] };
        if (!m.specSheet) m.specSheet = getDefaultSpecSheet(m.type, projectName, skuSize, matIdx);
        const curVars = [...(m.specSheet.variants || m.variants || [])];
        if (curVars[vIdx]) {
          const vArtFiles = [{ name: file.name, url: dataUrl, type: isPdf ? 'application/pdf' : (file.type || 'image/png'), uploadedAt: new Date().toISOString() }];
          curVars[vIdx] = {
            ...curVars[vIdx],
            artworkUrl: dataUrl,
            artworkFileName: file.name,
            artworkFiles: vArtFiles,
            hasRemovedArtwork: false
          };
          m.specSheet.variants = curVars;
          m.variants = curVars;
          if (vIdx === 0) {
            m.artworkUrl = dataUrl;
            m.artworkFileName = file.name;
            m.specSheet.artworkFiles = vArtFiles;
            m.hasRemovedArtwork = false;
          }
        }
        copy[matIdx] = m;
        return copy;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveArtwork = (matIdx) => {
    setMaterials(prev => {
      const copy = [...prev];
      const m = { ...copy[matIdx], artworkUrl: '', artworkFileName: '', hasRemovedArtwork: true };
      if (!m.specSheet) m.specSheet = getDefaultSpecSheet(m.type, projectName, skuSize, matIdx);
      m.specSheet = { ...m.specSheet, artworkFiles: [], hasRemovedArtwork: true };
      if (m.specSheet.variants && m.specSheet.variants.length > 0) {
        const curVars = [...m.specSheet.variants];
        curVars[0] = {
          ...curVars[0],
          artworkUrl: '',
          artworkFileName: '',
          artworkFiles: [],
          hasRemovedArtwork: true
        };
        m.specSheet.variants = curVars;
        m.variants = curVars;
      }
      copy[matIdx] = m;
      return copy;
    });
  };

  const handleRemoveVariantArtwork = (matIdx, vIdx) => {
    setMaterials(prev => {
      const copy = [...prev];
      const m = { ...copy[matIdx] };
      if (!m.specSheet) m.specSheet = getDefaultSpecSheet(m.type, projectName, skuSize, matIdx);
      const curVars = [...(m.specSheet.variants || m.variants || [])];
      if (curVars[vIdx]) {
        curVars[vIdx] = {
          ...curVars[vIdx],
          artworkUrl: '',
          artworkFileName: '',
          artworkFiles: [],
          hasRemovedArtwork: true
        };
        m.specSheet.variants = curVars;
        m.variants = curVars;
        if (vIdx === 0) {
          m.artworkUrl = '';
          m.artworkFileName = '';
          m.specSheet.artworkFiles = [];
          m.hasRemovedArtwork = true;
        }
      }
      copy[matIdx] = m;
      return copy;
    });
  };

  const handleOpenFullArtwork = (url, name, title) => {
    if (!url) return;
    setPreviewArtworkModal({ url, name, title });
    setIsFullScreenPreview(false);
  };

  const handleToggleVariantsMode = (matIdx, isMultiple) => {
    setMaterials(prev => {
      const copy = [...prev];
      const m = { ...copy[matIdx] };
      if (!m.specSheet) m.specSheet = getDefaultSpecSheet(m.type, projectName, skuSize, matIdx);
      
      if (isMultiple) {
        let curVars = (m.specSheet?.variants?.length ? m.specSheet.variants : m.variants) || [];
        if (curVars.length <= 1) {
          const basePm = m.pmCode || m.specSheet.docHeader?.itemCode || generateDefaultPMCode(m.type, matIdx);
          const baseDigits = parseInt(basePm.match(/\d+$/)?.[0] || '50560', 10);
          const prefix = basePm.replace(/\d+$/, '');
          const existingArtFiles = (m.artworkUrl) ? [{ name: m.artworkFileName || 'Artwork Proof', url: m.artworkUrl, type: 'image/png' }] : [];
          curVars = [
            { id: 'var-1', variantName: projectName ? `${projectName} - Variant 1` : 'Variant 1', itemCode: basePm, artworkCode: getArtworkCode(basePm), artworkFiles: existingArtFiles, artworkUrl: m.artworkUrl || '', artworkFileName: m.artworkFileName || '', pantoneColors: ['CMYK'], dimensions: 'Standard', netWeight: skuSize || 'Standard' },
            { id: 'var-2', variantName: projectName ? `${projectName} - Variant 2` : 'Variant 2', itemCode: `${prefix}${baseDigits + 1}`, artworkCode: getArtworkCode(`${prefix}${baseDigits + 1}`), artworkFiles: [], artworkUrl: '', artworkFileName: '', pantoneColors: ['CMYK'], dimensions: 'Standard', netWeight: skuSize || 'Standard' }
          ];
        }
        m.specSheet.variants = curVars;
        m.variants = curVars;
        const clubbedStr = curVars.map(v => v.itemCode).filter(Boolean).join(', ');
        m.clubbedCodes = clubbedStr;
        if (m.specSheet.docHeader) m.specSheet.docHeader.clubbedCodes = clubbedStr;
      } else {
        const basePm = m.pmCode || m.specSheet.docHeader?.itemCode || generateDefaultPMCode(m.type, matIdx);
        const singleVar = [{
          id: 'var-1',
          variantName: projectName || 'Standard SKU',
          itemCode: basePm,
          artworkCode: getArtworkCode(basePm),
          artworkFiles: m.specSheet.artworkFiles || (m.artworkUrl ? [{ name: m.artworkFileName || 'Artwork Proof', url: m.artworkUrl, type: 'image/png' }] : []),
          artworkUrl: m.artworkUrl || '',
          artworkFileName: m.artworkFileName || '',
          pantoneColors: ['CMYK'],
          dimensions: 'Standard Blueprint Dimensions',
          netWeight: skuSize || 'Standard'
        }];
        m.specSheet.variants = singleVar;
        m.variants = singleVar;
        m.clubbedCodes = '';
        if (m.specSheet.docHeader) m.specSheet.docHeader.clubbedCodes = '';
      }
      copy[matIdx] = m;
      return copy;
    });
  };

  const handleAddVariant = (matIdx) => {
    setMaterials(prev => {
      const copy = [...prev];
      const m = { ...copy[matIdx] };
      if (!m.specSheet) m.specSheet = getDefaultSpecSheet(m.type, projectName, skuSize, matIdx);
      const curVars = [...((m.specSheet?.variants?.length ? m.specSheet.variants : m.variants) || [])];
      const nextNum = curVars.length + 1;
      const basePm = m.pmCode || m.specSheet.docHeader?.itemCode || generateDefaultPMCode(m.type, matIdx);
      const baseDigits = parseInt(basePm.match(/\d+$/)?.[0] || '50560', 10);
      const prefix = basePm.replace(/\d+$/, '');
      const newCode = `${prefix}${baseDigits + nextNum - 1}`;
      curVars.push({
        id: `var-${Date.now()}-${nextNum}`,
        variantName: `Variant ${nextNum}`,
        itemCode: newCode,
        artworkCode: getArtworkCode(newCode),
        artworkFiles: [],
        artworkUrl: '',
        artworkFileName: '',
        pantoneColors: ['CMYK'],
        dimensions: 'Standard',
        netWeight: skuSize || 'Standard'
      });
      m.specSheet.variants = curVars;
      m.variants = curVars;
      const clubbedStr = curVars.map(v => v.itemCode).filter(Boolean).join(', ');
      m.clubbedCodes = clubbedStr;
      if (m.specSheet.docHeader) m.specSheet.docHeader.clubbedCodes = clubbedStr;
      copy[matIdx] = m;
      return copy;
    });
  };

  const handleUpdateVariantField = (matIdx, vIdx, field, val) => {
    setMaterials(prev => {
      const copy = [...prev];
      const m = { ...copy[matIdx] };
      if (!m.specSheet) return copy;
      const curVars = [...(m.specSheet.variants || [])];
      if (curVars[vIdx]) {
        curVars[vIdx] = { ...curVars[vIdx], [field]: val };
        if (field === 'itemCode' && !curVars[vIdx].artworkCode) {
          curVars[vIdx].artworkCode = getArtworkCode(val);
        }
      }
      m.specSheet.variants = curVars;
      m.variants = curVars;
      if (field === 'itemCode') {
        const clubbedStr = curVars.map(v => v.itemCode).filter(Boolean).join(', ');
        m.clubbedCodes = clubbedStr;
        if (m.specSheet.docHeader) m.specSheet.docHeader.clubbedCodes = clubbedStr;
      }
      copy[matIdx] = m;
      return copy;
    });
  };

  const handleRemoveVariant = (matIdx, vIdx) => {
    setMaterials(prev => {
      const copy = [...prev];
      const m = { ...copy[matIdx] };
      if (!m.specSheet) return copy;
      let curVars = (m.specSheet.variants || []).filter((_, i) => i !== vIdx);
      if (curVars.length <= 1) {
        m.clubbedCodes = '';
        if (m.specSheet.docHeader) m.specSheet.docHeader.clubbedCodes = '';
      } else {
        const clubbedStr = curVars.map(v => v.itemCode).filter(Boolean).join(', ');
        m.clubbedCodes = clubbedStr;
        if (m.specSheet.docHeader) m.specSheet.docHeader.clubbedCodes = clubbedStr;
      }
      m.specSheet.variants = curVars;
      m.variants = curVars;
      copy[matIdx] = m;
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) { alert('Project Name is required'); return; }
    if (!briefDate) { alert('Brief Date is required'); return; }

    const validMats = materials.filter(m => m.name.trim()).map((m, idx) => {
      let formatId = m.packagingFormatId || m.packaging_format_id || m.formatId;
      if (!formatId && packagingFormats.length > 0) {
        const matched = packagingFormats.find(f => f.name === m.type || f.id === m.type);
        if (matched) formatId = matched.id;
      }
      if (!formatId) formatId = 'PF-24';

      const pmCode = m.pmCode ? m.pmCode.trim() : generateDefaultPMCode(m.type, idx);
      const clubbedCodes = m.clubbedCodes ? m.clubbedCodes.trim() : '';
      const artworkCode = getArtworkCode(pmCode);
      const specDocName = `${pmCode} — ${m.name ? m.name.trim() : m.type}`.trim();

      let specSheet = m.specSheet ? JSON.parse(JSON.stringify(m.specSheet)) : getDefaultSpecSheet(m.type, projectName.trim(), skuSize.trim(), idx);
      if (!specSheet.docHeader) specSheet.docHeader = {};
      specSheet.docHeader.itemCode = pmCode;
      specSheet.docHeader.clubbedCodes = clubbedCodes;
      specSheet.docHeader.docName = specDocName;
      specSheet.docHeader.artworkCode = artworkCode;
      if (!specSheet.general) specSheet.general = {};
      specSheet.general.productName = projectName.trim();
      specSheet.general.packSize = skuSize.trim() || 'Standard';
      if (m.supplier) specSheet.general.preferredSupplier = m.supplier;

      if (m.artworkUrl && !m.hasRemovedArtwork) {
        if (!specSheet.artworkFiles) specSheet.artworkFiles = [];
        if (!specSheet.artworkFiles.some(a => a.url === m.artworkUrl)) {
          specSheet.artworkFiles.unshift({ name: m.artworkFileName || `${m.name || m.type} Master Artwork`, url: m.artworkUrl, type: 'image/png', uploadedAt: new Date().toISOString() });
        }
      } else {
        specSheet.artworkFiles = [];
      }
      if (m.variants && m.variants.length > 0) {
        specSheet.variants = m.variants.map(v => {
          let vFiles = Array.isArray(v.artworkFiles) && v.artworkFiles.length > 0 ? v.artworkFiles : [];
          if (!v.hasRemovedArtwork && vFiles.length === 0 && v.artworkUrl) {
            vFiles = [{ name: v.artworkFileName || `${v.variantName || 'Variant'} Artwork`, url: v.artworkUrl, type: 'image/png' }];
          }
          if (v.hasRemovedArtwork) {
            vFiles = [];
          }
          return {
            ...v,
            artworkUrl: v.hasRemovedArtwork ? '' : (v.artworkUrl || (vFiles[0]?.url || '')),
            artworkFileName: v.hasRemovedArtwork ? '' : (v.artworkFileName || (vFiles[0]?.name || '')),
            artworkFiles: vFiles,
            hasRemovedArtwork: !!v.hasRemovedArtwork
          };
        });
      }

      const artworkFiles = Array.isArray(specSheet.artworkFiles) ? specSheet.artworkFiles : [];
      const parentArtworkUrls = new Set(artworkFiles.map(file => file?.url).filter(Boolean));
      const compactVariants = (specSheet.variants || []).map(v => ({
        ...v,
        artworkUrl: typeof v.artworkUrl === 'string' && v.artworkUrl.startsWith('data:') ? '' : (v.artworkUrl || ''),
        artworkFiles: Array.isArray(v.artworkFiles)
          ? v.artworkFiles.filter(file => !parentArtworkUrls.has(file?.url))
          : []
      }));

      // Binary data is sent once; the server rebuilds mirrored spec-sheet references after storage.
      specSheet.artworkFiles = [];
      specSheet.variants = [];

      return {
        ...m,
        id: m.id || `${editProject ? editProject.id : 'proj'}-mat-${idx}`,
        packagingFormatId: formatId,
        packaging_format_id: formatId,
        formatId: formatId,
        briefDate: m.briefDate || briefDate,
        pmCode,
        clubbedCodes,
        artworkCode,
        artworkUrl: typeof m.artworkUrl === 'string' && m.artworkUrl.startsWith('data:') ? '' : (m.artworkUrl || ''),
        artworkFiles,
        variants: compactVariants,
        specSheet
      };
    });

    if (!validMats.length) { alert('At least 1 material with a name is required'); return; }

    for (const m of validMats) {
      if (isPouch(m.type) && (!m.printType || m.printType === 'Not Applicable')) {
        alert(`Pouch Confirmation Required: Please select the printing process (Digital: 15d, Flexo: 21d, or Gravure: 35d) for "${m.name || m.type}".`);
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSave({
        fgCode: fgCode.trim(),
        projectName: projectName.trim(),
        skuSize: skuSize.trim(),
        briefDate,
        targetLaunchDate: targetLaunchDate || estReadyDate || null,
        status, risk,
        supplier: validMats[0]?.supplier?.trim() || '',
        factory: factory.trim(),
        description: description.trim(),
        projectType, projectCategory,
        materials: validMats
      }, editProject ? editProject.id : null);
    } catch (err) {
      // error handled upstream via showToast
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="add-project-page">
      {/* ── Page Header ── */}
      <div className="add-project-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>
              {editProject ? `✏ Edit Project — ${editProject.projectName}` : '📦 New Packaging Project'}
            </h1>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {editProject ? 'Update project details, materials, and spec parameters below.' : 'Fill in project details and add packaging materials to get started.'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Form Body ── */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div className="add-project-page-body">

          {/* Project Details Grid */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-header-left">
                <div className="form-section-icon-badge">
                  <FileText size={17} strokeWidth={2.2} />
                </div>
                <div className="form-section-title-wrap">
                  <h2 className="form-section-title">Project Details</h2>
                  <span className="form-section-subtitle">Basic metadata, category classification, timelines and factory assignment</span>
                </div>
              </div>
            </div>
            <div className="form-grid" style={{ marginBottom: 0 }}>
              <div className="form-group">
                <label className="form-label">
                  Project Name <span className="req-star">*</span>
                </label>
                <input
                  className="modern-form-input"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="e.g. Muesli Dark Choco 400g Pouch"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">FG / PM Item Code</label>
                <input
                  className="modern-form-input"
                  value={fgCode}
                  onChange={e => setFgCode(e.target.value)}
                  placeholder="e.g. FG-89012345678"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Project Type</label>
                <select className="modern-form-select" value={projectType} onChange={e => { setProjectType(e.target.value); setProjectCategory('NPD'); }}>
                  <option value="Regular">Regular</option>
                  <option value="Growth">Growth</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Project Category</label>
                <select className="modern-form-select" value={projectCategory} onChange={e => setProjectCategory(e.target.value)}>
                  <option value="NPD">NPD</option>
                  <option value="EPD">EPD</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">SKU Size</label>
                <input
                  className="modern-form-input"
                  value={skuSize}
                  onChange={e => setSkuSize(e.target.value)}
                  placeholder="e.g. 400g, 1L, 500ml"
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Brief Start Date <span className="req-star">*</span>
                </label>
                <input
                  className="modern-form-input"
                  type="date"
                  value={briefDate}
                  onChange={e => handleProjectBriefDateChange(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Launch Timeline</label>
                  {estReadyDate && (
                    <span className="est-ready-pill" title="Estimated minimum completion date based on material lead times">
                      <Clock size={11} strokeWidth={2.2} />
                      Est. Ready: {fmt(estReadyDate)}
                    </span>
                  )}
                </div>
                <input
                  className="modern-form-input"
                  type="date"
                  value={targetLaunchDate}
                  placeholder={estReadyDate || ''}
                  onChange={e => setTargetLaunchDate(e.target.value)}
                />
                {targetLaunchDate && estReadyDate && targetLaunchDate < estReadyDate && (
                  <div className="crunched-timeline-banner">
                    <div className="crunched-timeline-header">
                      <span className="crunched-timeline-title">
                        <AlertTriangle size={14} strokeWidth={2.5} />
                        Crunched Timeline
                      </span>
                      <span className="crunched-timeline-badge">
                        {Math.round((new Date(estReadyDate) - new Date(targetLaunchDate)) / 86400000)} days compressed
                      </span>
                    </div>
                    <div className="crunched-timeline-desc">
                      Target launch precedes estimated readiness date. Requires Stage 1 (Admin) &amp; Stage 2 (Super Admin) approvals upon creation.
                    </div>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Project Status</label>
                <select className="modern-form-select" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="On Track">On Track</option>
                  <option value="At Risk">At Risk</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Risk Level</label>
                <select className="modern-form-select" value={risk} onChange={e => setRisk(e.target.value)}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Target Factory / DC</label>
                <input
                  className="modern-form-input"
                  value={factory}
                  onChange={e => setFactory(e.target.value)}
                  placeholder="e.g. Hoskote Unit 1"
                />
              </div>
              <div className="form-group full">
                <label className="form-label">Description / Scope Notes</label>
                <textarea
                  className="form-textarea"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Any key project notes, packaging constraints, launch objectives, or updates..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Materials Section */}
          <div className="form-section-card" style={{ marginTop: '16px' }}>
            <div className="form-section-header">
              <div className="form-section-header-left">
                <div className="form-section-icon-badge">
                  <Layers size={17} strokeWidth={2.2} />
                </div>
                <div className="form-section-title-wrap">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 className="form-section-title">Packaging Format</h2>
                    <span className="form-count-pill">
                      {materials.length} {materials.length === 1 ? 'Material' : 'Materials'}
                    </span>
                  </div>
                  <span className="form-section-subtitle">Specify primary, secondary, and tertiary substrates, codes, print formats, and lead times</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleAddMaterialRow}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              >
                <Plus size={14} strokeWidth={2.5} />
                Add Material
              </button>
            </div>

            <div className="modern-mat-table-wrap">
              <table className="modern-mat-table">
                <thead>
                  <tr>
                    <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '155px' }}>PM Code</th>
                    <th>Material Name *</th>
                    <th style={{ width: '140px' }}>Material Type</th>
                    <th style={{ width: '160px' }}>Print Type</th>
                    <th style={{ width: '135px' }}>Brief Date</th>
                    <th style={{ width: '105px' }}>Lead Time</th>
                    <th style={{ width: '130px' }}>Supplier</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Specs</th>
                    <th style={{ width: '35px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m, idx) => {
                    const isSpecOpen = !!expandedSpecRows[idx];
                    const hasAnySpec = !!(m.clubbedCodes || m.artworkUrl || (m.specSheet?.parameters?.some(p => !!p.standard)) || Object.keys(m.specs || {}).some(k => !!m.specs[k]));
                    const currentPmCode = m.pmCode ? m.pmCode.trim() : generateDefaultPMCode(m.type, idx);
                    const currentAwCode = getArtworkCode(currentPmCode);

                    return (
                      <React.Fragment key={idx}>
                        <tr>
                          <td style={{ textAlign: 'center', fontWeight: '700', fontSize: '11.5px', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                          <td style={{ width: '160px', minWidth: '160px' }}>
                            {(() => {
                              const prefix = getPMPrefix(m.type);
                              const currentNum = extractPMNumber(m.pmCode, m.type);
                              const defaultNum = String(50560 + idx);
                              return (
                                <div
                                  className="pm-code-input-group"
                                  title={`Packaging Prefix: ${prefix} — Enter numeric identifier`}
                                >
                                  <span className="pm-code-prefix">
                                    {prefix}
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="pm-code-input"
                                    value={currentNum}
                                    onChange={e => {
                                      const extracted = extractPMNumber(e.target.value, m.type);
                                      const numOnly = extracted.replace(/[^0-9]/g, '');
                                      handleMatChange(idx, 'pmCode', numOnly ? `${prefix}${numOnly}` : '');
                                    }}
                                    placeholder={defaultNum}
                                    title="Enter PM code number"
                                  />
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                            <input
                              className="modern-form-input"
                              value={m.name}
                              onChange={e => handleMatChange(idx, 'name', e.target.value)}
                              placeholder={idx === 0 ? 'e.g. Primary Pouch / Film' : idx === 1 ? 'e.g. Secondary Box' : 'e.g. Tertiary Shipper'}
                              required
                            />
                          </td>
                          <td>
                            <select
                              className="modern-form-select"
                              value={m.packagingFormatId || packagingFormats.find(f => f.name === m.type)?.id || m.type}
                              onChange={e => handleMatChange(idx, 'packagingFormatId', e.target.value)}
                            >
                              {packagingFormats.length > 0 ? (
                                packagingFormats.map(fmt => (
                                  <option key={fmt.id} value={fmt.id}>
                                    {fmt.name} ({fmt.id})
                                  </option>
                                ))
                              ) : (
                                MAT_TYPES.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))
                              )}
                            </select>
                          </td>
                          <td>
                            {isPouch(m.type) ? (
                              <select
                                className="modern-form-select"
                                value={m.printType || ''}
                                onChange={e => handleMatChange(idx, 'printType', e.target.value)}
                                style={(!m.printType || m.printType === 'Not Applicable') ? { borderColor: '#F59E0B', color: '#B45309' } : {}}
                              >
                                {(!m.printType || m.printType === 'Not Applicable') && (
                                  <option value="" style={{ color: '#D97706' }}>⚠️ Select Print Type...</option>
                                )}
                                <option value="Digital Print">Digital Print (15d)</option>
                                <option value="Flexo Print">Flexo Print (21d)</option>
                                <option value="Gravure Print">Gravure Print (35d)</option>
                              </select>
                            ) : (
                              <select
                                className="modern-form-select"
                                value={m.printType || 'Not Applicable'}
                                onChange={e => handleMatChange(idx, 'printType', e.target.value)}
                              >
                                {PRINT_TYPES.map(pt => (
                                  <option key={pt} value={pt}>{pt}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td>
                            <input
                              type="date"
                              className="modern-form-input"
                              value={m.briefDate || briefDate}
                              onChange={e => handleMatChange(idx, 'briefDate', e.target.value)}
                            />
                          </td>
                          <td>
                            {m.type === 'Other' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="number" min="1" max="365"
                                  className="modern-form-input"
                                  style={{ width: '55px', padding: '0 6px', textAlign: 'center', height: '35px' }}
                                  value={m.customLeadTime !== undefined && m.customLeadTime !== '' ? m.customLeadTime : 15}
                                  onChange={e => handleMatChange(idx, 'customLeadTime', e.target.value)}
                                />
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>days</span>
                              </div>
                            ) : isPouch(m.type) ? (
                              (!m.printType || m.printType === 'Not Applicable') ? (
                                <span style={{ fontSize: '10.5px', color: '#B45309', fontWeight: 600, background: '#FEF3C7', padding: '3px 7px', borderRadius: '5px', border: '1px solid #FCD34D' }}>
                                  ⚠️ Required
                                </span>
                              ) : (
                                <span className="lead-time-pill">
                                  <Clock size={11} strokeWidth={2.2} />
                                  {getMaterialLeadTime(m)}d
                                </span>
                              )
                            ) : (
                              <span className="lead-time-pill">
                                <Clock size={11} strokeWidth={2.2} />
                                {getMaterialLeadTime(m)}d
                              </span>
                            )}
                          </td>
                          <td>
                            <input
                              className="modern-form-input"
                              value={m.supplier || ''}
                              onChange={e => handleMatChange(idx, 'supplier', e.target.value)}
                              placeholder="e.g. TCPL, Amcor"
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <button
                                type="button"
                                onClick={() => toggleSpecRow(idx)}
                                style={{
                                  background: isSpecOpen ? '#EAF2EE' : hasAnySpec ? '#ECFDF5' : '#F8FAF9',
                                  border: `1px solid ${hasAnySpec ? '#10B981' : isSpecOpen ? 'var(--teal)' : '#D6E0DA'}`,
                                  color: hasAnySpec ? '#047857' : isSpecOpen ? 'var(--teal)' : 'var(--text-secondary)',
                                  padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', transition: 'all 0.15s ease'
                                }}
                                title={`Configure specification parameters for ${m.type}`}
                              >
                                {isSpecOpen ? '▲ Hide' : hasAnySpec ? '📋 Specs ✓' : '＋ Specs'}
                              </button>
                              <span style={{
                                fontSize: '9px',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: (m.variants?.length > 1 || m.specSheet?.variants?.length > 1) ? '#FDF2F8' : '#F0F9FF',
                                color: (m.variants?.length > 1 || m.specSheet?.variants?.length > 1) ? '#DB2777' : '#0284C7',
                                border: `1px solid ${(m.variants?.length > 1 || m.specSheet?.variants?.length > 1) ? '#FBCFE8' : '#BAE6FD'}`,
                                whiteSpace: 'nowrap'
                              }}>
                                {(m.variants?.length > 1 || m.specSheet?.variants?.length > 1) ? `✨ ${(m.specSheet?.variants || m.variants).length} Vars` : '1 SKU'}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {materials.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleRemoveMaterialRow(idx)}
                                style={{ padding: '3px 6px', color: '#EF4444' }}
                                title="Remove material"
                              >✕</button>
                            )}
                          </td>
                        </tr>

                        {/* SPECIFICATION PARAMETERS EXPANDABLE ROW */}
                        {isSpecOpen && (
                          <tr className="spec-sub-row">
                            <td colSpan="10" style={{ padding: '0 !important' }}>
                              <div style={{ padding: '16px 20px', background: '#F8FAF9', border: '1px solid #DCE5E0', borderLeft: '4px solid var(--teal)', margin: '6px 10px 16px 10px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(16,43,54,0.04)' }}>

                                {/* Drawer Header */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #EEF3F0', flexWrap: 'wrap', gap: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <span style={{ background: '#EAF2EE', border: '1px solid rgba(0,135,103,0.25)', color: '#008767', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                      📋 Spec Layout · {m.type}
                                    </span>
                                    <span style={{ fontSize: '11px', fontFamily: 'monospace', background: '#EAF2EE', border: '1px solid rgba(0,135,103,0.25)', color: '#008767', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                      Doc Code: {currentPmCode}
                                    </span>
                                    <span style={{ fontSize: '11px', fontFamily: 'monospace', background: '#FDF2F8', border: '1px solid #FBCFE8', color: '#DB2777', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                      Artwork Code: {currentAwCode}
                                    </span>
                                  </div>
                                  <button type="button" onClick={() => toggleSpecRow(idx)} style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px' }}>
                                    ▲ Collapse Specs
                                  </button>
                                </div>

                                {/* ── Interactive Variant Configuration Prompt ── */}
                                <div style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(99,102,241,0.12))', border: '1px solid rgba(14,165,233,0.35)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                    <div>
                                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>🎨</span>
                                        <span>Does this packaging material have multiple variants / clubbed artworks?</span>
                                      </div>
                                      <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                                        Select whether this specification covers a single standard SKU or multiple flavor/variant clubbed artworks.
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.35)', padding: '3px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleVariantsMode(idx, false)}
                                        style={{
                                          padding: '5px 12px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          border: 'none',
                                          background: !(m.variants?.length > 1 || m.specSheet?.variants?.length > 1) ? '#0284c7' : 'transparent',
                                          color: !(m.variants?.length > 1 || m.specSheet?.variants?.length > 1) ? '#ffffff' : '#94a3b8',
                                          boxShadow: !(m.variants?.length > 1 || m.specSheet?.variants?.length > 1) ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        ✓ Single Variant (Standard SKU)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleVariantsMode(idx, true)}
                                        style={{
                                          padding: '5px 12px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          border: 'none',
                                          background: (m.variants?.length > 1 || m.specSheet?.variants?.length > 1) ? 'linear-gradient(135deg, #d946ef, #8b5cf6)' : 'transparent',
                                          color: (m.variants?.length > 1 || m.specSheet?.variants?.length > 1) ? '#ffffff' : '#94a3b8',
                                          boxShadow: (m.variants?.length > 1 || m.specSheet?.variants?.length > 1) ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        ✨ Multiple Variants (Clubbed Artworks)
                                      </button>
                                    </div>
                                  </div>

                                  {(m.variants?.length > 1 || m.specSheet?.variants?.length > 1) ? (
                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#e879f9' }}>
                                          Configured Variants ({(m.specSheet?.variants || m.variants || []).length}) &bull; Each variant gets a dedicated artwork sheet titled: <em>Artwork: Variant N &mdash; [Name]</em>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleAddVariant(idx)}
                                          style={{ background: 'rgba(217,70,239,0.2)', border: '1px solid #d946ef', color: '#f0abfc', padding: '3px 10px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                          ＋ Add Another Variant SKU
                                        </button>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {(m.specSheet?.variants || m.variants || []).map((v, vIdx) => {
                                          const vArtUrl = v.hasRemovedArtwork ? '' : (v.artworkUrl || v.artworkFiles?.[0]?.url || (vIdx === 0 && !m.hasRemovedArtwork ? m.artworkUrl : ''));
                                          const vArtName = v.hasRemovedArtwork ? '' : (v.artworkFileName || v.artworkFiles?.[0]?.name || (vIdx === 0 && !m.hasRemovedArtwork ? m.artworkFileName : ''));
                                          const vTitle = `Variant ${vIdx + 1}: ${v.variantName || 'Variant'} (${v.itemCode || 'PM-TBD'}) — Artwork Reference`;

                                          return (
                                            <div
                                              key={v.id || vIdx}
                                              style={{
                                                display: 'grid',
                                                gridTemplateColumns: '65px 1fr 0.9fr 0.9fr auto 28px',
                                                gap: '8px',
                                                alignItems: 'center',
                                                background: 'rgba(0,0,0,0.3)',
                                                padding: '6px 10px',
                                                borderRadius: '4px',
                                                border: '1px solid rgba(255,255,255,0.08)'
                                              }}
                                            >
                                               <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#cbd5e1' }}>Variant {vIdx + 1}</span>
                                               <input
                                                 className="modern-form-input"
                                                 style={{ fontSize: '11px', padding: '3px 6px' }}
                                                 value={v.variantName || v.name || ''}
                                                 onChange={e => handleUpdateVariantField(idx, vIdx, 'variantName', e.target.value)}
                                                 placeholder="Variant Name (e.g. Trail Mix)"
                                               />
                                               <input
                                                 className="modern-form-input"
                                                 style={{ fontSize: '11px', padding: '3px 6px', fontFamily: 'monospace' }}
                                                 value={v.itemCode || v.code || ''}
                                                 onChange={e => handleUpdateVariantField(idx, vIdx, 'itemCode', e.target.value)}
                                                 placeholder="Item Code"
                                               />
                                               <input
                                                 className="modern-form-input"
                                                 style={{ fontSize: '11px', padding: '3px 6px', fontFamily: 'monospace' }}
                                                 value={v.artworkCode || ''}
                                                 onChange={e => handleUpdateVariantField(idx, vIdx, 'artworkCode', e.target.value)}
                                                 placeholder="Artwork Code"
                                               />

                                               {/* Variant Artwork Controls: Replace, Open Full, Remove */}
                                               <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                 <input
                                                   type="file"
                                                   ref={el => {
                                                     if (!variantFileInputRefs.current[idx]) variantFileInputRefs.current[idx] = {};
                                                     variantFileInputRefs.current[idx][vIdx] = el;
                                                   }}
                                                   accept="image/*,application/pdf,.pdf,.ai,.psd"
                                                   onChange={e => {
                                                     if (e.target.files?.[0]) handleVariantArtworkUpload(idx, vIdx, e.target.files[0]);
                                                     e.target.value = '';
                                                   }}
                                                   style={{ display: 'none' }}
                                                 />

                                                 {vArtUrl ? (
                                                   <>
                                                     <div
                                                       onClick={() => handleOpenFullArtwork(vArtUrl, vArtName, vTitle)}
                                                       style={{
                                                         width: '24px',
                                                         height: '24px',
                                                         borderRadius: '3px',
                                                         border: '1px solid #10b981',
                                                         overflow: 'hidden',
                                                         background: '#000',
                                                         cursor: 'pointer',
                                                         display: 'flex',
                                                         alignItems: 'center',
                                                         justifyContent: 'center',
                                                         flexShrink: 0
                                                       }}
                                                       title="Click to open full-resolution preview"
                                                     >
                                                       {isPdfArtwork(vArtUrl, vArtName) ? (
                                                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#ef4444' }}>PDF</span>
                                                        ) : (
                                                          <img src={vArtUrl} alt="Proof" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                        )}
                                                     </div>
                                                     <button
                                                       type="button"
                                                       onClick={() => variantFileInputRefs.current[idx]?.[vIdx]?.click()}
                                                       style={{
                                                         background: 'rgba(255,255,255,0.08)',
                                                         border: '1px solid rgba(255,255,255,0.18)',
                                                         color: '#cbd5e1',
                                                         padding: '2px 6px',
                                                         borderRadius: '3px',
                                                         fontSize: '9.5px',
                                                         fontWeight: 600,
                                                         cursor: 'pointer'
                                                       }}
                                                       title="Replace Artwork Image"
                                                     >
                                                       🔄 Replace
                                                     </button>
                                                     <button
                                                       type="button"
                                                       onClick={() => handleOpenFullArtwork(vArtUrl, vArtName, vTitle)}
                                                       style={{
                                                         background: 'rgba(14,165,233,0.15)',
                                                         border: '1px solid #0284c7',
                                                         color: '#38bdf8',
                                                         padding: '2px 6px',
                                                         borderRadius: '3px',
                                                         fontSize: '9.5px',
                                                         fontWeight: 600,
                                                         cursor: 'pointer'
                                                       }}
                                                       title="Open Full Screen Preview"
                                                     >
                                                       ↗ Open Full
                                                     </button>
                                                     <button
                                                       type="button"
                                                       onClick={() => handleRemoveVariantArtwork(idx, vIdx)}
                                                       style={{
                                                         background: 'rgba(239,68,68,0.15)',
                                                         border: '1px solid rgba(239,68,68,0.3)',
                                                         color: '#ef4444',
                                                         padding: '2px 5px',
                                                         borderRadius: '3px',
                                                         fontSize: '9.5px',
                                                         fontWeight: 700,
                                                         cursor: 'pointer'
                                                       }}
                                                       title="Remove Artwork from Variant"
                                                     >
                                                       ✕ Remove
                                                     </button>
                                                   </>
                                                 ) : (
                                                   <button
                                                     type="button"
                                                     onClick={() => variantFileInputRefs.current[idx]?.[vIdx]?.click()}
                                                     style={{
                                                       background: 'rgba(2, 132, 199, 0.15)',
                                                       border: '1px dashed #0284c7',
                                                       color: '#38bdf8',
                                                       padding: '2px 8px',
                                                       borderRadius: '3px',
                                                       fontSize: '9.5px',
                                                       fontWeight: 700,
                                                       cursor: 'pointer',
                                                       whiteSpace: 'nowrap'
                                                     }}
                                                     title="Upload Artwork Image for this variant"
                                                   >
                                                     ＋ Artwork
                                                   </button>
                                                 )}
                                               </div>

                                               <button
                                                 type="button"
                                                 onClick={() => handleRemoveVariant(idx, vIdx)}
                                                 style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', textAlign: 'center' }}
                                                 title="Remove Variant SKU"
                                               >
                                                 ✕
                                               </button>
                                             </div>
                                           );
                                         })}
                                       </div>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '10.5px', color: '#6ee7b7', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>✓</span>
                                      <span>Single Standard SKU configured. The specification will generate a single clean <strong>Artwork</strong> page (without "Variant 1 &mdash;" prefix).</span>
                                    </div>
                                  )}
                                </div>

                                {/* Code Clubbing & General Attributes */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '16px', background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2EBE6' }}>
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>🗂 Clubbed Item Codes (Variant Grouping)</label>
                                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>e.g. PM/PR/FLM/12691,87,86,88,89,12838 or comma-separated variant codes</span>
                                    </div>
                                    <input
                                      className="modern-form-input"
                                      style={{ width: '100%', fontSize: '12px', fontFamily: 'monospace' }}
                                      value={m.clubbedCodes || m.specSheet?.docHeader?.clubbedCodes || ''}
                                      onChange={e => handleClubbedCodesChange(idx, e.target.value)}
                                      placeholder="e.g. PM/PR/FLM/12691, 12687, 12686, 12688, 12689, 12838"
                                    />
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                      ℹ️ In Yoga Bar packaging standards, multiple product variants share the same physical substrate specification while retaining distinct artwork reference pages.
                                    </div>
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#364B53', marginBottom: '4px' }}>Material Structure / Substrate</label>
                                    <input className="modern-form-input" style={{ width: '100%', fontSize: '12px' }} value={m.specSheet?.general?.structure || ''} onChange={e => handleGeneralFieldChange(idx, 'structure', e.target.value)} placeholder="e.g. 5 PLY semi virgin Kraft paper or 18 µ Matt Bopp + 12 µ METPET + 40 µ PE" />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#364B53', marginBottom: '4px' }}>Style / Format Construct</label>
                                    <input className="modern-form-input" style={{ width: '100%', fontSize: '12px' }} value={m.specSheet?.general?.style || ''} onChange={e => handleGeneralFieldChange(idx, 'style', e.target.value)} placeholder="e.g. RSC or Cylindrical Jar or Die punch Label in Roll Form" />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#364B53', marginBottom: '4px' }}>Print Colors</label>
                                    <input className="modern-form-input" style={{ width: '100%', fontSize: '12px' }} value={m.specSheet?.general?.printColors || ''} onChange={e => handleGeneralFieldChange(idx, 'printColors', e.target.value)} placeholder="e.g. Green & Blue or As per approved AW" />
                                  </div>
                                </div>

                                {/* Parameters Table */}
                                <div style={{ marginBottom: '18px' }}>
                                  <div style={{ background: '#f8cbad', color: '#111827', padding: '7px 12px', fontWeight: 800, fontSize: '12px', textAlign: 'center', letterSpacing: '0.5px', borderRadius: '5px 5px 0 0', border: '1px solid #d1a485', borderBottom: 'none' }}>
                                    {m.specSheet?.sectionTitle || 'Technical Parameters Details'}
                                  </div>
                                  <div style={{ overflowX: 'auto', border: '1px solid #475569', borderRadius: '0 0 5px 5px', background: '#ffffff' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: '#111827' }}>
                                      <thead>
                                        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                                          <th style={{ padding: '6px 8px', width: '35px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>S.No.</th>
                                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#334155', minWidth: '160px' }}>Parameter</th>
                                          <th style={{ padding: '6px 8px', width: '70px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Units</th>
                                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 800, color: '#0f172a', background: '#e0f2fe', minWidth: '220px' }}>Standard / Target Value (Tolerance) *</th>
                                          <th style={{ padding: '6px 8px', width: '110px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Test Standard</th>
                                          <th style={{ padding: '6px 8px', width: '85px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Defect Type</th>
                                          <th style={{ padding: '6px 8px', width: '80px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Factory Check</th>
                                          <th style={{ padding: '6px 6px', width: '35px', textAlign: 'center' }}></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(m.specSheet?.parameters || []).map((p, pIdx) => (
                                          <tr key={pIdx} style={{ borderBottom: '1px solid #e2e8f0', background: pIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                            <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{p.sNo || pIdx + 1}</td>
                                            <td style={{ padding: '5px 10px', fontWeight: 600, color: '#1e293b' }}>
                                              <input type="text" style={{ width: '100%', border: '1px solid transparent', background: 'transparent', padding: '2px 4px', fontSize: '11px', fontWeight: 600, color: '#1e293b' }} value={p.parameter || ''} onChange={e => handleParamValueChange(idx, pIdx, 'parameter', e.target.value)} placeholder="Parameter name" />
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                              <input type="text" style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '3px', textAlign: 'center', padding: '2px 4px', fontSize: '10.5px' }} value={p.units || '-'} onChange={e => handleParamValueChange(idx, pIdx, 'units', e.target.value)} />
                                            </td>
                                            <td style={{ padding: '5px 10px', background: '#f0f9ff' }}>
                                              <input type="text" style={{ width: '100%', border: '1px solid #0284c7', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, color: '#0369a1', background: '#ffffff' }} value={p.standard || ''} onChange={e => handleParamValueChange(idx, pIdx, 'standard', e.target.value)} placeholder="e.g. 435x330x180mm± 5 ID or 75.2-83.1" />
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                              <input type="text" style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '3px', textAlign: 'center', padding: '2px 4px', fontSize: '10.5px' }} value={p.testStandard || 'NA'} onChange={e => handleParamValueChange(idx, pIdx, 'testStandard', e.target.value)} />
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                              <select style={{ padding: '2px 4px', borderRadius: '3px', fontSize: '10.5px', fontWeight: 700, border: '1px solid #cbd5e1', color: p.defectType === 'CR' ? '#b91c1c' : p.defectType === 'MJ' ? '#b45309' : '#0369a1' }} value={p.defectType || 'CR'} onChange={e => handleParamValueChange(idx, pIdx, 'defectType', e.target.value)}>
                                                <option value="CR">CR (Critical)</option>
                                                <option value="MJ">MJ (Major)</option>
                                                <option value="MI">MI (Minor)</option>
                                              </select>
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                              <select style={{ padding: '2px 4px', borderRadius: '3px', fontSize: '10.5px', border: '1px solid #cbd5e1' }} value={p.factoryCheck || 'Yes'} onChange={e => handleParamValueChange(idx, pIdx, 'factoryCheck', e.target.value)}>
                                                <option value="Yes">Yes</option>
                                                <option value="NA">NA</option>
                                                <option value="No">No</option>
                                              </select>
                                            </td>
                                            <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                                              <button type="button" onClick={() => handleDeleteParamRow(idx, pIdx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }} title="Remove Parameter">✕</button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                    <button type="button" onClick={() => handleAddParamRow(idx)} style={{ background: 'rgba(20,184,166,0.15)', border: '1px solid #14b8a6', color: '#14b8a6', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                      ＋ Add Custom Parameter
                                    </button>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Parameters &amp; units strictly follow Yoga Bar quality &amp; engineering standards</span>
                                  </div>
                                </div>

                                {/* Artwork & References */}
                                <div style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.25)', borderRadius: '8px', padding: '14px 16px' }}>
                                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                       <span style={{ fontSize: '15px' }}>🎨</span>
                                       <span style={{ fontSize: '12px', fontWeight: 800, color: '#f472b6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Artwork Reference &amp; Variant Color Proofs</span>
                                       <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(236,72,153,0.2)', color: '#f472b6', fontFamily: 'monospace', fontWeight: 700 }}>{currentAwCode}</span>
                                     </div>
                                     <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Mandatory reference sheets for print proofs, Pantone swatches, and dieline specs (Image formats only)</span>
                                   </div>

                                   {(m.variants?.length > 1 || m.specSheet?.variants?.length > 1) ? (
                                     /* Multiple Variants Artwork Cards Grid */
                                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                                       {(m.specSheet?.variants || m.variants || []).map((v, vIdx) => {
                                         const vArtUrl = v.hasRemovedArtwork ? '' : (v.artworkUrl || v.artworkFiles?.[0]?.url || (vIdx === 0 && !m.hasRemovedArtwork ? m.artworkUrl : ''));
                                         const vArtName = v.hasRemovedArtwork ? '' : (v.artworkFileName || v.artworkFiles?.[0]?.name || (vIdx === 0 && !m.hasRemovedArtwork ? m.artworkFileName : ''));
                                         const vTitle = `Variant ${vIdx + 1}: ${v.variantName || 'Variant'} (${v.itemCode || 'PM-TBD'}) — Artwork Reference`;

                                         return (
                                           <div
                                             key={v.id || vIdx}
                                             style={{
                                               background: 'rgba(0,0,0,0.25)',
                                               border: '1px solid rgba(255,255,255,0.08)',
                                               borderRadius: '6px',
                                               padding: '10px 12px',
                                               display: 'flex',
                                               flexDirection: 'column',
                                               gap: '8px'
                                             }}
                                           >
                                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                               <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                 <span style={{ fontSize: '11px', fontWeight: 800, color: '#e879f9' }}>
                                                   Variant {vIdx + 1}: {v.variantName || `Variant ${vIdx + 1}`}
                                                 </span>
                                                 <span style={{ fontSize: '9.5px', color: '#94a3b8', fontFamily: 'monospace' }}>
                                                   {v.itemCode || 'PM-TBD'}
                                                 </span>
                                               </div>
                                               <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(236,72,153,0.15)', color: '#f472b6', fontFamily: 'monospace', fontWeight: 700 }}>
                                                 {v.artworkCode || getArtworkCode(v.itemCode || currentPmCode)}
                                               </span>
                                             </div>

                                             <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                               {vArtUrl ? (
                                                 <div
                                                   onClick={() => handleOpenFullArtwork(vArtUrl, vArtName, vTitle)}
                                                   style={{
                                                     width: '60px',
                                                     height: '60px',
                                                     borderRadius: '4px',
                                                     border: '1px solid rgba(236,72,153,0.5)',
                                                     overflow: 'hidden',
                                                     background: '#000',
                                                     display: 'flex',
                                                     alignItems: 'center',
                                                     justifyContent: 'center',
                                                     cursor: 'pointer',
                                                     flexShrink: 0
                                                   }}
                                                   title="Click to view full preview"
                                                 >
                                                   {isPdfArtwork(vArtUrl, vArtName) ? (
                                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                                                        <span style={{ fontSize: '13px', fontWeight: 800 }}>PDF</span>
                                                        <span style={{ fontSize: '8px', color: '#cbd5e1' }}>Doc</span>
                                                      </div>
                                                    ) : (
                                                      <img src={vArtUrl} alt={v.variantName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                    )}
                                                 </div>
                                               ) : (
                                                 <div style={{ width: '60px', height: '60px', borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', padding: '4px', flexShrink: 0 }}>
                                                   No Artwork
                                                 </div>
                                               )}

                                               <div style={{ flex: 1, minWidth: 0 }}>
                                                 {vArtUrl ? (
                                                   <div>
                                                     <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                       <span>✓</span>
                                                       <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vArtName || 'Artwork Loaded'}</span>
                                                     </div>
                                                     <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                       <button
                                                         type="button"
                                                         onClick={() => variantFileInputRefs.current[idx]?.[vIdx]?.click()}
                                                         style={{
                                                           background: 'rgba(255,255,255,0.08)',
                                                           border: '1px solid rgba(255,255,255,0.18)',
                                                           color: '#cbd5e1',
                                                           padding: '3px 8px',
                                                           borderRadius: '4px',
                                                           fontSize: '10px',
                                                           fontWeight: 600,
                                                           cursor: 'pointer'
                                                         }}
                                                       >
                                                         🔄 Replace
                                                       </button>
                                                       <button
                                                         type="button"
                                                         onClick={() => handleOpenFullArtwork(vArtUrl, vArtName, vTitle)}
                                                         style={{
                                                           background: 'rgba(14,165,233,0.15)',
                                                           border: '1px solid #0284c7',
                                                           color: '#38bdf8',
                                                           padding: '3px 8px',
                                                           borderRadius: '4px',
                                                           fontSize: '10px',
                                                           fontWeight: 600,
                                                           cursor: 'pointer'
                                                         }}
                                                       >
                                                         ↗ Open Full
                                                       </button>
                                                       <button
                                                         type="button"
                                                         onClick={() => handleRemoveVariantArtwork(idx, vIdx)}
                                                         style={{
                                                           background: 'rgba(239,68,68,0.15)',
                                                           border: '1px solid rgba(239,68,68,0.3)',
                                                           color: '#ef4444',
                                                           padding: '3px 8px',
                                                           borderRadius: '4px',
                                                           fontSize: '10px',
                                                           fontWeight: 700,
                                                           cursor: 'pointer'
                                                         }}
                                                       >
                                                         ✕ Remove
                                                       </button>
                                                     </div>
                                                   </div>
                                                 ) : (
                                                   <div>
                                                     <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                                                       Attach image proof for this SKU
                                                     </div>
                                                     <button
                                                       type="button"
                                                       onClick={() => variantFileInputRefs.current[idx]?.[vIdx]?.click()}
                                                       style={{
                                                         background: 'rgba(217,70,239,0.15)',
                                                         border: '1px solid #d946ef',
                                                         color: '#f0abfc',
                                                         padding: '4px 10px',
                                                         borderRadius: '4px',
                                                         fontSize: '10.5px',
                                                         fontWeight: 700,
                                                         cursor: 'pointer'
                                                       }}
                                                     >
                                                       ＋ Upload Proof (Image)
                                                     </button>
                                                   </div>
                                                 )}
                                               </div>
                                             </div>
                                           </div>
                                         );
                                       })}
                                     </div>
                                   ) : (
                                     /* Single Variant Artwork Card */
                                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', alignItems: 'center' }}>
                                       <div>
                                         <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                                           Upload Artwork Proof (PDF, PNG, JPG, WebP, SVG, AI)
                                         </label>
                                         <input
                                           type="file"
                                           ref={el => { materialFileInputRefs.current[idx] = el; }}
                                           accept="image/*,application/pdf,.pdf,.ai,.psd"
                                           onChange={e => {
                                             if (e.target.files?.[0]) handleArtworkUpload(idx, e.target.files[0]);
                                             e.target.value = '';
                                           }}
                                           style={{ width: '100%', fontSize: '11px', color: 'var(--text-dim)', padding: '4px 0' }}
                                         />
                                         <div style={{ marginTop: '4px' }}>
                                           <input
                                             className="modern-form-input"
                                             style={{ width: '100%', fontSize: '11px', padding: '4px 8px', background: 'rgba(2,20,24,0.8)' }}
                                             placeholder="Or paste artwork image URL..."
                                             value={m.artworkUrl || ''}
                                             onChange={e => handleMatChange(idx, 'artworkUrl', e.target.value)}
                                           />
                                         </div>
                                       </div>

                                       <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                         {m.artworkUrl ? (
                                           <div
                                             onClick={() => handleOpenFullArtwork(m.artworkUrl, m.artworkFileName || `${m.name || 'Material'} Artwork`, `${m.name || 'Material'} (${currentPmCode}) — Artwork Reference`)}
                                             style={{
                                               width: '64px',
                                               height: '64px',
                                               borderRadius: '4px',
                                               border: '1px solid rgba(236,72,153,0.5)',
                                               overflow: 'hidden',
                                               background: '#000',
                                               display: 'flex',
                                               alignItems: 'center',
                                               justifyContent: 'center',
                                               cursor: 'pointer',
                                               flexShrink: 0
                                             }}
                                             title="Click to view full preview"
                                           >
                                             {isPdfArtwork(m.artworkUrl, m.artworkFileName) ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                                                  <span style={{ fontSize: '14px', fontWeight: 800 }}>PDF</span>
                                                  <span style={{ fontSize: '8.5px', color: '#cbd5e1' }}>Doc</span>
                                                </div>
                                              ) : (
                                                <img src={m.artworkUrl} alt="Artwork" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                              )}
                                           </div>
                                         ) : (
                                           <div style={{ width: '64px', height: '64px', borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', padding: '4px', flexShrink: 0 }}>
                                             No Artwork Yet
                                           </div>
                                         )}

                                         <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                           {m.artworkUrl ? (
                                             <div>
                                               <div style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                 <span>✓ Artwork Loaded</span>
                                               </div>
                                               {m.artworkFileName && (
                                                 <div style={{ fontSize: '9.5px', color: 'var(--text-main)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                   {m.artworkFileName}
                                                 </div>
                                               )}
                                               <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                                 <button
                                                   type="button"
                                                   onClick={() => materialFileInputRefs.current[idx]?.click()}
                                                   style={{
                                                     background: 'rgba(255,255,255,0.08)',
                                                     border: '1px solid rgba(255,255,255,0.18)',
                                                     color: '#cbd5e1',
                                                     padding: '3px 8px',
                                                     borderRadius: '4px',
                                                     fontSize: '10px',
                                                     fontWeight: 600,
                                                     cursor: 'pointer'
                                                   }}
                                                 >
                                                   🔄 Replace
                                                 </button>
                                                 <button
                                                   type="button"
                                                   onClick={() => handleOpenFullArtwork(m.artworkUrl, m.artworkFileName || `${m.name || 'Material'} Artwork`, `${m.name || 'Material'} (${currentPmCode}) — Artwork Reference`)}
                                                   style={{
                                                     background: 'rgba(14,165,233,0.15)',
                                                     border: '1px solid #0284c7',
                                                     color: '#38bdf8',
                                                     padding: '3px 8px',
                                                     borderRadius: '4px',
                                                     fontSize: '10px',
                                                     fontWeight: 600,
                                                     cursor: 'pointer'
                                                   }}
                                                 >
                                                   ↗ Open Full
                                                 </button>
                                                 <button
                                                   type="button"
                                                   onClick={() => handleRemoveArtwork(idx)}
                                                   style={{
                                                     background: 'rgba(239,68,68,0.15)',
                                                     border: '1px solid rgba(239,68,68,0.3)',
                                                     color: '#ef4444',
                                                     padding: '3px 8px',
                                                     borderRadius: '4px',
                                                     fontSize: '10px',
                                                     fontWeight: 700,
                                                     cursor: 'pointer'
                                                   }}
                                                 >
                                                   ✕ Remove
                                                 </button>
                                               </div>
                                             </div>
                                           ) : (
                                             <div>Upload image proof or enter URL to embed in specification sheets</div>
                                           )}
                                         </div>
                                       </div>
                                     </div>
                                   )}
                                 </div>

                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Sticky Footer Action Bar ── */}
        <div className="add-project-page-footer">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? '⏳ Saving...' : editProject ? '💾 Save Changes' : '✨ Create Project'}
          </button>
        </div>
      </form>

      {/* ── Fullscreen Artwork Lightbox Preview Modal ── */}
      {previewArtworkModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            background: 'rgba(3, 14, 18, 0.92)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isFullScreenPreview ? 0 : '20px'
          }}
          onClick={() => setPreviewArtworkModal(null)}
        >
          <div
            style={{
              maxWidth: isFullScreenPreview ? '100vw' : '95vw',
              width: isFullScreenPreview ? '100vw' : '980px',
              maxHeight: isFullScreenPreview ? '100vh' : '92vh',
              height: isFullScreenPreview ? '100vh' : 'auto',
              background: '#ffffff',
              borderRadius: isFullScreenPreview ? 0 : '12px',
              border: isFullScreenPreview ? 'none' : '1px solid #cbd5e1',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '12px 18px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span style={{ fontSize: '15px' }}>🖼️</span>
                <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previewArtworkModal.title || previewArtworkModal.name || 'Artwork Full Resolution Preview'}
                </span>
                <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '1px 8px', borderRadius: '4px', fontWeight: 700 }}>
                  Image Proof
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsFullScreenPreview(!isFullScreenPreview)}
                  style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title={isFullScreenPreview ? "Exit Fullscreen" : "Toggle Fullscreen"}
                >
                  {isFullScreenPreview ? '⤓ Window' : '⤢ Fullscreen'}
                </button>
                <a
                  href={previewArtworkModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none' }}
                  title="Open in new browser tab"
                >
                  ↗ New Tab
                </a>
                <a
                  href={previewArtworkModal.url}
                  download={previewArtworkModal.name || 'artwork.png'}
                  className="btn btn-outline btn-sm"
                  style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none' }}
                  title="Download original file"
                >
                  ⬇ Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewArtworkModal(null)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', fontSize: '16px', lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#090d16',
              minHeight: isFullScreenPreview ? 'calc(100vh - 55px)' : '480px'
            }}>
              {isPdfArtwork(previewArtworkModal.url, previewArtworkModal.name) ? (
                <iframe
                  src={previewArtworkModal.url}
                  title={previewArtworkModal.name || 'PDF Preview'}
                  style={{
                    width: '100%',
                    height: isFullScreenPreview ? 'calc(100vh - 95px)' : '75vh',
                    border: 'none',
                    borderRadius: '4px',
                    background: '#ffffff'
                  }}
                />
              ) : (
                <>
                  <img
                    src={previewArtworkModal.url}
                    alt={previewArtworkModal.name || 'Artwork Preview'}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const fallback = e.target.nextElementSibling;
                      if (fallback) fallback.style.display = 'block';
                    }}
                    style={{
                      maxWidth: '100%',
                      maxHeight: isFullScreenPreview ? 'calc(100vh - 90px)' : '78vh',
                      objectFit: 'contain',
                      borderRadius: '4px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                    }}
                  />
                  <div style={{ display: 'none', textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🖼️</div>
                    <p style={{ fontWeight: 600, fontSize: '13px', color: '#f1f5f9' }}>Artwork Preview Unavailable</p>
                    <p style={{ fontSize: '11px' }}>The artwork file could not be rendered.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
