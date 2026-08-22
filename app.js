const STORAGE_KEY = 'prompt-library';
const NOTES_KEY = 'prompt-notes';

const form = document.getElementById('prompt-form');
const titleInput = document.getElementById('title');
const modelInput = document.getElementById('model');
const contentInput = document.getElementById('content');
const grid = document.getElementById('prompt-grid');
const emptyState = document.getElementById('empty-state');
const countBadge = document.getElementById('count');
const modal = document.getElementById('prompt-modal');
const modalDialog = modal.querySelector('.modal-dialog');
const modalTitle = document.getElementById('modal-title');
const modalMeta = document.getElementById('modal-meta');
const modalContent = document.getElementById('modal-content');
const modalNotesList = document.getElementById('modal-notes-list');
const modalNoteInput = document.getElementById('modal-note-input');
const modalNoteCount = document.getElementById('modal-note-count');
const copyBtn = document.getElementById('copy-btn');

// ── Metadata ──────────────────────────────────────────────────────────────────

function estimateTokens(text, isCode) {
  if (typeof text !== 'string') throw new Error('estimateTokens: text must be a string');
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  let min = Math.round(0.75 * wordCount);
  let max = Math.round(0.25 * charCount);
  if (isCode) {
    min = Math.round(min * 1.3);
    max = Math.round(max * 1.3);
  }
  const confidence = max < 1000 ? 'high' : max <= 5000 ? 'medium' : 'low';
  return { min, max, confidence };
}

function trackModel(modelName, content) {
  if (typeof modelName !== 'string' || modelName.trim().length === 0) {
    throw new Error('trackModel: modelName must be a non-empty string');
  }
  if (modelName.trim().length > 100) {
    throw new Error('trackModel: modelName must be 100 characters or fewer');
  }
  const now = new Date().toISOString();
  const tokenEstimate = estimateTokens(content, false);
  return { model: modelName.trim(), createdAt: now, updatedAt: now, tokenEstimate };
}

function updateTimestamps(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('updateTimestamps: metadata must be an object');
  }
  if (!metadata.createdAt || isNaN(Date.parse(metadata.createdAt))) {
    throw new Error('updateTimestamps: createdAt must be a valid ISO 8601 string');
  }
  const now = new Date().toISOString();
  if (now < metadata.createdAt) {
    throw new Error('updateTimestamps: updatedAt cannot be before createdAt');
  }
  return { ...metadata, updatedAt: now };
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function loadPrompts() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function savePrompts(prompts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

function renderPrompts() {
  const prompts = loadPrompts();
  prompts.sort((a, b) => {
    const aTime = a.metadata ? new Date(a.metadata.createdAt).getTime() : a.id;
    const bTime = b.metadata ? new Date(b.metadata.createdAt).getTime() : b.id;
    return bTime - aTime;
  });
  grid.innerHTML = '';

  countBadge.textContent = prompts.length;
  emptyState.classList.toggle('hidden', prompts.length > 0);

  prompts.forEach((prompt) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = prompt.id;
    card.tabIndex = 0;
    const promptNotes = loadNotes()[prompt.id] || [];
    const meta = prompt.metadata;
    const metaHtml = meta ? `
      <div class="card-meta">
        <span class="meta-model">${escapeHtml(meta.model)}</span>
        <div class="meta-timestamps">
          <span class="meta-time">Created ${formatDate(meta.createdAt)}</span>
          ${meta.updatedAt !== meta.createdAt ? `<span class="meta-time">Updated ${formatDate(meta.updatedAt)}</span>` : ''}
        </div>
        <span class="token-badge confidence-${meta.tokenEstimate.confidence}">~${meta.tokenEstimate.min}&ndash;${meta.tokenEstimate.max} tokens</span>
      </div>` : '';
    card.innerHTML = `
      <div class="card-title">${escapeHtml(prompt.title)}</div>
      <div class="card-preview">${escapeHtml(prompt.content)}</div>
      ${metaHtml}
      <div class="stars" data-id="${prompt.id}">${renderStars(prompt.id, prompt.rating || 0)}</div>
      <details class="notes-panel" data-prompt-id="${prompt.id}">
        <summary class="notes-toggle">Notes <span class="note-count" data-notes-count="${prompt.id}">${promptNotes.length || ''}</span></summary>
        <div class="notes-body">
          <div class="notes-list" data-prompt-id="${prompt.id}">${renderNoteItems(promptNotes, prompt.id)}</div>
          <textarea class="note-input" data-prompt-id="${prompt.id}" placeholder="Add a note... (Enter to save)"></textarea>
        </div>
      </details>
      <div class="card-footer">
        <button class="delete-btn" data-id="${prompt.id}">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderStars(promptId, rating) {
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < rating ? 'filled' : '';
    return `<span class="star ${filled}" data-id="${promptId}" data-value="${i + 1}">★</span>`;
  }).join('');
}

function setRating(promptId, value) {
  const prompts = loadPrompts();
  const prompt = prompts.find((p) => p.id === promptId);
  if (!prompt) return;
  prompt.rating = prompt.rating === value ? 0 : value;
  if (prompt.metadata) {
    try {
      prompt.metadata = updateTimestamps(prompt.metadata);
    } catch (err) {
      console.error('Timestamp update error:', err.message);
    }
  }
  savePrompts(prompts);
  renderPrompts();
}

function loadNotes() {
  return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
}

function saveNotes(notes) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

function renderNoteItems(notes, promptId) {
  return notes.map(note => `
    <div class="note-item" data-note-id="${note.id}" data-prompt-id="${promptId}">
      <div class="note-item-body">
        <span class="note-text">${escapeHtml(note.text)}</span>
        <span class="note-time">Saved ${timeAgo(note.savedAt)}</span>
      </div>
      <button class="note-delete-btn" data-note-id="${note.id}" data-prompt-id="${promptId}">×</button>
    </div>
  `).join('');
}

function updateNotesPanel(promptId) {
  const notes = loadNotes()[promptId] || [];
  document.querySelectorAll(`.notes-list[data-prompt-id="${promptId}"]`).forEach((list) => {
    list.innerHTML = renderNoteItems(notes, promptId);
  });
  document.querySelectorAll(`[data-notes-count="${promptId}"]`).forEach((badge) => {
    badge.textContent = notes.length || '';
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const model = modelInput.value.trim();
  const content = contentInput.value.trim();
  if (!title || !model || !content) return;

  let metadata = null;
  try {
    metadata = trackModel(model, content);
  } catch (err) {
    console.error('Metadata error:', err.message);
  }

  const prompts = loadPrompts();
  prompts.unshift({ id: Date.now(), title, content, rating: 0, metadata });
  savePrompts(prompts);
  renderPrompts();

  titleInput.value = '';
  modelInput.value = '';
  contentInput.value = '';
  titleInput.focus();
});

// ── Note interactions (shared by the grid cards and the modal) ────────────────

function handleNotesClick(e) {
  const noteDeleteBtn = e.target.closest('.note-delete-btn');
  if (noteDeleteBtn) {
    const { noteId, promptId } = noteDeleteBtn.dataset;
    const notes = loadNotes();
    notes[promptId] = (notes[promptId] || []).filter((n) => String(n.id) !== noteId);
    saveNotes(notes);
    updateNotesPanel(promptId);
    return true;
  }

  const noteText = e.target.closest('.note-text');
  if (noteText) {
    const item = noteText.closest('.note-item');
    const { noteId, promptId } = item.dataset;
    const notes = loadNotes();
    const note = (notes[promptId] || []).find((n) => String(n.id) === noteId);
    if (!note) return true;
    const textarea = document.createElement('textarea');
    textarea.className = 'note-edit-input';
    textarea.value = note.text;
    textarea.dataset.noteId = noteId;
    textarea.dataset.promptId = promptId;
    item.replaceWith(textarea);
    textarea.focus();
    return true;
  }

  return false;
}

function handleNotesKeydown(e) {
  const noteInput = e.target.closest('.note-input');
  if (!noteInput || e.key !== 'Enter' || e.shiftKey) return false;
  e.preventDefault();
  const text = noteInput.value.trim();
  if (!text) return true;
  const promptId = noteInput.dataset.promptId;
  const notes = loadNotes();
  if (!notes[promptId]) notes[promptId] = [];
  notes[promptId].push({ id: String(Date.now()), text, savedAt: Date.now() });
  saveNotes(notes);
  noteInput.value = '';
  updateNotesPanel(promptId);
  return true;
}

function handleNotesFocusout(e) {
  const editInput = e.target.closest('.note-edit-input');
  if (!editInput) return;
  const { noteId, promptId } = editInput.dataset;
  const text = editInput.value.trim();
  const notes = loadNotes();
  const noteIndex = (notes[promptId] || []).findIndex((n) => String(n.id) === noteId);
  if (noteIndex !== -1) {
    if (text) {
      notes[promptId][noteIndex].text = text;
      notes[promptId][noteIndex].savedAt = Date.now();
    } else {
      notes[promptId].splice(noteIndex, 1);
    }
    saveNotes(notes);
  }
  updateNotesPanel(promptId);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

const modalBody = modal.querySelector('.modal-body');

let openPromptId = null;
let lastFocused = null;
let copyResetTimer = null;

function openModal(promptId) {
  const prompt = loadPrompts().find((p) => p.id === promptId);
  if (!prompt) return;

  openPromptId = promptId;
  lastFocused = document.activeElement;

  modalTitle.textContent = prompt.title;
  // textContent, not innerHTML: the prompt is user text and must render verbatim
  modalContent.textContent = prompt.content;

  const meta = prompt.metadata;
  modalMeta.innerHTML = meta ? `
    <span class="meta-model">${escapeHtml(meta.model)}</span>
    <span class="meta-time">Created ${formatDate(meta.createdAt)}</span>
    ${meta.updatedAt !== meta.createdAt ? `<span class="meta-time">Updated ${formatDate(meta.updatedAt)}</span>` : ''}
    <span class="token-badge confidence-${meta.tokenEstimate.confidence}">~${meta.tokenEstimate.min}&ndash;${meta.tokenEstimate.max} tokens</span>
  ` : '';

  modalNotesList.dataset.promptId = promptId;
  modalNoteCount.dataset.notesCount = promptId;
  modalNoteInput.dataset.promptId = promptId;
  modalNoteInput.value = '';
  updateNotesPanel(promptId);

  resetCopyButton();
  modal.hidden = false;
  document.body.classList.add('modal-open');
  // long prompts open at the top, never mid-scroll from the previously opened one
  modalBody.scrollTop = 0;
  modalContent.scrollTop = 0;
  modalDialog.focus();
}

function closeModal() {
  if (modal.hidden) return;
  modal.hidden = true;
  openPromptId = null;
  document.body.classList.remove('modal-open');
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  lastFocused = null;
}

function resetCopyButton() {
  clearTimeout(copyResetTimer);
  copyBtn.textContent = 'Copy prompt';
  copyBtn.classList.remove('copied', 'failed');
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // the clipboard API needs a secure context; fall back for file:// and old browsers
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.top = '-1000px';
    document.body.appendChild(helper);
    helper.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (fallbackErr) {
      copied = false;
    }
    helper.remove();
    return copied;
  }
}

function selectPromptText() {
  const range = document.createRange();
  range.selectNodeContents(modalContent);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

copyBtn.addEventListener('click', async () => {
  const copied = await copyToClipboard(modalContent.textContent);
  clearTimeout(copyResetTimer);
  copyBtn.textContent = copied ? 'Copied' : 'Selected — press Ctrl+C';
  copyBtn.classList.toggle('copied', copied);
  copyBtn.classList.toggle('failed', !copied);
  if (!copied) selectPromptText();
  copyResetTimer = setTimeout(resetCopyButton, 2000);
});

modal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) {
    closeModal();
    return;
  }
  handleNotesClick(e);
});

modal.addEventListener('keydown', handleNotesKeydown);
modal.addEventListener('focusout', handleNotesFocusout);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ── Grid interactions ─────────────────────────────────────────────────────────

grid.addEventListener('click', (e) => {
  const star = e.target.closest('.star');
  if (star) {
    setRating(Number(star.dataset.id), Number(star.dataset.value));
    return;
  }

  if (handleNotesClick(e)) return;

  const btn = e.target.closest('.delete-btn');
  if (btn) {
    const id = Number(btn.dataset.id);
    const prompts = loadPrompts().filter((p) => p.id !== id);
    savePrompts(prompts);
    renderPrompts();
    if (openPromptId === id) closeModal();
    return;
  }

  // anywhere else on the card opens the prompt for reading
  const card = e.target.closest('.card');
  if (card && !e.target.closest('.stars, .notes-panel, .card-footer')) {
    openModal(Number(card.dataset.id));
  }
});

grid.addEventListener('keydown', (e) => {
  if (handleNotesKeydown(e)) return;
  if (e.key === 'Enter' && e.target.classList.contains('card')) {
    e.preventDefault();
    openModal(Number(e.target.dataset.id));
  }
});

grid.addEventListener('focusout', handleNotesFocusout);

grid.addEventListener('mouseover', (e) => {
  const star = e.target.closest('.star');
  if (!star) return;
  const value = Number(star.dataset.value);
  const row = star.closest('.stars');
  row.querySelectorAll('.star').forEach((s, i) => {
    s.classList.toggle('hover', i < value);
  });
});

grid.addEventListener('mouseleave', () => {
  grid.querySelectorAll('.star.hover').forEach((s) => s.classList.remove('hover'));
}, true);

renderPrompts();
