const STORAGE_KEY = "aucklandExplorerPlaces";

const CATEGORIES = [
  "Breakfast/Brunch",
  "Coffee",
  "Bakery",
  "Lunch",
  "Dinner",
  "Bar",
  "Activities",
];

const CATEGORY_COLORS = {
  "Breakfast/Brunch": "#f59e0b",
  Coffee: "#78350f",
  Bakery: "#db2777",
  Lunch: "#16a34a",
  Dinner: "#7c3aed",
  Bar: "#dc2626",
  Activities: "#2563eb",
};

const AUCKLAND_CENTER = [-36.8485, 174.7633];

// Approximate pins so the map view isn't empty on first load — feel free to
// correct/delete these once you've added your own places.
const SEED_PLACES = [
  { id: "seed-1", name: "Federal Delicatessen", suburb: "Auckland CBD", category: "Breakfast/Brunch", notes: "Classic American-style diner brunch.", lat: -36.8519, lng: 174.7615 },
  { id: "seed-2", name: "Best Ugly Bagels", suburb: "Ponsonby", category: "Bakery", notes: "", lat: -36.8558, lng: 174.7449 },
  { id: "seed-3", name: "Ozone Coffee Roasters", suburb: "Britomart", category: "Coffee", notes: "", lat: -36.8442, lng: 174.7679 },
  { id: "seed-4", name: "Cocoro", suburb: "Mount Eden", category: "Dinner", notes: "Japanese, book ahead.", lat: -36.8748, lng: 174.7637 },
  { id: "seed-5", name: "Cheese Barrel", suburb: "Kingsland", category: "Bar", notes: "Wine and cheese, good for a wind-down.", lat: -36.8697, lng: 174.7434 },
  { id: "seed-6", name: "Mission Bay Beach", suburb: "Mission Bay", category: "Activities", notes: "Walk along the waterfront.", lat: -36.8477, lng: 174.8253 },
];

function loadPlaces() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePlaces(places) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
}

let places = loadPlaces();
if (places === null) {
  places = SEED_PLACES;
  savePlaces(places);
}

function getSuburbs() {
  const suburbs = new Set(places.map((p) => p.suburb));
  return [...suburbs].sort((a, b) => a.localeCompare(b));
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `place-${Date.now()}-${Math.random()}`;
}

function addTileLayer(map) {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);
}

const form = document.getElementById("place-form");
const nameInput = document.getElementById("place-name");
const suburbInput = document.getElementById("place-suburb");
const suburbSuggestionsEl = document.getElementById("place-suburb-suggestions");
const notesInput = document.getElementById("place-notes");

const placesListEl = document.getElementById("places-list");
const placesCountEl = document.getElementById("places-count");

const listViewEl = document.getElementById("list-view");
const mapViewEl = document.getElementById("map-view");
const viewListBtn = document.getElementById("view-list-btn");
const viewMapBtn = document.getElementById("view-map-btn");
const mapUnpinnedNoteEl = document.getElementById("map-unpinned-note");

let currentView = "list";

// --- Custom dropdown component ---
// Replaces native <select> so the open menu can be styled to match the
// site, instead of looking like the browser's own select/autofill UI.

const openDropdowns = new Set();

document.addEventListener("click", (event) => {
  for (const dropdown of openDropdowns) {
    if (!dropdown.el.contains(event.target)) dropdown.close();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    for (const dropdown of openDropdowns) dropdown.close();
  }
});

function createDropdown({ containerEl, onChange }) {
  const toggleEl = containerEl.querySelector(".dropdown-toggle");
  const labelEl = toggleEl.querySelector(".dropdown-toggle-label");
  const menuEl = containerEl.querySelector(".dropdown-menu");
  let currentValue = null;
  let labels = new Map();

  const dropdown = {
    el: containerEl,
    open() {
      menuEl.hidden = false;
      containerEl.classList.add("open");
      toggleEl.setAttribute("aria-expanded", "true");
      openDropdowns.add(dropdown);
    },
    close() {
      menuEl.hidden = true;
      containerEl.classList.remove("open");
      toggleEl.setAttribute("aria-expanded", "false");
      openDropdowns.delete(dropdown);
    },
    setOptions(options) {
      labels = new Map(options.map((option) => [option.value, option.label]));
      menuEl.innerHTML = "";
      for (const option of options) {
        const item = document.createElement("li");
        item.textContent = option.label;
        item.setAttribute("role", "option");
        item.dataset.value = option.value;
        if (option.value === currentValue) item.classList.add("active");
        item.addEventListener("click", () => dropdown.select(option.value));
        menuEl.appendChild(item);
      }
    },
    select(value, { silent = false } = {}) {
      currentValue = value;
      if (labels.has(value)) labelEl.textContent = labels.get(value);
      for (const item of menuEl.children) {
        item.classList.toggle("active", item.dataset.value === value);
      }
      dropdown.close();
      if (!silent) onChange(value);
    },
    reset(placeholderText) {
      currentValue = null;
      labelEl.textContent = placeholderText;
      for (const item of menuEl.children) item.classList.remove("active");
    },
    get value() {
      return currentValue;
    },
  };

  toggleEl.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menuEl.hidden) dropdown.open();
    else dropdown.close();
  });

  return dropdown;
}

const categoryDropdown = createDropdown({
  containerEl: document.getElementById("place-category-dropdown"),
  onChange: () => categoryDropdown.el.classList.remove("invalid"),
});

const filterSuburbDropdown = createDropdown({
  containerEl: document.getElementById("filter-suburb-dropdown"),
  onChange: render,
});

const filterCategoryDropdown = createDropdown({
  containerEl: document.getElementById("filter-category-dropdown"),
  onChange: render,
});

const sortDropdown = createDropdown({
  containerEl: document.getElementById("sort-dropdown"),
  onChange: render,
});

function populateCategoryOptions() {
  const categoryOptions = CATEGORIES.map((category) => ({ value: category, label: category }));
  categoryDropdown.setOptions(categoryOptions);
  filterCategoryDropdown.setOptions([{ value: "", label: "All categories" }, ...categoryOptions]);
  filterCategoryDropdown.select("", { silent: true });
}

function populateSortOptions() {
  sortDropdown.setOptions([
    { value: "suburb", label: "Suburb (A–Z)" },
    { value: "name", label: "Name (A–Z)" },
    { value: "category", label: "Category (A–Z)" },
    { value: "newest", label: "Newest first" },
  ]);
  sortDropdown.select("suburb", { silent: true });
}

function refreshSuburbControls() {
  const suburbs = getSuburbs();
  const previousFilterValue = filterSuburbDropdown.value;

  filterSuburbDropdown.setOptions([
    { value: "", label: "All suburbs" },
    ...suburbs.map((suburb) => ({ value: suburb, label: suburb })),
  ]);

  if (previousFilterValue && suburbs.includes(previousFilterValue)) {
    filterSuburbDropdown.select(previousFilterValue, { silent: true });
  } else {
    filterSuburbDropdown.select("", { silent: true });
  }
}

function getFilteredPlaces() {
  const suburbFilter = filterSuburbDropdown.value;
  const categoryFilter = filterCategoryDropdown.value;

  const filtered = places
    .filter((p) => !suburbFilter || p.suburb === suburbFilter)
    .filter((p) => !categoryFilter || p.category === categoryFilter);

  switch (sortDropdown.value) {
    case "name":
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    case "category":
      return filtered.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    case "newest":
      // Places are always added to the end of the list, so the existing
      // order is already oldest-to-newest — reversing it is enough.
      return filtered.reverse();
    case "suburb":
    default:
      return filtered.sort((a, b) => a.suburb.localeCompare(b.suburb) || a.name.localeCompare(b.name));
  }
}

function render() {
  const filtered = getFilteredPlaces();
  placesCountEl.textContent = `${filtered.length} place${filtered.length === 1 ? "" : "s"}`;

  if (currentView === "list") {
    renderListView(filtered);
  } else {
    renderMapView(filtered);
  }
}

function renderListView(filtered) {
  placesListEl.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No places match those filters yet.";
    placesListEl.appendChild(empty);
    return;
  }

  for (const place of filtered) {
    placesListEl.appendChild(buildPlaceCard(place));
  }
}

function buildPlaceCard(place) {
  const card = document.createElement("div");
  card.className = "place-card";

  const info = document.createElement("div");
  info.className = "place-info";

  const name = document.createElement("h3");
  name.textContent = place.name;
  info.appendChild(name);

  const tags = document.createElement("div");
  tags.className = "place-tags";
  tags.appendChild(makeTag(place.suburb));
  tags.appendChild(makeTag(place.category));
  info.appendChild(tags);

  if (place.notes) {
    const notes = document.createElement("p");
    notes.className = "place-notes";
    notes.textContent = place.notes;
    info.appendChild(notes);
  }

  const actions = document.createElement("div");
  actions.className = "place-actions";

  const locationBtn = document.createElement("button");
  locationBtn.className = "location-btn";
  locationBtn.textContent = hasLocation(place) ? "📍 Update location" : "📍 Set location";
  locationBtn.addEventListener("click", () => openLocationModal(place));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => deletePlace(place.id));

  actions.appendChild(locationBtn);
  actions.appendChild(deleteBtn);

  card.appendChild(info);
  card.appendChild(actions);
  return card;
}

function makeTag(text) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = text;
  return tag;
}

function hasLocation(place) {
  return typeof place.lat === "number" && typeof place.lng === "number";
}

function deletePlace(id) {
  places = places.filter((p) => p.id !== id);
  savePlaces(places);
  refreshSuburbControls();
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const category = categoryDropdown.value;
  if (!category) {
    categoryDropdown.el.classList.add("invalid");
    categoryDropdown.el.querySelector(".dropdown-toggle").focus();
    return;
  }

  const newPlace = {
    id: makeId(),
    name: nameInput.value.trim(),
    suburb: suburbInput.value.trim(),
    category,
    notes: notesInput.value.trim(),
    lat: addPlacePendingLocation ? addPlacePendingLocation.lat : null,
    lng: addPlacePendingLocation ? addPlacePendingLocation.lng : null,
  };

  if (!newPlace.name || !newPlace.suburb) return;

  places.push(newPlace);
  savePlaces(places);

  form.reset();
  categoryDropdown.reset("Choose a category");
  suburbSuggestionsEl.hidden = true;
  clearAddPlacePin();
  refreshSuburbControls();
  render();
});

// --- Suburb autocomplete, replacing the native <datalist> ---
// (suggestions are computed live from suburbs already in use, so there's
// no separate list to keep in sync)

function updateSuburbSuggestions() {
  const query = suburbInput.value.trim().toLowerCase();
  const suburbs = getSuburbs();
  // With nothing typed yet, show every suburb in use (like clicking open a
  // dropdown); once typing starts, narrow it down. Free text is always still
  // allowed — suburbs aren't limited to this list.
  const matches = query ? suburbs.filter((suburb) => suburb.toLowerCase().includes(query)) : suburbs;

  suburbSuggestionsEl.innerHTML = "";

  if (matches.length === 0) {
    suburbSuggestionsEl.hidden = true;
    return;
  }

  for (const suburb of matches) {
    const item = document.createElement("li");
    item.textContent = suburb;
    item.setAttribute("role", "option");
    // mousedown (rather than click) fires before the input blurs, so we
    // can fill the value in without the suggestions list disappearing first
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      suburbInput.value = suburb;
      suburbSuggestionsEl.hidden = true;
    });
    suburbSuggestionsEl.appendChild(item);
  }

  suburbSuggestionsEl.hidden = false;
}

suburbInput.addEventListener("input", updateSuburbSuggestions);
suburbInput.addEventListener("focus", updateSuburbSuggestions);
suburbInput.addEventListener("click", updateSuburbSuggestions);
suburbInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") suburbSuggestionsEl.hidden = true;
});
suburbInput.addEventListener("blur", () => {
  suburbSuggestionsEl.hidden = true;
});

viewListBtn.addEventListener("click", () => setView("list"));
viewMapBtn.addEventListener("click", () => setView("map"));

function setView(view) {
  currentView = view;
  viewListBtn.classList.toggle("active", view === "list");
  viewMapBtn.classList.toggle("active", view === "map");
  listViewEl.hidden = view !== "list";
  mapViewEl.hidden = view !== "map";
  render();
}

// --- Address/place search, using OpenStreetMap's free Nominatim service ---
// (biased towards the greater Auckland area, but not restricted to it)
const AUCKLAND_VIEWBOX = "174.5,-36.65,175.05,-37.05";

async function geocodeSearch(query) {
  const params = new URLSearchParams({
    format: "json",
    q: query,
    limit: "5",
    viewbox: AUCKLAND_VIEWBOX,
    countrycodes: "nz",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!response.ok) throw new Error("Search request failed");
  return response.json();
}

function setStatusMessage(resultsEl, message) {
  resultsEl.innerHTML = "";
  const item = document.createElement("li");
  item.className = "search-status";
  item.textContent = message;
  resultsEl.appendChild(item);
}

function setupLocationSearch({ inputEl, buttonEl, resultsEl, onSelect }) {
  let requestId = 0;

  async function runSearch() {
    const query = inputEl.value.trim();
    if (!query) {
      resultsEl.innerHTML = "";
      return;
    }

    const thisRequestId = ++requestId;
    setStatusMessage(resultsEl, "Searching…");

    let results;
    try {
      results = await geocodeSearch(query);
    } catch {
      if (thisRequestId === requestId) {
        setStatusMessage(resultsEl, "Hmm, that search didn't work — check your internet connection and try again.");
      }
      return;
    }

    if (thisRequestId !== requestId) return;

    if (results.length === 0) {
      setStatusMessage(resultsEl, "Couldn't find that one — try just the street name, or click the map instead.");
      return;
    }

    resultsEl.innerHTML = "";
    for (const result of results) {
      const item = document.createElement("li");
      item.textContent = result.display_name;
      item.addEventListener("click", () => {
        onSelect(Number(result.lat), Number(result.lon));
        resultsEl.innerHTML = "";
      });
      resultsEl.appendChild(item);
    }
  }

  buttonEl.addEventListener("click", runSearch);
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }
  });
}

// --- Map: pick a location when adding a new place ---

const addPlaceMap = L.map("add-place-map").setView(AUCKLAND_CENTER, 12);
addTileLayer(addPlaceMap);

let addPlaceMarker = null;
let addPlacePendingLocation = null;

addPlaceMap.on("click", (event) => {
  addPlacePendingLocation = { lat: event.latlng.lat, lng: event.latlng.lng };
  setMarker(addPlaceMap, addPlaceMarker, addPlacePendingLocation, (marker) => (addPlaceMarker = marker));
});

document.getElementById("add-place-clear-pin").addEventListener("click", clearAddPlacePin);

setupLocationSearch({
  inputEl: document.getElementById("add-place-search-input"),
  buttonEl: document.getElementById("add-place-search-btn"),
  resultsEl: document.getElementById("add-place-search-results"),
  onSelect: (lat, lng) => {
    addPlacePendingLocation = { lat, lng };
    addPlaceMap.setView([lat, lng], 16);
    setMarker(addPlaceMap, addPlaceMarker, addPlacePendingLocation, (marker) => (addPlaceMarker = marker));
  },
});

function clearAddPlacePin() {
  addPlacePendingLocation = null;
  if (addPlaceMarker) {
    addPlaceMap.removeLayer(addPlaceMarker);
    addPlaceMarker = null;
  }
  document.getElementById("add-place-search-input").value = "";
  document.getElementById("add-place-search-results").innerHTML = "";
}

function setMarker(map, existingMarker, location, onCreated) {
  if (existingMarker) {
    map.removeLayer(existingMarker);
  }
  const marker = L.marker([location.lat, location.lng]).addTo(map);
  onCreated(marker);
}

// --- Map: set/update a location for an existing place, via a modal ---

const locationModal = document.getElementById("location-modal");
const modalPlaceNameEl = document.getElementById("modal-place-name");
const modalSaveBtn = document.getElementById("modal-save-btn");
const modalClearBtn = document.getElementById("modal-clear-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const modalSearchInput = document.getElementById("modal-search-input");
const modalSearchResults = document.getElementById("modal-search-results");

let modalMap = null;
let modalMarker = null;
let modalLocation = null;
let modalPlaceId = null;

setupLocationSearch({
  inputEl: modalSearchInput,
  buttonEl: document.getElementById("modal-search-btn"),
  resultsEl: modalSearchResults,
  onSelect: (lat, lng) => {
    modalLocation = { lat, lng };
    modalMap.setView([lat, lng], 16);
    setMarker(modalMap, modalMarker, modalLocation, (marker) => (modalMarker = marker));
  },
});

function openLocationModal(place) {
  modalPlaceId = place.id;
  modalLocation = hasLocation(place) ? { lat: place.lat, lng: place.lng } : null;
  modalPlaceNameEl.textContent = place.name;
  modalSearchInput.value = "";
  modalSearchResults.innerHTML = "";
  locationModal.hidden = false;

  if (!modalMap) {
    modalMap = L.map("modal-map");
    addTileLayer(modalMap);
    modalMap.on("click", (event) => {
      modalLocation = { lat: event.latlng.lat, lng: event.latlng.lng };
      setMarker(modalMap, modalMarker, modalLocation, (marker) => (modalMarker = marker));
    });
  }

  const center = modalLocation ?? { lat: AUCKLAND_CENTER[0], lng: AUCKLAND_CENTER[1] };
  modalMap.setView([center.lat, center.lng], modalLocation ? 15 : 12);

  if (modalMarker) {
    modalMap.removeLayer(modalMarker);
    modalMarker = null;
  }
  if (modalLocation) {
    setMarker(modalMap, modalMarker, modalLocation, (marker) => (modalMarker = marker));
  }

  // The modal (and its map) is hidden until now, so Leaflet needs a moment
  // after it becomes visible before it can measure its size correctly.
  setTimeout(() => modalMap.invalidateSize(), 50);
}

function closeLocationModal() {
  locationModal.hidden = true;
  modalPlaceId = null;
}

modalCancelBtn.addEventListener("click", closeLocationModal);

modalClearBtn.addEventListener("click", () => {
  modalLocation = null;
  if (modalMarker) {
    modalMap.removeLayer(modalMarker);
    modalMarker = null;
  }
});

modalSaveBtn.addEventListener("click", () => {
  const place = places.find((p) => p.id === modalPlaceId);
  if (place) {
    place.lat = modalLocation ? modalLocation.lat : null;
    place.lng = modalLocation ? modalLocation.lng : null;
    savePlaces(places);
    render();
  }
  closeLocationModal();
});

// --- Map: browse view showing pins for the currently filtered places ---

const categoryIcons = new Map();

function getCategoryIcon(category) {
  if (!categoryIcons.has(category)) {
    const color = CATEGORY_COLORS[category] || "#1f6f5c";
    categoryIcons.set(
      category,
      L.divIcon({
        className: "category-pin",
        html: `<svg width="25" height="34" viewBox="0 0 25 34" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 34 12.5 34S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}" stroke="#fff" stroke-width="1.5" />
          <circle cx="12.5" cy="12.5" r="5" fill="#fff" />
        </svg>`,
        iconSize: [25, 34],
        iconAnchor: [12.5, 34],
        popupAnchor: [0, -30],
      })
    );
  }
  return categoryIcons.get(category);
}

function populateMapLegend() {
  const legendEl = document.getElementById("map-legend");
  legendEl.innerHTML = "";
  for (const category of CATEGORIES) {
    const item = document.createElement("span");
    item.className = "map-legend-item";

    const dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.background = CATEGORY_COLORS[category];

    item.appendChild(dot);
    item.appendChild(document.createTextNode(category));
    legendEl.appendChild(item);
  }
}

let browseMap = null;
let browseMarkers = [];

function renderMapView(filtered) {
  if (!browseMap) {
    browseMap = L.map("browse-map").setView(AUCKLAND_CENTER, 12);
    addTileLayer(browseMap);
  }
  setTimeout(() => browseMap.invalidateSize(), 50);

  for (const marker of browseMarkers) {
    browseMap.removeLayer(marker);
  }
  browseMarkers = [];

  const withLocation = filtered.filter(hasLocation);

  for (const place of withLocation) {
    const marker = L.marker([place.lat, place.lng], { icon: getCategoryIcon(place.category) }).addTo(browseMap);
    marker.bindPopup(buildPopupContent(place));
    browseMarkers.push(marker);
  }

  const withoutCount = filtered.length - withLocation.length;
  mapUnpinnedNoteEl.textContent =
    withoutCount > 0
      ? `${withoutCount} place${withoutCount === 1 ? "" : "s"} without a pinned location aren't shown on the map.`
      : "";

  if (withLocation.length > 0) {
    browseMap.fitBounds(
      withLocation.map((p) => [p.lat, p.lng]),
      { padding: [30, 30], maxZoom: 15 }
    );
  }
}

function buildPopupContent(place) {
  const wrapper = document.createElement("div");

  const name = document.createElement("strong");
  name.textContent = place.name;
  wrapper.appendChild(name);

  wrapper.appendChild(document.createElement("br"));
  wrapper.appendChild(document.createTextNode(`${place.suburb} · ${place.category}`));

  if (place.notes) {
    wrapper.appendChild(document.createElement("br"));
    const notes = document.createElement("span");
    notes.textContent = place.notes;
    wrapper.appendChild(notes);
  }

  return wrapper;
}

populateCategoryOptions();
populateSortOptions();
populateMapLegend();
refreshSuburbControls();
render();
