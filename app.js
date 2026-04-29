const STORAGE_KEY = 'prompt-library';
const NOTES_KEY = 'prompt-notes';

const form = document.getElementById('prompt-form');
const titleInput = document.getElementById('title');
const modelInput = document.getElementById('model');
const contentInput = document.getElementById('content');
const grid = document.getElementById('prompt-grid');
const emptyState = document.getElementById('empty-state');
const countBadge = document.getElementById('count');

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
        <summary class="notes-toggle">Notes <span class="note-count">${promptNotes.length || ''}</span></summary>
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
  const notesListEl = grid.querySelector(`.notes-list[data-prompt-id="${promptId}"]`);
  const countEl = grid.querySelector(`.notes-panel[data-prompt-id="${promptId}"] .note-count`);
  if (!notesListEl) return;
  const notes = loadNotes()[promptId] || [];
  notesListEl.innerHTML = renderNoteItems(notes, promptId);
  if (countEl) countEl.textContent = notes.length || '';
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

grid.addEventListener('click', (e) => {
  const star = e.target.closest('.star');
  if (star) {
    setRating(Number(star.dataset.id), Number(star.dataset.value));
    return;
  }

  const noteDeleteBtn = e.target.closest('.note-delete-btn');
  if (noteDeleteBtn) {
    const { noteId, promptId } = noteDeleteBtn.dataset;
    const notes = loadNotes();
    notes[promptId] = (notes[promptId] || []).filter((n) => String(n.id) !== noteId);
    saveNotes(notes);
    updateNotesPanel(promptId);
    return;
  }

  const noteText = e.target.closest('.note-text');
  if (noteText) {
    const item = noteText.closest('.note-item');
    const { noteId, promptId } = item.dataset;
    const notes = loadNotes();
    const note = (notes[promptId] || []).find((n) => String(n.id) === noteId);
    if (!note) return;
    const textarea = document.createElement('textarea');
    textarea.className = 'note-edit-input';
    textarea.value = note.text;
    textarea.dataset.noteId = noteId;
    textarea.dataset.promptId = promptId;
    item.replaceWith(textarea);
    textarea.focus();
    return;
  }

  const btn = e.target.closest('.delete-btn');
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const prompts = loadPrompts().filter((p) => p.id !== id);
  savePrompts(prompts);
  renderPrompts();
});

grid.addEventListener('keydown', (e) => {
  const noteInput = e.target.closest('.note-input');
  if (noteInput && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = noteInput.value.trim();
    if (!text) return;
    const promptId = noteInput.dataset.promptId;
    const notes = loadNotes();
    if (!notes[promptId]) notes[promptId] = [];
    notes[promptId].push({ id: String(Date.now()), text, savedAt: Date.now() });
    saveNotes(notes);
    noteInput.value = '';
    updateNotesPanel(promptId);
  }
});

grid.addEventListener('focusout', (e) => {
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
});

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
