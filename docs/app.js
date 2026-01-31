/**
 * Signal analysis dashboard – loads signals_by_theme.json and renders summary + charts + table.
 * Tries data/signals_by_theme.json first (after build_analysis.py), then ../signals/signals_by_theme.json.
 */

const DATA_PATHS = ["data/signals_by_theme.json", "../signals/signals_by_theme.json"];

let chartTheme = null;
let chartPriority = null;

function parseData(data) {
  const themeCounts = {};
  const priorityCounts = { High: 0, Medium: 0, Low: 0 };
  const transcriptIds = new Set();

  for (const [canonical, rawList] of Object.entries(data)) {
    let count = 0;
    for (const item of rawList) {
      if (typeof item !== "object" || item === null) continue;
      for (const [rawTheme, signals] of Object.entries(item)) {
        if (!Array.isArray(signals)) continue;
        count += signals.length;
        for (const sig of signals) {
          if (sig && typeof sig === "object") {
            const p = (sig.priority || "Medium").trim();
            priorityCounts[p] = (priorityCounts[p] || 0) + 1;
            if (sig.transcript_id) transcriptIds.add(sig.transcript_id);
          }
        }
      }
    }
    themeCounts[canonical] = count;
  }

  const themesSorted = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]);
  return {
    totalSignals: Object.values(themeCounts).reduce((a, b) => a + b, 0),
    totalThemes: Object.keys(themeCounts).length,
    totalTranscripts: transcriptIds.size,
    themeCounts: Object.fromEntries(themesSorted),
    priorityCounts,
  };
}

function renderSummary(stats) {
  const container = document.getElementById("summary-cards");
  if (!container) return;
  container.innerHTML = `
    <div class="card"><div class="value">${stats.totalSignals}</div><div class="label">Total signals</div></div>
    <div class="card"><div class="value">${stats.totalThemes}</div><div class="label">Canonical themes</div></div>
    <div class="card"><div class="value">${stats.totalTranscripts}</div><div class="label">Transcripts</div></div>
  `;
}

function renderCharts(stats) {
  const themeCtx = document.getElementById("chart-theme");
  const priorityCtx = document.getElementById("chart-priority");
  if (!themeCtx || !priorityCtx) return;

  const themeLabels = Object.keys(stats.themeCounts);
  const themeValues = Object.values(stats.themeCounts);
  const priorityLabels = Object.keys(stats.priorityCounts).filter((k) => stats.priorityCounts[k] > 0);
  const priorityValues = priorityLabels.map((k) => stats.priorityCounts[k]);

  const barColors = themeValues.map((_, i) => {
    const h = (220 + i * 25) % 360;
    return `hsla(${h}, 70%, 55%, 0.85)`;
  });
  const priorityColors = { High: "#f85149", Medium: "#d29922", Low: "#3fb950" };

  if (chartTheme) chartTheme.destroy();
  chartTheme = new Chart(themeCtx, {
    type: "bar",
    data: {
      labels: themeLabels,
      datasets: [{ label: "Signals", data: themeValues, backgroundColor: barColors }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: "rgba(45,58,77,0.6)" }, ticks: { color: "#8b9cb3" } },
        y: { grid: { display: false }, ticks: { color: "#e6edf3", font: { size: 11 } } },
      },
    },
  });

  if (chartPriority) chartPriority.destroy();
  chartPriority = new Chart(priorityCtx, {
    type: "doughnut",
    data: {
      labels: priorityLabels,
      datasets: [
        {
          data: priorityValues,
          backgroundColor: priorityLabels.map((k) => priorityColors[k] || "#58a6ff"),
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: "#e6edf3" } } },
    },
  });
}

function renderThemeTable(data) {
  const container = document.getElementById("theme-list");
  if (!container) return;

  function themeSignalCount(rawList) {
    return rawList.reduce((s, item) => {
      for (const arr of Object.values(item || {})) s += (Array.isArray(arr) ? arr.length : 0);
      return s;
    }, 0);
  }
  const sortedThemes = Object.entries(data).sort((a, b) => themeSignalCount(b[1]) - themeSignalCount(a[1]));

  container.innerHTML = sortedThemes
    .map(([canonical, rawList]) => {
      let total = 0;
      const rawBlocks = [];
      for (const item of rawList) {
        if (typeof item !== "object" || item === null) continue;
        for (const [rawTheme, signals] of Object.entries(item)) {
          if (!Array.isArray(signals)) continue;
          total += signals.length;
          const items = signals
            .filter((s) => s && typeof s === "object")
            .map(
              (s) =>
                `<li class="signal-item ${(s.priority || "medium").toLowerCase()}">
                <div class="ask">${escapeHtml(s.ask || "")}</div>
                <div class="meta">${escapeHtml(s.transcript_title || s.transcript_id || "")}${s.started ? " · " + escapeHtml(s.started) : ""}</div>
                ${s.evidence ? `<div class="evidence">${escapeHtml(s.evidence)}</div>` : ""}
              </li>`
            )
            .join("");
          rawBlocks.push(`<div class="raw-theme-row"><div class="raw-theme-name">${escapeHtml(rawTheme)}</div><ul class="signal-list">${items}</ul></div>`);
        }
      }
      return `
        <div class="theme-block" data-theme="${escapeAttr(canonical)}">
          <div class="theme-header">
            <span class="name">${escapeHtml(canonical)}</span>
            <span class="badge">${total} signals</span>
            <span class="toggle"></span>
          </div>
          <div class="theme-body">${rawBlocks.join("")}</div>
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".theme-header").forEach((el) => {
    el.addEventListener("click", () => el.closest(".theme-block").classList.toggle("open"));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadData() {
  let data = null;
  for (const path of DATA_PATHS) {
    try {
      const r = await fetch(path);
      if (r.ok) {
        data = await r.json();
        break;
      }
    } catch (_) {}
  }
  if (!data || typeof data !== "object") {
    document.getElementById("main-content").classList.add("hidden");
    const err = document.getElementById("error-msg");
    if (err) {
      err.classList.remove("hidden");
      err.textContent =
        "Could not load data. Run: python3 scripts/signal_pipeline/build_analysis.py --output-dir gong_signal_pipeline (after building signals_by_theme.json from final.json).";
    }
    return;
  }

  const stats = parseData(data);
  renderSummary(stats);
  renderCharts(stats);
  renderThemeTable(data);
  document.getElementById("loading").classList.add("hidden");
  document.getElementById("main-content").classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", loadData);
