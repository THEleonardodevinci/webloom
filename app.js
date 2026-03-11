const STORAGE_KEY = 'webloom-state-v1';

const state = loadState();
const blockTypes = [
  {
    type: 'hero',
    label: 'Hero section',
    create: () => ({
      type: 'hero',
      heading: 'Welcome to your website',
      body: 'Drag, drop, and edit this content.',
    }),
    render: (block) => `<h2>${escapeHtml(block.heading)}</h2><p>${escapeHtml(block.body)}</p>`,
  },
  {
    type: 'text',
    label: 'Text block',
    create: () => ({ type: 'text', body: 'Write something great here.' }),
    render: (block) => `<p>${escapeHtml(block.body)}</p>`,
  },
  {
    type: 'image',
    label: 'Image placeholder',
    create: () => ({
      type: 'image',
      src: 'https://placehold.co/900x450?text=Your+Image',
      alt: 'Placeholder image',
    }),
    render: (block) => `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" />`,
  },
  {
    type: 'cta',
    label: 'Button block',
    create: () => ({ type: 'cta', text: 'Click me', href: '#' }),
    render: (block) => `<a href="${escapeHtml(block.href)}"><button>${escapeHtml(block.text)}</button></a>`,
  },
];

const authView = document.getElementById('auth-view');
const siteSetupView = document.getElementById('site-setup-view');
const builderView = document.getElementById('builder-view');
const authStatus = document.getElementById('auth-status');
const setupStatus = document.getElementById('setup-status');
const saveStatus = document.getElementById('save-status');
const pageList = document.getElementById('page-list');
const canvas = document.getElementById('canvas');
const canvasPageTitle = document.getElementById('canvas-page-title');
const activeSiteTitle = document.getElementById('active-site-title');

let autosaveTimer;
let dragType = null;

init();

function init() {
  bindAuth();
  bindSetup();
  bindBuilderControls();
  renderPalette();
  route();
}

function bindAuth() {
  const form = document.getElementById('email-auth-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const mode = event.submitter?.dataset.mode;
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    if (!email || password.length < 6) {
      authStatus.textContent = 'Use a valid email and password (6+ chars).';
      return;
    }

    if (mode === 'signup') {
      state.user = { email, provider: 'email' };
      authStatus.textContent = 'Account created. Continue to set up your site.';
    } else {
      state.user = { email, provider: 'email' };
      authStatus.textContent = 'Logged in successfully.';
    }

    saveNow();
    route();
  });

  document.getElementById('google-login').addEventListener('click', () => {
    state.user = { email: 'google-user@example.com', provider: 'google' };
    authStatus.textContent = 'Google sign-in simulated for prototype.';
    saveNow();
    route();
  });
}

function bindSetup() {
  document.querySelectorAll('.template').forEach((button) => {
    button.addEventListener('click', () => {
      const siteName = document.getElementById('site-name').value.trim() || 'My Webloom Site';
      const template = button.dataset.template;
      state.site = createSite(siteName, template);
      state.activePageId = state.site.pages[0].id;
      setupStatus.textContent = `Created ${template} site.`;
      saveNow();
      route();
      renderBuilder();
    });
  });
}

function bindBuilderControls() {
  document.getElementById('add-page-btn').addEventListener('click', () => {
    const pageName = prompt('Page name');
    if (!pageName) return;
    const newPage = { id: crypto.randomUUID(), name: pageName, blocks: [] };
    state.site.pages.push(newPage);
    state.activePageId = newPage.id;
    scheduleSave();
    renderBuilder();
  });

  document.getElementById('preview-btn').addEventListener('click', () => {
    const previewWindow = window.open('about:blank', '_blank');
    if (!previewWindow) return;
    previewWindow.document.write(renderPreviewHtml(state.site));
    previewWindow.document.close();
  });

  document.getElementById('publish-btn').addEventListener('click', () => {
    alert('Publishing scaffolding is ready. Domain linking and deployment flow are coming soon.');
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    state.user = null;
    state.activePageId = null;
    saveNow();
    route();
  });

  canvas.addEventListener('dragover', (event) => {
    event.preventDefault();
    canvas.classList.add('drag-target');
  });

  canvas.addEventListener('dragleave', () => canvas.classList.remove('drag-target'));

  canvas.addEventListener('drop', (event) => {
    event.preventDefault();
    canvas.classList.remove('drag-target');
    if (!dragType) return;
    const blockDef = blockTypes.find((item) => item.type === dragType);
    const page = getActivePage();
    if (!blockDef || !page) return;
    page.blocks.push({ id: crypto.randomUUID(), ...blockDef.create() });
    dragType = null;
    scheduleSave();
    renderCanvas();
  });
}

function renderPalette() {
  const palette = document.getElementById('block-palette');
  palette.innerHTML = '';
  blockTypes.forEach((block) => {
    const element = document.createElement('div');
    element.className = 'palette-block';
    element.draggable = true;
    element.textContent = block.label;
    element.addEventListener('dragstart', () => {
      dragType = block.type;
    });
    palette.appendChild(element);
  });
}

function route() {
  authView.classList.toggle('hidden', Boolean(state.user));
  siteSetupView.classList.toggle('hidden', !state.user || Boolean(state.site));
  builderView.classList.toggle('hidden', !state.user || !state.site);
  if (state.user && state.site) renderBuilder();
}

function renderBuilder() {
  activeSiteTitle.textContent = `${state.site.name} (${state.user.provider})`;
  renderPageList();
  renderCanvas();
}

function renderPageList() {
  pageList.innerHTML = '';
  state.site.pages.forEach((page) => {
    const item = document.createElement('li');
    item.className = `page-item ${state.activePageId === page.id ? 'active' : ''}`;

    const selector = document.createElement('button');
    selector.className = 'secondary';
    selector.textContent = page.name;
    selector.addEventListener('click', () => {
      state.activePageId = page.id;
      scheduleSave();
      renderBuilder();
    });

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.title = 'Delete page';
    removeBtn.addEventListener('click', () => {
      if (state.site.pages.length === 1) return;
      state.site.pages = state.site.pages.filter((p) => p.id !== page.id);
      if (state.activePageId === page.id) {
        state.activePageId = state.site.pages[0].id;
      }
      scheduleSave();
      renderBuilder();
    });

    item.append(selector, removeBtn);
    pageList.appendChild(item);
  });
}

function renderCanvas() {
  const page = getActivePage();
  if (!page) return;
  canvasPageTitle.textContent = `Editing: ${page.name}`;
  canvas.innerHTML = '';

  page.blocks.forEach((block) => {
    const template = document.getElementById('block-template');
    const element = template.content.firstElementChild.cloneNode(true);
    const renderer = blockTypes.find((item) => item.type === block.type)?.render;
    element.innerHTML = renderer ? renderer(block) : '<p>Unsupported block</p>';

    if (block.type === 'text') {
      const editor = document.createElement('textarea');
      editor.value = block.body;
      editor.addEventListener('input', () => {
        block.body = editor.value;
        scheduleSave();
      });
      element.appendChild(editor);
    }

    canvas.appendChild(element);
  });
}

function scheduleSave() {
  clearTimeout(autosaveTimer);
  saveStatus.textContent = 'Saving...';
  autosaveTimer = setTimeout(saveNow, 450);
}

function saveNow() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveStatus.textContent = 'All changes auto-saved';
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { user: null, site: null, activePageId: null };
  } catch {
    return { user: null, site: null, activePageId: null };
  }
}

function createSite(name, template) {
  const base = {
    name,
    publish: { customDomain: '', subdomain: '' },
    pages: [{ id: crypto.randomUUID(), name: 'Home', blocks: [] }],
  };

  if (template === 'business') {
    base.pages[0].blocks.push(
      { id: crypto.randomUUID(), type: 'hero', heading: `${name}`, body: 'Trusted by customers worldwide.' },
      { id: crypto.randomUUID(), type: 'cta', text: 'Book a call', href: '#' }
    );
  }

  if (template === 'portfolio') {
    base.pages[0].blocks.push(
      { id: crypto.randomUUID(), type: 'hero', heading: 'Creative portfolio', body: 'Show your best projects.' },
      { id: crypto.randomUUID(), type: 'image', src: 'https://placehold.co/1000x500?text=Portfolio+Work', alt: 'Portfolio cover' }
    );
  }

  return base;
}

function getActivePage() {
  return state.site?.pages.find((page) => page.id === state.activePageId) || state.site?.pages[0];
}

function renderPreviewHtml(site) {
  const page = getActivePage();
  const rendered = page.blocks
    .map((block) => blockTypes.find((item) => item.type === block.type)?.render(block) || '')
    .join('\n');

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(site.name)} - Preview</title>
    <style>
      body { margin: 0; padding: 2rem; font-family: Inter, system-ui, sans-serif; background: #f5f7ff; }
      main { max-width: 900px; margin: 0 auto; background: white; border-radius: 16px; padding: 2rem; }
      img { max-width: 100%; border-radius: 12px; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(site.name)} <small style="color:#7181b5">Preview</small></h1>
      ${rendered || '<p>Start dragging blocks into the canvas to build your page.</p>'}
    </main>
  </body>
</html>`;
}

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
