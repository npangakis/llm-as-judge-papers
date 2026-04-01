const PAGE_SIZE = 20;
const AUTHOR_TRUNCATE = 60;

let allPapers = [];
let filtered = [];
let sortCol = null;
let sortDir = 'asc';
let currentPage = 1;

const selections = { section: new Set(), venue: new Set(), year: new Set() };

const searchInput = document.getElementById('search-input');
const tbody = document.getElementById('papers-tbody');
const resultsCount = document.getElementById('results-count');
const paginationEl = document.getElementById('pagination');
const clearBtn = document.getElementById('clear-filters');

function uniqueSorted(papers, field) {
  const vals = [...new Set(papers.map(p => p[field]).filter(v => v !== '' && v != null))];
  return vals.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

function initMultiSelect(container, values, field) {
  const btn = container.querySelector('.multi-select-btn');
  const panel = container.querySelector('.multi-select-panel');
  const optionsDiv = container.querySelector('.multi-select-options');
  const selectAllLink = container.querySelector('.select-all');
  const clearAllLink = container.querySelector('.clear-all');
  const label = field.charAt(0).toUpperCase() + field.slice(1);

  optionsDiv.innerHTML = '';
  values.forEach(val => {
    const lbl = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = String(val);
    const span = document.createElement('span');
    span.textContent = String(val);
    lbl.appendChild(cb);
    lbl.appendChild(span);
    optionsDiv.appendChild(lbl);

    cb.addEventListener('change', () => {
      if (cb.checked) {
        selections[field].add(val);
      } else {
        selections[field].delete(val);
      }
      updateBtnLabel();
      applyFilters();
    });
  });

  function updateBtnLabel() {
    const count = selections[field].size;
    if (count === 0) {
      btn.textContent = `${label} ▾`;
      btn.classList.remove('has-selection');
    } else {
      btn.textContent = `${label} (${count}) ▾`;
      btn.classList.add('has-selection');
    }
  }

  function setAll(checked) {
    const cbs = optionsDiv.querySelectorAll('input[type="checkbox"]');
    selections[field].clear();
    cbs.forEach(cb => {
      cb.checked = checked;
      if (checked) {
        const v = values.find(val => String(val) === cb.value);
        if (v !== undefined) selections[field].add(v);
      }
    });
    updateBtnLabel();
    applyFilters();
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllPanels(panel);
    panel.hidden = !panel.hidden;
  });

  selectAllLink.addEventListener('click', (e) => {
    e.preventDefault();
    setAll(true);
  });

  clearAllLink.addEventListener('click', (e) => {
    e.preventDefault();
    setAll(false);
  });

  container._reset = () => {
    setAll(false);
  };
}

function closeAllPanels(except) {
  document.querySelectorAll('.multi-select-panel').forEach(p => {
    if (p !== except) p.hidden = true;
  });
}

document.addEventListener('click', () => closeAllPanels());

function matchesSearch(paper, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (paper.title || '').toLowerCase().includes(q) ||
    (paper.authors || '').toLowerCase().includes(q)
  );
}

function matchesMultiSelect(paper, field) {
  if (selections[field].size === 0) return true;
  const val = paper[field];
  if (field === 'year') {
    return selections[field].has(val) || selections[field].has(String(val));
  }
  return selections[field].has(val);
}

function applyFilters() {
  const query = searchInput.value.trim();
  filtered = allPapers.filter(p =>
    matchesSearch(p, query) &&
    matchesMultiSelect(p, 'section') &&
    matchesMultiSelect(p, 'venue') &&
    matchesMultiSelect(p, 'year')
  );

  if (sortCol) {
    filtered.sort((a, b) => {
      let va = a[sortCol] ?? '';
      let vb = b[sortCol] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  currentPage = 1;
  render();
}

function truncateAuthors(authors) {
  if (!authors) return '';
  if (authors.length <= AUTHOR_TRUNCATE) return authors;
  return authors.slice(0, AUTHOR_TRUNCATE) + '…';
}

function render() {
  const total = allPapers.length;
  const showing = filtered.length;
  resultsCount.textContent = `Showing ${showing} of ${total} papers`;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = '';
  if (page.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.style.textAlign = 'center';
    td.style.padding = '2rem';
    td.style.color = '#64748b';
    td.textContent = 'No papers match your filters.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    page.forEach(paper => {
      const tr = document.createElement('tr');

      // Title cell
      const tdTitle = document.createElement('td');
      const titleContainer = document.createElement('div');
      if (paper.link) {
        const a = document.createElement('a');
        a.href = paper.link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'paper-link';
        a.textContent = paper.title || '(Untitled)';
        titleContainer.appendChild(a);
      } else {
        const span = document.createElement('span');
        span.className = 'paper-link';
        span.textContent = paper.title || '(Untitled)';
        titleContainer.appendChild(span);
      }

      if (paper.about) {
        const aboutSpan = document.createElement('span');
        aboutSpan.className = 'paper-about';
        aboutSpan.textContent = paper.about;

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'about-toggle';
        toggleBtn.textContent = 'About this paper';
        toggleBtn.addEventListener('click', () => {
          const expanded = aboutSpan.classList.toggle('expanded');
          toggleBtn.textContent = expanded ? 'Hide' : 'About this paper';
        });

        titleContainer.appendChild(toggleBtn);
        titleContainer.appendChild(aboutSpan);
      }
      tdTitle.appendChild(titleContainer);
      tr.appendChild(tdTitle);

      // Section
      const tdSection = document.createElement('td');
      tdSection.textContent = paper.section || '';
      tr.appendChild(tdSection);

      // Venue
      const tdVenue = document.createElement('td');
      tdVenue.textContent = paper.venue || '';
      tr.appendChild(tdVenue);

      // Year
      const tdYear = document.createElement('td');
      tdYear.textContent = paper.year != null ? paper.year : '';
      tr.appendChild(tdYear);

      // Authors
      const tdAuthors = document.createElement('td');
      const shortAuthors = truncateAuthors(paper.authors);
      tdAuthors.textContent = shortAuthors;
      if (paper.authors && paper.authors.length > AUTHOR_TRUNCATE) {
        tdAuthors.title = paper.authors;
      }
      tr.appendChild(tdAuthors);

      tbody.appendChild(tr);
    });
  }

  renderPagination();
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  paginationEl.innerHTML = '';

  if (totalPages <= 1) return;

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '← Prev';
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener('click', () => { currentPage--; render(); scrollToTable(); });
  paginationEl.appendChild(prevBtn);

  const maxVisible = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    paginationEl.appendChild(createPageBtn(1));
    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.textContent = '…';
      dots.style.padding = '0 0.3rem';
      paginationEl.appendChild(dots);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    paginationEl.appendChild(createPageBtn(i));
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.textContent = '…';
      dots.style.padding = '0 0.3rem';
      paginationEl.appendChild(dots);
    }
    paginationEl.appendChild(createPageBtn(totalPages));
  }

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next →';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener('click', () => { currentPage++; render(); scrollToTable(); });
  paginationEl.appendChild(nextBtn);
}

function createPageBtn(page) {
  const btn = document.createElement('button');
  btn.textContent = page;
  btn.classList.toggle('active', page === currentPage);
  btn.addEventListener('click', () => { currentPage = page; render(); scrollToTable(); });
  return btn;
}

function scrollToTable() {
  document.querySelector('.table-wrapper').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function initSorting() {
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'asc';
      }

      document.querySelectorAll('.sortable').forEach(h => {
        h.classList.remove('asc', 'desc');
      });
      th.classList.add(sortDir);
      applyFilters();
    });
  });
}

export function initBrowse(papers) {
  allPapers = papers;

  const sections = uniqueSorted(papers, 'section');
  const venues = uniqueSorted(papers, 'venue');
  const years = uniqueSorted(papers, 'year');

  const sectionContainer = document.querySelector('.multi-select[data-field="section"]');
  const venueContainer = document.querySelector('.multi-select[data-field="venue"]');
  const yearContainer = document.querySelector('.multi-select[data-field="year"]');

  initMultiSelect(sectionContainer, sections, 'section');
  initMultiSelect(venueContainer, venues, 'venue');
  initMultiSelect(yearContainer, years, 'year');

  searchInput.addEventListener('input', () => applyFilters());

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    sectionContainer._reset();
    venueContainer._reset();
    yearContainer._reset();
    sortCol = null;
    sortDir = 'asc';
    document.querySelectorAll('.sortable').forEach(h => h.classList.remove('asc', 'desc'));
    applyFilters();
  });

  initSorting();

  // Custom section ordering
  const SECTION_ORDER = [
    'Survey papers',
    'Foundational papers on judge LLM systems and judge LLM benchmarks',
    'Validity and reliability of judge LLMs',
    'Systematic Biases in Judge LLMs',
    'Rubric Design, Calibration, and Evaluation Frameworks',
    'Practitioner guides and blog posts',
    'Curated resource repositories and GitHub lists',
  ];

  function sectionRank(s) {
    const idx = SECTION_ORDER.indexOf(s);
    return idx === -1 ? SECTION_ORDER.length : idx;
  }

  // Default sort: section (custom order) → year (oldest first) → venue (alpha)
  filtered = [...allPapers];
  filtered.sort((a, b) => {
    const s = sectionRank(a.section) - sectionRank(b.section);
    if (s !== 0) return s;
    const y = (a.year ?? 0) - (b.year ?? 0);
    if (y !== 0) return y;
    return (a.venue || '').localeCompare(b.venue || '');
  });
  render();
}
