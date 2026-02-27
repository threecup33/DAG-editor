const state = {
  canvases: [],
  activeCanvasId: null,
  selectedNodeId: null,
  dragNode: null,
  edgeDrag: null,
  dragCanvas: null,
  canvasSeq: 1,
  lastMetaKeysTemplate: [],
};

const NODE_WIDTH = 120;
const NODE_HEIGHT = 60;

const ui = {
  canvas: document.getElementById('canvas'),
  main: document.querySelector('.main'),
  viewport: document.getElementById('viewport'),
  edgeLayer: document.getElementById('edgeLayer'),
  canvasList: document.getElementById('canvasList'),
  propertyPanel: document.getElementById('propertyPanel'),
  nodeIdInput: document.getElementById('nodeIdInput'),
  nodeLabelInput: document.getElementById('nodeLabelInput'),
  nodeColorInput: document.getElementById('nodeColorInput'),
  metaRows: document.getElementById('metaRows'),
  addMetaRowBtn: document.getElementById('addMetaRowBtn'),
  importInput: document.getElementById('importInput'),
};

const nextCanvasId = () => `canvas-${state.canvasSeq++}`;
const getActiveCanvas = () => state.canvases.find((c) => c.id === state.activeCanvasId);


function getPointerOnCanvas(clientX, clientY) {
  const canvas = getActiveCanvas();
  const rect = ui.main.getBoundingClientRect();
  const panX = canvas?.panX ?? 0;
  const panY = canvas?.panY ?? 0;
  return {
    x: clientX - rect.left - panX,
    y: clientY - rect.top - panY,
  };
}

function updateViewportPosition() {
  const canvas = getActiveCanvas();
  const panX = canvas?.panX ?? 0;
  const panY = canvas?.panY ?? 0;
  ui.viewport.style.transform = `translate(${panX}px, ${panY}px)`;
}

function nextNodeId(canvas) {
  const used = new Set(canvas.nodes.map((n) => Number(n.id)).filter((id) => Number.isInteger(id) && id > 0));
  let candidate = 1;
  while (used.has(candidate)) candidate += 1;
  return String(candidate);
}

function createCanvas(name = `画布 ${state.canvases.length + 1}`) {
  const canvas = { id: nextCanvasId(), name, nodes: [], edges: [], panX: 0, panY: 0 };
  state.canvases.push(canvas);
  state.activeCanvasId = canvas.id;
  state.selectedNodeId = null;
  render();
}

function createMetaFromTemplate() {
  return Object.fromEntries(state.lastMetaKeysTemplate.map((key) => [key, '']));
}

function addNode() {
  const canvas = getActiveCanvas();
  if (!canvas) return;
  const id = nextNodeId(canvas);
  canvas.nodes.push({
    id,
    label: `节点 ${id}`,
    x: 200 + canvas.nodes.length * 30,
    y: 120 + canvas.nodes.length * 20,
    color: '#ffffff',
    meta: createMetaFromTemplate(),
  });
  render();
}

function render() {
  updateViewportPosition();
  renderCanvasList();
  renderNodes();
  renderEdges();
  renderPropertyPanel();
}

function renderCanvasList() {
  ui.canvasList.innerHTML = '';
  state.canvases.forEach((canvas) => {
    const div = document.createElement('div');
    div.className = `canvas-item ${canvas.id === state.activeCanvasId ? 'active' : ''}`;
    div.textContent = `${canvas.name} (${canvas.nodes.length} 节点)`;
    div.onclick = () => {
      state.activeCanvasId = canvas.id;
      state.selectedNodeId = null;
      render();
    };
    ui.canvasList.appendChild(div);
  });
}

function renderNodes() {
  ui.canvas.innerHTML = '';
  const canvas = getActiveCanvas();
  if (!canvas) return;

  canvas.nodes.forEach((node) => {
    const div = document.createElement('div');
    div.className = `node ${node.id === state.selectedNodeId ? 'selected' : ''}`;
    div.style.left = `${node.x}px`;
    div.style.top = `${node.y}px`;
    div.style.background = node.color;
    div.dataset.id = node.id;

    div.innerHTML = `
      <div class="handle in"></div>
      <div class="title">${node.label}</div>
      <small>ID: ${node.id}</small>
      <div class="handle out"></div>
    `;

    div.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('out')) return;
      const pointer = getPointerOnCanvas(e.clientX, e.clientY);
      state.dragNode = {
        id: node.id,
        offsetX: pointer.x - node.x,
        offsetY: pointer.y - node.y,
      };
    });

    div.addEventListener('click', () => {
      state.selectedNodeId = node.id;
      render();
    });

    const outHandle = div.querySelector('.out');
    outHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const pointer = getPointerOnCanvas(e.clientX, e.clientY);
      state.edgeDrag = {
        fromNodeId: node.id,
        x1: node.x + NODE_WIDTH,
        y1: node.y + NODE_HEIGHT / 2,
        x2: pointer.x,
        y2: pointer.y,
      };
      renderEdges();
    });

    ui.canvas.appendChild(div);
  });
}

function edgePath(x1, y1, x2, y2) {
  const dx = Math.max(40, Math.abs(x2 - x1) / 2);
  return `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

function ensureArrowMarker() {
  if (ui.edgeLayer.querySelector('#arrow-head')) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrow-head');
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '8');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('orient', 'auto-start-reverse');

  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  arrow.setAttribute('fill', '#334155');

  marker.appendChild(arrow);
  defs.appendChild(marker);
  ui.edgeLayer.appendChild(defs);
}

function commitEdgeIfPossible(clientX, clientY) {
  const canvas = getActiveCanvas();
  if (!canvas || !state.edgeDrag) return;

  const dropTarget = document.elementFromPoint(clientX, clientY)?.closest('.node');
  const toNodeId = dropTarget?.dataset.id;
  if (!toNodeId || toNodeId === state.edgeDrag.fromNodeId) {
    state.edgeDrag = null;
    renderEdges();
    return;
  }

  const exists = canvas.edges.some(
    (edge) => edge.from === state.edgeDrag.fromNodeId && edge.to === toNodeId,
  );
  if (!exists) {
    canvas.edges.push({ id: `${state.edgeDrag.fromNodeId}->${toNodeId}`, from: state.edgeDrag.fromNodeId, to: toNodeId });
  }

  state.edgeDrag = null;
  render();
}

function renderEdges() {
  const canvas = getActiveCanvas();
  ui.edgeLayer.innerHTML = '';
  if (!canvas) return;
  ensureArrowMarker();

  const nodeById = Object.fromEntries(canvas.nodes.map((n) => [n.id, n]));
  canvas.edges.forEach((edge) => {
    const from = nodeById[edge.from];
    const to = nodeById[edge.to];
    if (!from || !to) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', edgePath(from.x + NODE_WIDTH, from.y + NODE_HEIGHT / 2, to.x, to.y + NODE_HEIGHT / 2));
    path.setAttribute('stroke', '#334155');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('marker-end', 'url(#arrow-head)');
    ui.edgeLayer.appendChild(path);
  });

  if (state.edgeDrag) {
    const draft = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    draft.setAttribute('d', edgePath(state.edgeDrag.x1, state.edgeDrag.y1, state.edgeDrag.x2, state.edgeDrag.y2));
    draft.setAttribute('stroke', '#f59e0b');
    draft.setAttribute('fill', 'none');
    draft.setAttribute('stroke-width', '2');
    draft.setAttribute('stroke-dasharray', '6 4');
    draft.setAttribute('marker-end', 'url(#arrow-head)');
    ui.edgeLayer.appendChild(draft);
  }
}

function addMetaRow(key = '', value = '') {
  const row = document.createElement('div');
  row.className = 'meta-row';

  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.placeholder = '属性名';
  keyInput.value = key;

  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.placeholder = '属性值';
  valueInput.value = value;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.onclick = () => row.remove();

  row.appendChild(keyInput);
  row.appendChild(valueInput);
  row.appendChild(removeBtn);
  ui.metaRows.appendChild(row);
}

function setMetaRows(meta) {
  ui.metaRows.innerHTML = '';
  const entries = Object.entries(meta || {});
  if (!entries.length) {
    addMetaRow();
    return;
  }
  entries.forEach(([key, value]) => addMetaRow(String(key), String(value)));
}

function getMetaFromRows() {
  const meta = {};
  const rows = ui.metaRows.querySelectorAll('.meta-row');
  rows.forEach((row) => {
    const [keyInput, valueInput] = row.querySelectorAll('input');
    const key = keyInput.value.trim();
    if (!key) return;
    meta[key] = valueInput.value;
  });
  return meta;
}

function renderPropertyPanel() {
  const canvas = getActiveCanvas();
  const node = canvas?.nodes.find((n) => n.id === state.selectedNodeId);
  if (!node) {
    ui.propertyPanel.classList.add('hidden');
    return;
  }
  ui.propertyPanel.classList.remove('hidden');
  ui.nodeIdInput.value = node.id;
  ui.nodeLabelInput.value = node.label;
  ui.nodeColorInput.value = node.color;
  setMetaRows(node.meta);
}

function normalizeImportedCanvas(raw) {
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const edges = Array.isArray(raw.edges) ? raw.edges : [];

  const normalizedNodes = nodes.map((node, index) => ({
    id: String(node.id ?? index + 1),
    label: String(node.label ?? `节点 ${index + 1}`),
    x: Number.isFinite(node.x) ? node.x : 120 + index * 20,
    y: Number.isFinite(node.y) ? node.y : 100 + index * 20,
    color: typeof node.color === 'string' ? node.color : '#ffffff',
    meta: typeof node.meta === 'object' && node.meta !== null ? node.meta : {},
  }));

  const nodeIdSet = new Set(normalizedNodes.map((node) => node.id));
  const normalizedEdges = edges
    .map((edge) => ({ from: String(edge.from), to: String(edge.to) }))
    .filter((edge) => edge.from && edge.to && edge.from !== edge.to)
    .filter((edge) => nodeIdSet.has(edge.from) && nodeIdSet.has(edge.to))
    .map((edge) => ({ ...edge, id: `${edge.from}->${edge.to}` }));

  return {
    id: nextCanvasId(),
    name: String(raw.name || `导入画布 ${state.canvases.length + 1}`),
    nodes: normalizedNodes,
    edges: normalizedEdges,
    panX: Number.isFinite(raw.panX) ? raw.panX : 0,
    panY: Number.isFinite(raw.panY) ? raw.panY : 0,
  };
}

window.addEventListener('mousemove', (e) => {
  const canvas = getActiveCanvas();
  if (!canvas) return;
  const pointer = getPointerOnCanvas(e.clientX, e.clientY);

  if (state.dragCanvas) {
    canvas.panX = state.dragCanvas.startPanX + (e.clientX - state.dragCanvas.startX);
    canvas.panY = state.dragCanvas.startPanY + (e.clientY - state.dragCanvas.startY);
    updateViewportPosition();
  }

  if (state.dragNode) {
    const node = canvas.nodes.find((n) => n.id === state.dragNode.id);
    if (!node) return;
    node.x = pointer.x - state.dragNode.offsetX;
    node.y = pointer.y - state.dragNode.offsetY;
    renderNodes();
    renderEdges();
  }

  if (state.edgeDrag) {
    state.edgeDrag.x2 = pointer.x;
    state.edgeDrag.y2 = pointer.y;
    renderEdges();
  }
});

window.addEventListener('mouseup', (e) => {
  commitEdgeIfPossible(e.clientX, e.clientY);
  state.dragNode = null;
  state.dragCanvas = null;
  if (!state.edgeDrag) {
    renderEdges();
  }
});


ui.main.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('.node') || e.target.closest('.property-panel')) return;
  const canvas = getActiveCanvas();
  if (!canvas) return;
  state.dragCanvas = {
    startX: e.clientX,
    startY: e.clientY,
    startPanX: canvas.panX ?? 0,
    startPanY: canvas.panY ?? 0,
  };
});

document.getElementById('newCanvasBtn').onclick = () => createCanvas();
document.getElementById('addNodeBtn').onclick = addNode;
ui.addMetaRowBtn.onclick = () => addMetaRow();

document.getElementById('saveNodeBtn').onclick = () => {
  const canvas = getActiveCanvas();
  const node = canvas?.nodes.find((n) => n.id === state.selectedNodeId);
  if (!node) return;

  const nextId = ui.nodeIdInput.value.trim();
  if (!nextId) {
    alert('节点 ID 不能为空');
    return;
  }

  const duplicated = canvas.nodes.some((n) => n.id === nextId && n !== node);
  if (duplicated) {
    alert('节点 ID 已存在，请使用唯一 ID');
    return;
  }

  const oldId = node.id;
  node.id = nextId;
  node.label = ui.nodeLabelInput.value.trim() || node.label;
  node.color = ui.nodeColorInput.value;
  node.meta = getMetaFromRows();
  state.lastMetaKeysTemplate = Object.keys(node.meta);

  if (oldId !== nextId) {
    canvas.edges.forEach((edge) => {
      if (edge.from === oldId) edge.from = nextId;
      if (edge.to === oldId) edge.to = nextId;
      edge.id = `${edge.from}->${edge.to}`;
    });
    state.selectedNodeId = nextId;
  }

  render();
};

document.getElementById('deleteNodeBtn').onclick = () => {
  const canvas = getActiveCanvas();
  if (!canvas) return;
  canvas.nodes = canvas.nodes.filter((n) => n.id !== state.selectedNodeId);
  canvas.edges = canvas.edges.filter((e) => e.from !== state.selectedNodeId && e.to !== state.selectedNodeId);
  state.selectedNodeId = null;
  render();
};

document.getElementById('exportBtn').onclick = () => {
  const canvas = getActiveCanvas();
  if (!canvas) return;
  const payload = JSON.stringify({
    canvasId: canvas.id,
    name: canvas.name,
    nodes: canvas.nodes,
    edges: canvas.edges,
    panX: canvas.panX ?? 0,
    panY: canvas.panY ?? 0,
  }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${canvas.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

document.getElementById('importBtn').onclick = () => ui.importInput.click();
ui.importInput.onchange = async (event) => {
  const [file] = event.target.files || [];
  event.target.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    const raw = JSON.parse(text);
    const imported = normalizeImportedCanvas(raw);
    state.canvases.push(imported);
    state.activeCanvasId = imported.id;
    state.selectedNodeId = null;
    render();
  } catch {
    alert('导入失败：请检查 JSON 格式是否正确');
  }
};

createCanvas('默认画布');
