const state = {
  canvases: [],
  activeCanvasId: null,
  selectedNodeId: null,
  dragNode: null,
  edgeDrag: null,
};

const NODE_WIDTH = 120;
const NODE_HEIGHT = 60;

const ui = {
  canvas: document.getElementById('canvas'),
  edgeLayer: document.getElementById('edgeLayer'),
  canvasList: document.getElementById('canvasList'),
  propertyPanel: document.getElementById('propertyPanel'),
  nodeLabelInput: document.getElementById('nodeLabelInput'),
  nodeColorInput: document.getElementById('nodeColorInput'),
  nodeMetaInput: document.getElementById('nodeMetaInput'),
};

const uid = () => Math.random().toString(36).slice(2, 10);
const getActiveCanvas = () => state.canvases.find((c) => c.id === state.activeCanvasId);

function createCanvas(name = `画布 ${state.canvases.length + 1}`) {
  const canvas = { id: uid(), name, nodes: [], edges: [] };
  state.canvases.push(canvas);
  state.activeCanvasId = canvas.id;
  state.selectedNodeId = null;
  render();
}

function addNode() {
  const canvas = getActiveCanvas();
  if (!canvas) return;
  canvas.nodes.push({
    id: uid(),
    label: `节点 ${canvas.nodes.length + 1}`,
    x: 200 + canvas.nodes.length * 30,
    y: 120 + canvas.nodes.length * 20,
    color: '#ffffff',
    meta: {},
  });
  render();
}

function render() {
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
      <small>${node.id}</small>
      <div class="handle out"></div>
    `;

    div.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('out')) return;
      const rect = ui.canvas.getBoundingClientRect();
      state.dragNode = {
        id: node.id,
        offsetX: e.clientX - rect.left - node.x,
        offsetY: e.clientY - rect.top - node.y,
      };
    });

    div.addEventListener('click', () => {
      state.selectedNodeId = node.id;
      render();
    });

    const outHandle = div.querySelector('.out');
    outHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const rect = ui.canvas.getBoundingClientRect();
      state.edgeDrag = {
        fromNodeId: node.id,
        x1: node.x + NODE_WIDTH,
        y1: node.y + NODE_HEIGHT / 2,
        x2: e.clientX - rect.left,
        y2: e.clientY - rect.top,
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
    canvas.edges.push({ id: uid(), from: state.edgeDrag.fromNodeId, to: toNodeId });
  }

  state.edgeDrag = null;
  render();
}

function renderEdges() {
  const canvas = getActiveCanvas();
  ui.edgeLayer.innerHTML = '';
  if (!canvas) return;

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
    ui.edgeLayer.appendChild(path);
  });

  if (state.edgeDrag) {
    const draft = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    draft.setAttribute('d', edgePath(state.edgeDrag.x1, state.edgeDrag.y1, state.edgeDrag.x2, state.edgeDrag.y2));
    draft.setAttribute('stroke', '#f59e0b');
    draft.setAttribute('fill', 'none');
    draft.setAttribute('stroke-width', '2');
    draft.setAttribute('stroke-dasharray', '6 4');
    ui.edgeLayer.appendChild(draft);
  }
}

function renderPropertyPanel() {
  const canvas = getActiveCanvas();
  const node = canvas?.nodes.find((n) => n.id === state.selectedNodeId);
  if (!node) {
    ui.propertyPanel.classList.add('hidden');
    return;
  }
  ui.propertyPanel.classList.remove('hidden');
  ui.nodeLabelInput.value = node.label;
  ui.nodeColorInput.value = node.color;
  ui.nodeMetaInput.value = JSON.stringify(node.meta, null, 2);
}

window.addEventListener('mousemove', (e) => {
  const canvas = getActiveCanvas();
  if (!canvas) return;
  const rect = ui.canvas.getBoundingClientRect();

  if (state.dragNode) {
    const node = canvas.nodes.find((n) => n.id === state.dragNode.id);
    if (!node) return;
    node.x = e.clientX - rect.left - state.dragNode.offsetX;
    node.y = e.clientY - rect.top - state.dragNode.offsetY;
    renderNodes();
    renderEdges();
  }

  if (state.edgeDrag) {
    state.edgeDrag.x2 = e.clientX - rect.left;
    state.edgeDrag.y2 = e.clientY - rect.top;
    renderEdges();
  }
});

window.addEventListener('mouseup', (e) => {
  commitEdgeIfPossible(e.clientX, e.clientY);
  state.dragNode = null;
  if (!state.edgeDrag) {
    renderEdges();
  }
});

document.getElementById('newCanvasBtn').onclick = () => createCanvas();
document.getElementById('addNodeBtn').onclick = addNode;

document.getElementById('saveNodeBtn').onclick = () => {
  const canvas = getActiveCanvas();
  const node = canvas?.nodes.find((n) => n.id === state.selectedNodeId);
  if (!node) return;
  try {
    node.label = ui.nodeLabelInput.value.trim() || node.label;
    node.color = ui.nodeColorInput.value;
    node.meta = JSON.parse(ui.nodeMetaInput.value || '{}');
    render();
  } catch {
    alert('自定义属性必须是合法 JSON');
  }
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
  }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${canvas.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

createCanvas('默认画布');
