let currentFile = null;
let extractedFiles = [];   // [{name, path, data: Uint8Array, isDir, selected}]
let folderName = '';
const MAX_SAFE_SIZE = 200 * 1024 * 1024;

//  DOM refs 
const dropzone         = document.getElementById('dropzone');
const fileInput        = document.getElementById('file-input');
const btnExtract       = document.getElementById('btn-extract');
const btnReset         = document.getElementById('btn-reset');
const btnSelectAll     = document.getElementById('btn-select-all');
const btnDeselectAll   = document.getElementById('btn-deselect-all');
const btnDlSelectedZip = document.getElementById('btn-dl-selected-zip');
const btnDlSelected    = document.getElementById('btn-dl-selected');
const fileInfo         = document.getElementById('file-info');
const fname            = document.getElementById('fname');
const fsize            = document.getElementById('fsize');
const progressWrap     = document.getElementById('progress-wrap');
const pbar             = document.getElementById('pbar');
const statusEl         = document.getElementById('status');
const treeWrap         = document.getElementById('tree-wrap');
const treeList         = document.getElementById('tree-list');
const treeCount        = document.getElementById('tree-count');
const selectedCountEl  = document.getElementById('selected-count');
const totalCountEl     = document.getElementById('total-count');
const dlSection        = document.getElementById('dl-section');
const noteUnsup        = document.getElementById('note-unsupported');
const noteLarge        = document.getElementById('note-large');
const footerYear       = document.getElementById('year');
const themeToggle      = document.getElementById('theme-toggle');
const previewModal   = document.getElementById('preview-modal');
const modalBackdrop  = document.getElementById('modal-backdrop');
const modalFilename  = document.getElementById('modal-filename');
const modalBody      = document.getElementById('modal-body');
const modalMeta      = document.getElementById('modal-meta');
const modalBtnClose  = document.getElementById('modal-btn-close');
const modalBtnDl     = document.getElementById('modal-btn-dl');
let   modalCurrentFile = null;

if (footerYear) footerYear.textContent = new Date().getFullYear();


function applyTheme(theme) {
  document.body.dataset.theme = theme;
  if (themeToggle) themeToggle.textContent = theme === 'light' ? 'Dark' : 'Light';
  try { localStorage.setItem('xtrctTheme', theme); } catch (e) {}
}

const savedTheme = (() => { try { return localStorage.getItem('xtrctTheme'); } catch (e) { return null; } })();
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    applyTheme(document.body.dataset.theme === 'light' ? 'dark' : 'light');
  });
}

dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f) loadFile(f);
});
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });

function loadFile(file) {
  currentFile = file;
  extractedFiles = [];

  fname.textContent = file.name;
  fsize.textContent = formatBytes(file.size);
  fileInfo.style.display = 'flex';

  treeWrap.style.display = 'none';
  dlSection.style.display = 'none';
  noteUnsup.classList.remove('visible');
  noteLarge.classList.remove('visible');
  noteLarge.textContent = '';
  progressWrap.style.display = 'none';

  const type = getArchiveType(file.name);
  setStatus(`Ready to extract ${type} archive.`, '');

  btnExtract.disabled = false;
  btnReset.disabled = false;

  if (file.size > MAX_SAFE_SIZE) {
    noteLarge.textContent = 'Large archive detected: extraction may be slow or memory-intensive in the browser. For files above 200 MB, a desktop tool may be more reliable.';
    noteLarge.classList.add('visible');
  }

  folderName = stripExtensions(file.name);
}

function stripExtensions(name) {
  return name
    .replace(/\.(tar\.gz|tar\.bz2|tar\.xz|tar\.zst|tar\.lz4|tgz|tbz2|txz)$/i, '')
    .replace(/\.(zip|tar|gz|bz2|xz|7z|rar|zst|lz4)$/i, '');
}

function getArchiveType(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz'))        return 'TAR.GZ';
  if (lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2'))      return 'TAR.BZ2';
  if (lower.endsWith('.tar.xz') || lower.endsWith('.txz'))        return 'TAR.XZ';
  if (lower.endsWith('.tar.zst'))                                  return 'TAR.ZST';
  if (lower.endsWith('.tar.lz4'))                                  return 'TAR.LZ4';
  if (lower.endsWith('.zip'))                                      return 'ZIP';
  if (lower.endsWith('.tar'))                                      return 'TAR';
  if (lower.endsWith('.gz'))                                       return 'GZ';
  if (lower.endsWith('.bz2'))                                      return 'BZ2';
  if (lower.endsWith('.xz'))                                       return 'XZ';
  if (lower.endsWith('.7z'))                                       return '7Z';
  if (lower.endsWith('.rar'))                                      return 'RAR';
  if (lower.endsWith('.zst'))                                      return 'ZST';
  if (lower.endsWith('.lz4'))                                      return 'LZ4';
  return 'archive';
}

// ── Extract ────────────────────────────────────────────────────────────────
btnExtract.addEventListener('click', async () => {
  if (!currentFile) return;
  btnExtract.disabled = true;
  btnReset.disabled = true;
  extractedFiles = [];
  treeWrap.style.display = 'none';
  dlSection.style.display = 'none';
  noteUnsup.classList.remove('visible');

  const name = currentFile.name.toLowerCase();

  try {
    if (name.endsWith('.zip')) {
      await extractZip(currentFile);
    } else if (
      name.endsWith('.tar.gz') || name.endsWith('.tgz') ||
      name.endsWith('.tar.bz2') || name.endsWith('.tbz2') ||
      name.endsWith('.tar.xz') || name.endsWith('.tar')
    ) {
      await extractTar(currentFile);
    } else if (name.endsWith('.gz')) {
      await extractGz(currentFile);
    } else if (name.endsWith('.bz2')) {
      await extractBz2(currentFile);
    } else if (name.endsWith('.xz')) {
      await extractXz(currentFile);
    } else if (name.endsWith('.rar')) {
      await extractRar(currentFile);
    } else if (
      name.endsWith('.7z') ||
      name.endsWith('.zst') || name.endsWith('.lz4')
    ) {
      setStatus('Format not supported in-browser.', 'error');
      noteUnsup.classList.add('visible');
      btnReset.disabled = false;
      return;
    } else {
      setStatus('Unknown or unsupported format.', 'error');
      btnReset.disabled = false;
      return;
    }

    renderTree();
    showDownloads();
    setStatus(`✓ Extracted ${extractedFiles.filter(f => !f.isDir).length} file(s) into "${folderName}/"`, 'ok');
  } catch (err) {
    setStatus('Extraction failed: ' + err.message, 'error');
    console.error(err);
  }

  btnReset.disabled = false;
});

// ── ZIP ────────────────────────────────────────────────────────────────────
async function extractZip(file) {
  showProgress(10);
  const buf = await file.arrayBuffer();
  showProgress(30);
  const zip = await JSZip.loadAsync(buf);
  showProgress(50);

  const entries = Object.values(zip.files);
  let done = 0;

  for (const entry of entries) {
    if (entry.dir) {
      extractedFiles.push({ name: entry.name, path: folderName + '/' + entry.name, isDir: true });
    } else {
      const data = await entry.async('uint8array');
      extractedFiles.push({ name: entry.name, path: folderName + '/' + entry.name, data, isDir: false, selected: true });
    }
    done++;
    showProgress(50 + Math.floor((done / entries.length) * 50));
  }
  hideProgress();
}

// ── TAR (with optional GZ/BZ2/XZ decompression via fflate) ────────────────
async function extractTar(file) {
  showProgress(10);
  let buf = new Uint8Array(await file.arrayBuffer());
  showProgress(20);

  const name = file.name.toLowerCase();

  if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
    buf = await decompressGz(buf);
  } else if (name.endsWith('.tar.bz2') || name.endsWith('.tbz2')) {
    buf = await decompressBz2(buf);
  } else if (name.endsWith('.tar.xz')) {
    buf = await decompressXz(buf);
  }

  showProgress(50);
  parseTar(buf);
  hideProgress();
}

// ── Bare .gz ───────────────────────────────────────────────────────────────
async function extractGz(file) {
  showProgress(20);
  const buf = new Uint8Array(await file.arrayBuffer());
  const out = await decompressGz(buf);
  showProgress(80);
  const outName = file.name.replace(/\.gz$/i, '');
  extractedFiles.push({ name: outName, path: folderName + '/' + outName, data: out, isDir: false, selected: true });
  hideProgress();
}

// ── Bare .bz2 ──────────────────────────────────────────────────────────────
async function extractBz2(file) {
  showProgress(20);
  const buf = new Uint8Array(await file.arrayBuffer());
  const out = await decompressBz2(buf);
  showProgress(80);
  const outName = file.name.replace(/\.bz2$/i, '');
  extractedFiles.push({ name: outName, path: folderName + '/' + outName, data: out, isDir: false, selected: true });
  hideProgress();
}

// ── Bare .xz ───────────────────────────────────────────────────────────────
async function extractXz(file) {
  showProgress(20);
  const buf = new Uint8Array(await file.arrayBuffer());
  const out = await decompressXz(buf);
  showProgress(80);
  const outName = file.name.replace(/\.xz$/i, '');
  extractedFiles.push({ name: outName, path: folderName + '/' + outName, data: out, isDir: false, selected: true });
  hideProgress();
}

// ── Decompression helpers (fflate) ─────────────────────────────────────────
function decompressGz(buf) {
  return new Promise((resolve, reject) => {
    fflate.gunzip(buf, (err, out) => err ? reject(err) : resolve(out));
  });
}

function decompressBz2(buf) {
  try {
    return Promise.resolve(fflate.bunzipSync(buf));
  } catch (e) {
    return Promise.reject(new Error('BZ2 decompression failed: ' + e.message));
  }
}

function decompressXz(buf) {
  try {
    return Promise.resolve(fflate.decompressSync(buf));
  } catch (e) {
    return Promise.reject(new Error('XZ decompression is not supported in-browser. Use the bash extract() function instead.'));
  }
}

// ── RAR (via @shelf/unrar-wasm) ────────────────────────────────────────────
async function extractRar(file) {
  if (typeof UnrarJS === 'undefined') {
    throw new Error('unrar-wasm library failed to load. Check your internet connection.');
  }

  showProgress(15);
  const buf = await file.arrayBuffer();
  showProgress(35);

  let entries;
  try {
    entries = await UnrarJS.unrar(new Uint8Array(buf));
  } catch (e) {
    throw new Error('RAR extraction failed: ' + e.message);
  }

  showProgress(70);

  for (const entry of entries) {
    const isDir = entry.name.endsWith('/') || !entry.fileContent;
    if (isDir) {
      extractedFiles.push({ name: entry.name, path: folderName + '/' + entry.name, isDir: true });
    } else {
      extractedFiles.push({
        name: entry.name,
        path: folderName + '/' + entry.name,
        data: entry.fileContent,
        isDir: false,
        selected: true
      });
    }
  }

  hideProgress();
}

// ── TAR parser ─────────────────────────────────────────────────────────────
// Format: 512-byte blocks. Header block → data blocks → next header...
function parseTar(buf) {
  let offset = 0;
  const dec = new TextDecoder();

  while (offset + 512 <= buf.length) {
    const header = buf.slice(offset, offset + 512);

    // End of archive: two zero blocks
    if (header.every(b => b === 0)) break;

    const name     = dec.decode(header.slice(0, 100)).replace(/\0/g, '');
    const sizeOct  = dec.decode(header.slice(124, 136)).replace(/\0/g, '').trim();
    const typeFlag = dec.decode(header.slice(156, 157));
    const prefix   = dec.decode(header.slice(345, 500)).replace(/\0/g, '');
    const fullName = prefix ? prefix + '/' + name : name;

    const size = parseInt(sizeOct, 8) || 0;
    offset += 512;

    const isDir = typeFlag === '5' || fullName.endsWith('/');

    if (isDir) {
      extractedFiles.push({ name: fullName, path: folderName + '/' + fullName, isDir: true });
    } else if (fullName.trim()) {
      const data = buf.slice(offset, offset + size);
      extractedFiles.push({ name: fullName, path: folderName + '/' + fullName, data, isDir: false, selected: true });
    }

    offset += Math.ceil(size / 512) * 512;
  }
}

// ── Preview helpers ─────────────────────────────────────────────────────────
function isPreviewable(name) {
  return /\.(txt|md|json|js|ts|html|css|c|h|cpp|hpp|py|sh|yml|yaml|xml|log|ini|conf|toml|rs|go|java|rb|php|swift|kt|cs)$/i.test(name);
}

function looksBinary(buf) {
  const check = buf.slice(0, 512);
  for (let i = 0; i < check.length; i++) {
    const b = check[i];
    if (b === 0 || (b < 8) || (b >= 14 && b <= 31 && b !== 27)) return true;
  }
  return false;
}

// ── Preview Modal logic ─────────────────────────────────────────────────────
function openModal(file) {
  if (!file || !file.data) return;

  modalCurrentFile = file;
  const shortName = file.name.split('/').pop();
  modalFilename.textContent = shortName;

  if (!isPreviewable(file.name)) {
    modalBody.textContent = 'Preview unavailable for this file type.';
    modalMeta.textContent = formatBytes(file.data.length);
    previewModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    return;
  }

  if (looksBinary(file.data)) {
    modalBody.textContent = 'Binary file — preview unavailable.';
    modalMeta.textContent = formatBytes(file.data.length);
    previewModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    return;
  }

  try {
    const text = new TextDecoder().decode(file.data);
    const lines = text.split('\n').length;
    modalBody.textContent = text.length > 300000
      ? text.slice(0, 300000) + '\n\n[preview truncated at 300k chars]'
      : text;
    modalMeta.textContent = `${formatBytes(file.data.length)} · ${lines} lines`;
  } catch (err) {
    modalBody.textContent = 'Unable to decode file.';
    modalMeta.textContent = '';
  }

  previewModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Focus trap: focus close button
  setTimeout(() => modalBtnClose.focus(), 50);
}

function closeModal() {
  previewModal.classList.remove('open');
  document.body.style.overflow = '';
  modalCurrentFile = null;
  // Reset scroll position
  modalBody.scrollTop = 0;
}

modalBtnClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);

modalBtnDl.addEventListener('click', () => {
  if (!modalCurrentFile?.data) return;
  const blob = new Blob([modalCurrentFile.data]);
  downloadBlob(blob, sanitizeDownloadName(modalCurrentFile.name));
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (previewModal.classList.contains('open')) { closeModal(); return; }
    if (contactModal && contactModal.style.display === 'flex') { closeContactModal(); return; }
  }
});

function previewFile(file) {
  openModal(file);
}

// ── Tree render ─────────────────────────────────────────────────────────────
function renderTree() {
  treeList.innerHTML = '';
  const files = extractedFiles.filter(f => !f.isDir);
  const dirs  = extractedFiles.filter(f => f.isDir);

  treeCount.textContent = `${files.length} FILES · ${dirs.length} DIRS`;

  // FIX: declare sorted — dirs first, then files alphabetically
  const sorted = [
    ...dirs.sort((a, b) => a.name.localeCompare(b.name)),
    ...files.sort((a, b) => a.name.localeCompare(b.name))
  ];

  for (const item of sorted) {
    const row = document.createElement('div');
    row.className = 'tree-item' + (item.isDir ? ' is-dir' : '');

    const icon = item.isDir ? '▶' : '·';
    const size = item.isDir ? '' : formatBytes(item.data?.length || 0);

    if (item.isDir) {
      row.innerHTML = `
        <span class="file-name">
          <span class="icon">${icon}</span>
          <span class="item-name">${escHtml(item.name)}</span>
        </span>
        <span class="item-size">${size}</span>
      `;
    } else {
      const escapedAttr = escAttr(item.name);
      row.innerHTML = `
        <label class="file-checkbox">
          <input type="checkbox" data-path="${escapedAttr}" ${item.selected ? 'checked' : ''}>
          <span class="checkmark" aria-hidden="true"></span>
          <span class="icon">${icon}</span>
          <span class="item-name">${escHtml(item.name)}</span>
        </label>
        <span class="item-size">${size}</span>
      `;

      // Checkbox toggle
      const checkbox = row.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', e => {
        e.stopPropagation();
        item.selected = checkbox.checked;
        updateSelectionMeta();
      });

      // FIX: click on row (not checkbox) triggers preview
      row.addEventListener('click', e => {
        if (e.target.matches('input[type="checkbox"]') || e.target.matches('.checkmark')) return;
        // Highlight active row
        document.querySelectorAll('.tree-item.preview-active').forEach(el => el.classList.remove('preview-active'));
        row.classList.add('preview-active');
        previewFile(item);
      });
    }

    treeList.appendChild(row);
  }

  treeWrap.style.display = 'block';
  updateSelectionMeta();
}

// ── Selection state ─────────────────────────────────────────────────────────
function updateSelectionMeta() {
  const files    = extractedFiles.filter(f => !f.isDir);
  const selected = files.filter(f => f.selected).length;

  selectedCountEl.textContent = selected;
  totalCountEl.textContent    = files.length;

  const active = selected > 0;
  btnDlSelectedZip.disabled = !active;
  btnDlSelected.disabled    = !active;
  btnDeselectAll.disabled   = files.length === 0 || selected === 0;
  btnSelectAll.disabled     = files.length === selected;

  if (!active && files.length > 0) {
    setStatus('Choose files to download from the list above.', '');
  }
}

btnSelectAll.addEventListener('click', () => {
  extractedFiles.forEach(f => { if (!f.isDir) f.selected = true; });
  renderTree();
});

btnDeselectAll.addEventListener('click', () => {
  extractedFiles.forEach(f => { if (!f.isDir) f.selected = false; });
  renderTree();
});

// ── Download ────────────────────────────────────────────────────────────────
btnDlSelectedZip.addEventListener('click', async () => {
  const files = extractedFiles.filter(f => !f.isDir && f.data && f.selected);
  if (!files.length) return;

  btnDlSelectedZip.disabled = true;
  btnDlSelectedZip.textContent = '⏳ Packing...';

  const zip = new JSZip();
  const folder = zip.folder(folderName);
  for (const f of files) folder.file(f.name, f.data);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  downloadBlob(blob, `${folderName}-selected.zip`);

  btnDlSelectedZip.disabled = false;
  btnDlSelectedZip.textContent = '↓ Selected ZIP';
});

btnDlSelected.addEventListener('click', async () => {
  const files = extractedFiles.filter(f => !f.isDir && f.data && f.selected);
  if (!files.length) return;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const blob = new Blob([f.data]);
    const safeName = sanitizeDownloadName(f.name);
    setTimeout(() => downloadBlob(blob, safeName), i * 120);
  }

  setStatus(`↓ Downloading ${files.length} file(s)...`, 'ok');
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function sanitizeDownloadName(name) {
  return name.replace(/[\\/]/g, '_');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function showDownloads() { dlSection.style.display = 'flex'; }

function showProgress(pct) {
  progressWrap.style.display = 'block';
  pbar.style.width = pct + '%';
}

function hideProgress() {
  setTimeout(() => {
    progressWrap.style.display = 'none';
    pbar.style.width = '0%';
  }, 400);
}

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = type;
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatBytes(b) {
  if (b < 1024)             return b + ' B';
  if (b < 1024 * 1024)      return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Reset ───────────────────────────────────────────────────────────────────
btnReset.addEventListener('click', () => {
  currentFile = null;
  extractedFiles = [];
  folderName = '';
  fileInput.value = '';
  fileInfo.style.display = 'none';
  treeWrap.style.display = 'none';
  dlSection.style.display = 'none';
  progressWrap.style.display = 'none';
  noteUnsup.classList.remove('visible');
  noteLarge.classList.remove('visible');
  noteLarge.textContent = '';
  closeModal();
  setStatus('');
  btnExtract.disabled = true;
  btnReset.disabled = true;
});

// ── Contact Modal ───────────────────────────────────────────────────────────
const contactToggle = document.getElementById('contact-toggle');
const contactModal = document.getElementById('contact-modal');
const contactBackdrop = document.getElementById('contact-backdrop');
const contactBtnClose = document.getElementById('contact-btn-close');

let contactPreviouslyFocused = null;
let contactFocusTrapHandler = null;

function openContactModal() {
  if (!contactModal || !contactBackdrop) return;
  contactPreviouslyFocused = document.activeElement;
  contactModal.style.display = 'flex';
  contactBackdrop.style.display = 'block';
  if (contactToggle) contactToggle.setAttribute('aria-expanded', 'true');

  // Move focus into the dialog
  setTimeout(() => contactBtnClose?.focus(), 50);

  // Basic focus trap and ESC handler
  contactFocusTrapHandler = function(e) {
    if (e.key === 'Escape') {
      closeContactModal();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = contactModal.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
      const list = Array.prototype.slice.call(focusable).filter(el => el.offsetParent !== null);
      if (list.length === 0) { e.preventDefault(); return; }
      const idx = list.indexOf(document.activeElement);
      if (e.shiftKey) {
        if (idx === 0) { list[list.length - 1].focus(); e.preventDefault(); }
      } else {
        if (idx === list.length - 1) { list[0].focus(); e.preventDefault(); }
      }
    }
  };

  document.addEventListener('keydown', contactFocusTrapHandler);
}

function closeContactModal() {
  if (!contactModal || !contactBackdrop) return;
  contactModal.style.display = 'none';
  contactBackdrop.style.display = 'none';
  if (contactToggle) contactToggle.setAttribute('aria-expanded', 'false');

  if (contactFocusTrapHandler) {
    document.removeEventListener('keydown', contactFocusTrapHandler);
    contactFocusTrapHandler = null;
  }

  if (contactPreviouslyFocused && typeof contactPreviouslyFocused.focus === 'function') {
    contactPreviouslyFocused.focus();
    contactPreviouslyFocused = null;
  }
}

if (contactToggle) {
  contactToggle.addEventListener('click', openContactModal);
}

if (contactBtnClose) {
  contactBtnClose.addEventListener('click', closeContactModal);
}

if (contactBackdrop) {
  contactBackdrop.addEventListener('click', closeContactModal);
}

// Close when clicking the container (click outside content)
if (contactModal) {
  contactModal.addEventListener('click', (e) => {
    if (e.target === contactModal) closeContactModal();
  });
}

//* Contact form handler */

emailjs.init("ThPXSY2EtDHTs4kmd");

const contactForm = document.getElementById("contact-form");

if (contactForm) {

  contactForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    try {

      console.log([...new FormData(contactForm)]);

      await emailjs.sendForm(
        "service_t7hwgqv",
        "template_eqvcv6e",
        contactForm
      );

      alert("Message sent successfully!");

      contactForm.reset();

      closeContactModal();

    } catch (error) {

      console.error(error);

      alert("Failed to send message.");

    }

  });

}