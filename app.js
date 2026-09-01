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
const categorySelect = document.getElementById("place-category");
const notesInput = document.getElementById("place-notes");
const suburbSuggestions = document.getElementById("suburb-suggestions");

const filterSuburbSelect = document.getElementById("filter-suburb");
const filterCategorySelect = document.getElementById("filter-category");
const placesListEl = document.getElementById("places-list");
const placesCountEl = document.getElementById("places-count");

const listViewEl = document.getElementById("list-view");
const mapViewEl = document.getElementById("map-view");
const viewListBtn = document.getElementById("view-list-btn");
const viewMapBtn = document.getElementById("view-map-btn");
const mapUnpinnedNoteEl = document.getElementById("map-unpinned-note");

let currentView = "list";

function populateCategoryOptions() {
  for (const category of CATEGORIES) {
    const formOption = document.createElement("option");
    formOption.value = category;
    formOption.textContent = category;
    categorySelect.appendChild(formOption);

    const filterOption = document.createElement("option");
    filterOption.value = category;
    filterOption.textContent = category;
    filterCategorySelect.appendChild(filterOption);
  }
}

function refreshSuburbControls() {
  const suburbs = getSuburbs();
  const previousFilterValue = filterSuburbSelect.value;

  suburbSuggestions.innerHTML = "";
  for (const suburb of suburbs) {
    const option = document.createElement("option");
    option.value = suburb;
    suburbSuggestions.appendChild(option);
  }

  filterSuburbSelect.innerHTML = '<option value="">All suburbs</option>';
  for (const suburb of suburbs) {
    const option = document.createElement("option");
    option.value = suburb;
    option.textContent = suburb;
    filterSuburbSelect.appendChild(option);
  }

  if (suburbs.includes(previousFilterValue)) {
    filterSuburbSelect.value = previousFilterValue;
  }
}

function getFilteredPlaces() {
  const suburbFilter = filterSuburbSelect.value;
  const categoryFilter = filterCategorySelect.value;

  return places
    .filter((p) => !suburbFilter || p.suburb === suburbFilter)
    .filter((p) => !categoryFilter || p.category === categoryFilter)
    .sort((a, b) => a.suburb.localeCompare(b.suburb) || a.name.localeCompare(b.name));
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

  const newPlace = {
    id: makeId(),
    name: nameInput.value.trim(),
    suburb: suburbInput.value.trim(),
    category: categorySelect.value,
    notes: notesInput.value.trim(),
    lat: addPlacePendingLocation ? addPlacePendingLocation.lat : null,
    lng: addPlacePendingLocation ? addPlacePendingLocation.lng : null,
  };

  if (!newPlace.name || !newPlace.suburb || !newPlace.category) return;

  places.push(newPlace);
  savePlaces(places);

  form.reset();
  clearAddPlacePin();
  refreshSuburbControls();
  render();
});

filterSuburbSelect.addEventListener("change", render);
filterCategorySelect.addEventListener("change", render);

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
        setStatusMessage(resultsEl, "Search failed. Check your connection and try again.");
      }
      return;
    }

    if (thisRequestId !== requestId) return;

    if (results.length === 0) {
      setStatusMessage(resultsEl, "No matches found.");
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
    const marker = L.marker([place.lat, place.lng]).addTo(browseMap);
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
refreshSuburbControls();
render();
