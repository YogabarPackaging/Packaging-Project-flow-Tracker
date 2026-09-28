const fs = require('fs');
const path = require('path');

const UPLOADS_ROOT = path.join(__dirname, '../uploads');
const ARTWORKS_DIR = path.join(UPLOADS_ROOT, 'artworks');
const DOCUMENTS_DIR = path.join(UPLOADS_ROOT, 'documents');

// Ensure upload directories exist
[UPLOADS_ROOT, ARTWORKS_DIR, DOCUMENTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Persists a base64 DataURL to disk and returns a lightweight URL.
 * If the URL is already an HTTP URL or local /api/uploads path, returns it unchanged.
 *
 * @param {object} fileObj - { name, url, type, size }
 * @param {string} prefixCode - Prefix like AW-OAT-500-01
 * @param {string} subfolder - 'artworks' | 'documents'
 * @returns {object} Updated fileObj with url set to `/api/uploads/${subfolder}/${filename}`
 */
function persistDataUrlFile(fileObj, prefixCode = 'AW', subfolder = 'artworks') {
  if (!fileObj || typeof fileObj !== 'object') return fileObj;
  const url = fileObj.url;
  if (!url || typeof url !== 'string' || !url.startsWith('data:')) {
    return fileObj;
  }

  try {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return fileObj;

    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Determine extension
    let ext = '.bin';
    if (mimeType.includes('pdf')) ext = '.pdf';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
    else if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('svg')) ext = '.svg';
    else if (mimeType.includes('bmp')) ext = '.bmp';
    else if (mimeType.includes('tiff') || mimeType.includes('tif')) ext = '.tiff';
    else if (fileObj.name && fileObj.name.includes('.')) {
      ext = '.' + fileObj.name.split('.').pop();
    }

    const cleanOrigName = (fileObj.name || 'file')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.[^/.]+$/, '');
    const safePrefix = (prefixCode || 'AW').replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = subfolder === 'documents' ? DOCUMENTS_DIR : ARTWORKS_DIR;
    const filename = `${safePrefix}_${Date.now()}_${cleanOrigName}${ext}`;
    const filePath = path.join(targetDir, filename);

    fs.writeFileSync(filePath, buffer);

    return {
      ...fileObj,
      url: `/api/uploads/${subfolder}/${filename}`,
      size: buffer.length,
      type: mimeType
    };
  } catch (err) {
    console.error('[UploadStorageService] Failed to persist base64 data to disk:', err);
    return fileObj;
  }
}

/**
 * Persists an array of artwork file objects.
 */
function persistArtworkFiles(files, prefixCode = 'AW') {
  if (!Array.isArray(files)) return [];
  return files.map(f => persistDataUrlFile(f, prefixCode, 'artworks'));
}

/**
 * Persists all artwork and spec sheet data URLs across a material object.
 */
function persistMaterialFiles(material, defaultPrefix = 'AW') {
  if (!material || typeof material !== 'object') return material;
  const pmCode = material.pmCode || 'PM';
  const awCode = material.artworkCode || `AW-${pmCode}`;

  // 1. Clean artworkFiles array
  if (Array.isArray(material.artworkFiles)) {
    material.artworkFiles = persistArtworkFiles(material.artworkFiles, awCode);
    if (material.artworkFiles.length > 0 && material.artworkFiles[0].url) {
      material.artworkUrl = material.artworkFiles[0].url;
      material.artworkFileName = material.artworkFiles[0].name;
    }
  }

  // 2. Clean single artworkUrl if it's a data URL
  if (material.artworkUrl && typeof material.artworkUrl === 'string' && material.artworkUrl.startsWith('data:')) {
    const singleObj = persistDataUrlFile({
      name: material.artworkFileName || `${awCode}_Artwork`,
      url: material.artworkUrl
    }, awCode, 'artworks');
    material.artworkUrl = singleObj.url;
    material.artworkFileName = singleObj.name;
    if (!Array.isArray(material.artworkFiles) || material.artworkFiles.length === 0) {
      material.artworkFiles = [singleObj];
    }
  }

  // 3. Clean variant artworks
  if (Array.isArray(material.variants)) {
    material.variants = material.variants.map((v, vIdx) => {
      if (!v) return v;
      let varObj = { ...v };
      const vAwCode = varObj.artworkCode || `${awCode}-V${vIdx + 1}`;
      if (Array.isArray(varObj.artworkFiles)) {
        varObj.artworkFiles = persistArtworkFiles(varObj.artworkFiles, vAwCode);
        if (varObj.artworkFiles.length > 0 && varObj.artworkFiles[0].url) {
          varObj.artworkUrl = varObj.artworkFiles[0].url;
          varObj.artworkFileName = varObj.artworkFiles[0].name;
        }
      }
      if (varObj.artworkUrl && typeof varObj.artworkUrl === 'string' && varObj.artworkUrl.startsWith('data:')) {
        const vSaved = persistDataUrlFile({
          name: varObj.artworkFileName || `${vAwCode}_Artwork`,
          url: varObj.artworkUrl
        }, vAwCode, 'artworks');
        varObj.artworkUrl = vSaved.url;
        varObj.artworkFileName = vSaved.name;
      }
      return varObj;
    });
  }

  // 4. Clean specSheet embedded files & source PDF
  if (material.specSheet && typeof material.specSheet === 'object') {
    if (Array.isArray(material.specSheet.artworkFiles)) {
      material.specSheet.artworkFiles = persistArtworkFiles(material.specSheet.artworkFiles, awCode);
    }
    if (material.specSheet.sourcePdfData && typeof material.specSheet.sourcePdfData === 'string' && material.specSheet.sourcePdfData.startsWith('data:')) {
      const pdfSaved = persistDataUrlFile({
        name: `${pmCode}_Spec_Sheet.pdf`,
        url: material.specSheet.sourcePdfData,
        type: 'application/pdf'
      }, pmCode, 'documents');
      material.specSheet.sourcePdfUrl = pdfSaved.url;
      material.specSheet.sourcePdfData = ''; // Clear heavy base64
    }
  }

  return material;
}

module.exports = {
  persistDataUrlFile,
  persistArtworkFiles,
  persistMaterialFiles,
  UPLOADS_ROOT,
  ARTWORKS_DIR,
  DOCUMENTS_DIR
};
