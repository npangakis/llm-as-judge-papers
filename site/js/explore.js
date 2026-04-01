let allPapers = [];

const temporalGroupSelect = document.getElementById('temporal-group');
const temporalModeSelect = document.getElementById('temporal-mode');
const scatterColorSelect = document.getElementById('scatter-color');
const temporalDiv = document.getElementById('temporal-chart');
const scatterDiv = document.getElementById('scatter-chart');

const PLOTLY_LAYOUT_BASE = {
  font: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', size: 13 },
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  margin: { t: 30, r: 20, b: 50, l: 50 },
  autosize: true,
};

const PLOTLY_CONFIG = {
  responsive: true,
  displayModeBar: false,
};

function getGroups(papers, field) {
  const groups = {};
  papers.forEach(p => {
    const val = p[field];
    if (val == null || String(val).trim() === '') return;
    const key = String(val);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });
  return groups;
}

function renderTemporalChart() {
  const groupField = temporalGroupSelect.value;
  const mode = temporalModeSelect.value;

  const years = [...new Set(allPapers.map(p => p.year).filter(y => y != null))].sort();
  const groups = getGroups(allPapers, groupField);
  const groupNames = Object.keys(groups).sort();

  const traces = groupNames.map(name => {
    const counts = years.map(y => groups[name].filter(p => p.year === y).length);
    return {
      name,
      x: years.map(String),
      y: counts,
      type: 'bar',
    };
  });

  const layout = {
    ...PLOTLY_LAYOUT_BASE,
    barmode: mode === 'stack' ? 'stack' : 'group',
    xaxis: {
      title: 'Year',
      type: 'category',
      gridcolor: '#e2e8f0',
    },
    yaxis: {
      title: 'Paper Count',
      gridcolor: '#e2e8f0',
      rangemode: 'tozero',
    },
    legend: {
      orientation: 'h',
      y: -0.25,
      x: 0.5,
      xanchor: 'center',
      font: { size: 11 },
    },
    margin: { t: 20, r: 20, b: 80, l: 55 },
  };

  Plotly.react(temporalDiv, traces, layout, PLOTLY_CONFIG);
}

function renderScatterChart() {
  const colorField = scatterColorSelect.value;

  const papersWithCoords = allPapers.filter(p => p.x != null && p.y != null);
  const groups = getGroups(papersWithCoords, colorField);
  const groupNames = Object.keys(groups).sort();

  const traces = groupNames.map(name => {
    const pts = groups[name];
    return {
      name,
      x: pts.map(p => p.x),
      y: pts.map(p => p.y),
      mode: 'markers',
      type: 'scatter',
      marker: {
        size: 11,
        opacity: 0.7,
        line: { width: 0.5, color: 'rgba(0,0,0,0.15)' },
      },
      text: pts.map(p => p.title || '(Untitled)'),
      customdata: pts.map(p => ({
        authors: p.authors || '',
        link: p.link || '',
        about: p.about || 'No abstract available',
      })),
      hovertemplate:
        '<b>%{text}</b><br>' +
        '%{customdata.authors}<br>' +
        '<extra>%{fullData.name}</extra>',
    };
  });

  const layout = {
    ...PLOTLY_LAYOUT_BASE,
    xaxis: {
      showticklabels: false,
      showgrid: false,
      zeroline: false,
      title: '',
    },
    yaxis: {
      showticklabels: false,
      showgrid: false,
      zeroline: false,
      title: '',
    },
    legend: {
      font: { size: 11 },
      itemsizing: 'constant',
    },
    margin: { t: 20, r: 20, b: 30, l: 30 },
    hovermode: 'closest',
  };

  Plotly.react(scatterDiv, traces, layout, PLOTLY_CONFIG);

  scatterDiv.removeAllListeners && scatterDiv.removeAllListeners('plotly_click');
  scatterDiv.on('plotly_click', (data) => {
    if (data.points && data.points.length > 0) {
      const pt = data.points[0];
      const link = pt.customdata && pt.customdata.link;
      if (link) {
        window.open(link, '_blank', 'noopener,noreferrer');
      }
    }
  });
}

export function initExplore(papers) {
  allPapers = papers;

  // Chart sub-tab switching
  const chartTabs = document.querySelectorAll('.chart-tab');
  const temporalSection = document.getElementById('temporal-section');
  const scatterSection = document.getElementById('scatter-section');

  chartTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      chartTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.chart;
      temporalSection.classList.toggle('active', target === 'temporal');
      temporalSection.hidden = target !== 'temporal';
      scatterSection.classList.toggle('active', target === 'scatter');
      scatterSection.hidden = target !== 'scatter';
      // Trigger resize so Plotly reflows into the now-visible container
      window.dispatchEvent(new Event('resize'));
    });
  });

  temporalGroupSelect.addEventListener('change', renderTemporalChart);
  temporalModeSelect.addEventListener('change', renderTemporalChart);
  scatterColorSelect.addEventListener('change', renderScatterChart);

  renderTemporalChart();
  renderScatterChart();
}
