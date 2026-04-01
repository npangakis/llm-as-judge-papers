import { initBrowse } from './browse.js';
import { initExplore } from './explore.js';

const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const browsePanel = document.getElementById('browse-panel');
const explorePanel = document.getElementById('explore-panel');

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      browsePanel.classList.toggle('active', target === 'browse');
      browsePanel.hidden = target !== 'browse';
      explorePanel.classList.toggle('active', target === 'explore');
      explorePanel.hidden = target !== 'explore';

      if (target === 'explore') {
        window.dispatchEvent(new Event('resize'));
      }
    });
  });
}

async function loadData() {
  try {
    const [papersRes, embeddingsRes] = await Promise.all([
      fetch('data/papers.json'),
      fetch('data/embeddings.json')
    ]);

    if (!papersRes.ok) throw new Error(`Papers: ${papersRes.status}`);
    if (!embeddingsRes.ok) throw new Error(`Embeddings: ${embeddingsRes.status}`);

    const papers = await papersRes.json();
    const embeddings = await embeddingsRes.json();

    const coords = embeddings.coords || [];
    papers.forEach((paper, i) => {
      if (i < coords.length) {
        paper.x = coords[i][0];
        paper.y = coords[i][1];
      } else {
        paper.x = null;
        paper.y = null;
      }
    });

    return papers;
  } catch (err) {
    console.error('Failed to load data:', err);
    throw err;
  }
}

async function main() {
  initTabs();

  try {
    const papers = await loadData();
    loadingEl.hidden = true;
    browsePanel.hidden = false;

    initBrowse(papers);
    initExplore(papers);
  } catch (err) {
    loadingEl.hidden = true;
    errorEl.hidden = false;
  }
}

main();
