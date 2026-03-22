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
      <div class="stars" data-id="${prompt.id}">${renderStars(prompt.id, prompt.rating || 0)}</div>
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
  savePrompts(prompts);
  renderPrompts();
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
  prompts.unshift({ id: Date.now(), title, content, rating: 0 });
  savePrompts(prompts);
  renderPrompts();

  titleInput.value = '';
  contentInput.value = '';
  titleInput.focus();
});

grid.addEventListener('click', (e) => {
  const star = e.target.closest('.star');
  if (star) {
    setRating(Number(star.dataset.id), Number(star.dataset.value));
    return;
  }

  const btn = e.target.closest('.delete-btn');
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const prompts = loadPrompts().filter((p) => p.id !== id);
  savePrompts(prompts);
  renderPrompts();
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
