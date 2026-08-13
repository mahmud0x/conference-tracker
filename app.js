const DATA_URL = "data/conferences.json";
const ALLOWED_CATEGORIES = new Set(["AI/ML", "Security", "SWE"]);
const ALLOWED_RANKS = new Set(["A*", "A", "B"]);
const RANK_ORDER = { "A*": 0, A: 1, B: 2 };

const state = {
  conferences: [],
  categories: new Set(ALLOWED_CATEGORIES),
  ranks: new Set(ALLOWED_RANKS),
  search: "",
  year: "all",
  deadline: "upcoming",
  sort: "deadline",
};

const el = {
  search: document.querySelector("#search"),
  categoryFilters: document.querySelector("#categoryFilters"),
  rankFilters: document.querySelector("#rankFilters"),
  yearFilter: document.querySelector("#yearFilter"),
  deadlineFilter: document.querySelector("#deadlineFilter"),
  resetFilters: document.querySelector("#resetFilters"),
  conferenceBody: document.querySelector("#conferenceBody"),
  emptyState: document.querySelector("#emptyState"),
  errorState: document.querySelector("#errorState"),
  resultText: document.querySelector("#resultText"),
  aStarCount: document.querySelector("#aStarCount"),
  closingSoonCount: document.querySelector("#closingSoonCount"),
  snapshotDate: document.querySelector("#snapshotDate"),
  sortButtons: [...document.querySelectorAll(".sort-button")],
};

function parseDate(value) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dayDiff(value) {
  const date = parseDate(value);
  if (!date) return null;
  return Math.ceil((date - startOfToday()) / 86400000);
}

function formatDate(value, includeYear = true) {
  const date = parseDate(value);
  if (!date) return "TBA";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
}

function formatSnapshot(value) {
  const date = parseDate(value);
  if (!date) return "latest sync";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatConferenceDates(start, end) {
  if (!start && !end) return "TBA";
  if (!start || start === end) return formatDate(start || end);
  if (!end) return formatDate(start);

  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return `${formatDate(start)} – ${formatDate(end)}`;

  if (startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()) {
    const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(startDate);
    return `${month} ${startDate.getDate()}–${endDate.getDate()}, ${endDate.getFullYear()}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function deadlineStatus(deadline) {
  const days = dayDiff(deadline);
  if (days === null) return "unknown";
  return days >= 0 ? "upcoming" : "passed";
}

function deadlinePill(deadline) {
  const days = dayDiff(deadline);
  if (days === null) return { label: "TBA", className: "" };
  if (days === 0) return { label: "today", className: "soon" };
  if (days > 0 && days <= 30) return { label: `${days}d`, className: "soon" };
  if (days > 30) return { label: `${days}d`, className: "" };
  return { label: "passed", className: "passed" };
}

function categoryLabel(category) {
  if (category === "AI/ML") return "AI / ML";
  if (category === "SWE") return "Software";
  return category;
}

function locationLabel(location = {}) {
  return [location.city, location.country].filter(Boolean).join(", ") || "TBA";
}

function normalizeConference(c) {
  return {
    ...c,
    rank: c?.core_ranking?.rank ?? null,
    deadline: c?.dates?.submission_deadline ?? null,
    startDate: c?.dates?.start ?? null,
    endDate: c?.dates?.end ?? null,
  };
}

function buildYearOptions(conferences) {
  const years = [...new Set(conferences.map(c => c.year).filter(Boolean))].sort((a, b) => a - b);
  for (const year of years) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    el.yearFilter.appendChild(option);
  }
}

function matchesSearch(c, query) {
  if (!query) return true;
  const haystack = [
    c.name,
    c.acronym,
    c.category,
    c.location?.city,
    c.location?.country,
    c.year,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function deadlineSortKey(c) {
  const date = parseDate(c.deadline);
  if (!date) return Number.MAX_SAFE_INTEGER - 1;
  const time = date.getTime();
  if (time < startOfToday().getTime()) return Number.MAX_SAFE_INTEGER;
  return time;
}

function filteredConferences() {
  const result = state.conferences.filter(c => {
    if (!state.categories.has(c.category)) return false;
    if (!state.ranks.has(c.rank)) return false;
    if (state.year !== "all" && String(c.year) !== state.year) return false;
    if (state.deadline !== "all" && deadlineStatus(c.deadline) !== state.deadline) return false;
    return matchesSearch(c, state.search);
  });

  return result.sort((a, b) => {
    if (state.sort === "name") {
      return (a.acronym || a.name || "").localeCompare(b.acronym || b.name || "");
    }
    if (state.sort === "rank") {
      return (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99) || deadlineSortKey(a) - deadlineSortKey(b);
    }
    if (state.sort === "date") {
      const aTime = parseDate(a.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = parseDate(b.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime || (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99);
    }
    return deadlineSortKey(a) - deadlineSortKey(b) || (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99);
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rowHTML(c) {
  const title = c.acronym || c.name || "Unnamed conference";
  const fullName = c.name && c.name !== title ? c.name : "";
  const officialUrl = /^https?:\/\//i.test(c.url || "") ? c.url : "";
  const pill = deadlinePill(c.deadline);
  const rate = Number.isFinite(c.acceptance_rate) ? `${c.acceptance_rate}%` : "—";

  return `
    <tr>
      <td data-label="Venue">
        ${officialUrl
          ? `<a class="venue-link" href="${escapeHTML(officialUrl)}" target="_blank" rel="noreferrer">${escapeHTML(title)}${c.year ? ` ${escapeHTML(String(c.year))}` : ""}<span class="external">↗</span></a>`
          : `<span class="venue-link">${escapeHTML(title)}${c.year ? ` ${escapeHTML(String(c.year))}` : ""}</span>`}
        ${fullName ? `<div class="venue-name" title="${escapeHTML(fullName)}">${escapeHTML(fullName)}</div>` : ""}
      </td>
      <td data-label="Rank"><span class="rank-badge" data-rank="${escapeHTML(c.rank)}">${escapeHTML(c.rank)}</span></td>
      <td data-label="Area"><span class="area-label">${escapeHTML(categoryLabel(c.category))}</span></td>
      <td data-label="Deadline">
        <div class="deadline-wrap">
          <span class="deadline-date">${escapeHTML(c.deadline ? formatDate(c.deadline) : "TBA")}</span>
          <span class="deadline-pill ${pill.className}">${escapeHTML(pill.label)}</span>
        </div>
      </td>
      <td data-label="Conference"><span class="date-main">${escapeHTML(formatConferenceDates(c.startDate, c.endDate))}</span></td>
      <td data-label="Location"><span class="location-main">${escapeHTML(locationLabel(c.location))}</span></td>
      <td data-label="Acceptance"><span class="acceptance-main">${escapeHTML(rate)}</span></td>
    </tr>
  `;
}

function updateSummary(visible) {
  el.resultText.textContent = `${visible.length} conference${visible.length === 1 ? "" : "s"}`;
  el.aStarCount.textContent = visible.filter(c => c.rank === "A*").length.toLocaleString();
  el.closingSoonCount.textContent = visible.filter(c => {
    const days = dayDiff(c.deadline);
    return days !== null && days >= 0 && days <= 30;
  }).length.toLocaleString();
}

function updateSortButtons() {
  for (const button of el.sortButtons) {
    const active = button.dataset.sort === state.sort;
    button.classList.toggle("active", active);
    const indicator = button.querySelector("span");
    if (indicator) indicator.textContent = active ? "↑" : "↕";
  }
}

function render() {
  const visible = filteredConferences();
  updateSummary(visible);
  updateSortButtons();
  el.conferenceBody.innerHTML = visible.map(rowHTML).join("");
  el.emptyState.hidden = visible.length !== 0;
}

function toggleFilter(button, set, key) {
  if (set.has(key)) set.delete(key);
  else set.add(key);
  const active = set.has(key);
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
  render();
}

function bindEvents() {
  el.search.addEventListener("input", event => {
    state.search = event.target.value.trim();
    render();
  });

  el.categoryFilters.addEventListener("click", event => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    toggleFilter(button, state.categories, button.dataset.category);
  });

  el.rankFilters.addEventListener("click", event => {
    const button = event.target.closest("button[data-rank]");
    if (!button) return;
    toggleFilter(button, state.ranks, button.dataset.rank);
  });

  el.yearFilter.addEventListener("change", event => {
    state.year = event.target.value;
    render();
  });

  el.deadlineFilter.addEventListener("change", event => {
    state.deadline = event.target.value;
    render();
  });

  for (const button of el.sortButtons) {
    button.addEventListener("click", () => {
      state.sort = button.dataset.sort;
      render();
    });
  }

  el.resetFilters.addEventListener("click", () => {
    state.search = "";
    state.year = "all";
    state.deadline = "upcoming";
    state.sort = "deadline";
    state.categories = new Set(ALLOWED_CATEGORIES);
    state.ranks = new Set(ALLOWED_RANKS);

    el.search.value = "";
    el.yearFilter.value = "all";
    el.deadlineFilter.value = "upcoming";
    document.querySelectorAll(".toggle").forEach(button => {
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
    });
    render();
  });
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const raw = Array.isArray(data) ? data : data.conferences;
    if (!Array.isArray(raw)) throw new Error("Unexpected JSON format: conferences array not found");

    state.conferences = raw
      .map(normalizeConference)
      .filter(c => ALLOWED_CATEGORIES.has(c.category) && ALLOWED_RANKS.has(c.rank));

    buildYearOptions(state.conferences);

    const snapshot = data?.metadata?.pruned_at || data?.pruned_at || data?.metadata?.generated_at || null;
    el.snapshotDate.textContent = formatSnapshot(snapshot);

    bindEvents();
    render();
  } catch (error) {
    console.error(error);
    el.resultText.textContent = "Data unavailable";
    el.errorState.hidden = false;
    document.querySelector(".conference-table").hidden = true;
  }
}

loadData();
