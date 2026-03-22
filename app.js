const STORAGE_KEY = 'prompt-library';

const form = document.getElementById('prompt-form');
const titleInput = document.getElementById('title');
const contentInput = document.getElementById('content');
const grid = document.getElementById('prompt-grid');
const emptyState = document.getElementById('empty-state');
const countBadge = document.getElementById('count');

function loadPrompts() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function savePrompts(prompts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

function renderPrompts() {
  const prompts = loadPrompts();
  grid.innerHTML = '';

  countBadge.textContent = prompts.length;
  emptyState.classList.toggle('hidden', prompts.length > 0);

  prompts.forEach((prompt) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-title">${escapeHtml(prompt.title)}</div>
      <div class="card-preview">${escapeHtml(prompt.content)}</div>
      <div class="card-footer">
        <button class="delete-btn" data-id="${prompt.id}">Delete</button>
      </div>
    `;
    grid.appendChild(card);
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
  const content = contentInput.value.trim();
  if (!title || !content) return;

  const prompts = loadPrompts();
  prompts.unshift({ id: Date.now(), title, content });
  savePrompts(prompts);
  renderPrompts();

  titleInput.value = '';
  contentInput.value = '';
  titleInput.focus();
});

grid.addEventListener('click', (e) => {
  const btn = e.target.closest('.delete-btn');
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const prompts = loadPrompts().filter((p) => p.id !== id);
  savePrompts(prompts);
  renderPrompts();
});

renderPrompts();
