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
  { id: "seed-1", name: "Federal Delicatessen", suburb: "Auckland CBD", categories: ["Breakfast/Brunch"], notes: "Classic American-style diner brunch.", lat: -36.8519, lng: 174.7615 },
  { id: "seed-2", name: "Best Ugly Bagels", suburb: "Ponsonby", categories: ["Bakery"], notes: "", lat: -36.8558, lng: 174.7449 },
  { id: "seed-3", name: "Ozone Coffee Roasters", suburb: "Britomart", categories: ["Coffee"], notes: "", lat: -36.8442, lng: 174.7679 },
  { id: "seed-4", name: "Cocoro", suburb: "Mount Eden", categories: ["Dinner"], notes: "Japanese, book ahead.", lat: -36.8748, lng: 174.7637 },
  { id: "seed-5", name: "Cheese Barrel", suburb: "Kingsland", categories: ["Bar"], notes: "Wine and cheese, good for a wind-down.", lat: -36.8697, lng: 174.7434 },
  { id: "seed-6", name: "Mission Bay Beach", suburb: "Mission Bay", categories: ["Activities"], notes: "Walk along the waterfront.", lat: -36.8477, lng: 174.8253 },
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

// Places used to have a single `category` string. Older saved data may
// still be in that shape, so convert it to a `categories` array on load.
function migrateToCategoriesArray(rawPlaces) {
  let changed = false;
  const migrated = rawPlaces.map((place) => {
    if (Array.isArray(place.categories)) return place;
    changed = true;
    const { category, ...rest } = place;
    return { ...rest, categories: category ? [category] : [] };
  });
  return { migrated, changed };
}

let places = loadPlaces();
if (places === null) {
  places = SEED_PLACES;
  savePlaces(places);
} else {
  const { migrated, changed } = migrateToCategoriesArray(places);
  places = migrated;
  if (changed) savePlaces(places);
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
  let optionValues = [];
  let activeIndex = -1;

  function setActiveIndex(index) {
    const items = menuEl.children;
    if (items.length === 0) return;
    activeIndex = (index + items.length) % items.length;
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle("highlighted", i === activeIndex);
    }
    items[activeIndex].scrollIntoView({ block: "nearest" });
  }

  const dropdown = {
    el: containerEl,
    open() {
      menuEl.hidden = false;
      containerEl.classList.add("open");
      toggleEl.setAttribute("aria-expanded", "true");
      openDropdowns.add(dropdown);
      const selectedIndex = optionValues.indexOf(currentValue);
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    },
    close() {
      menuEl.hidden = true;
      containerEl.classList.remove("open");
      toggleEl.setAttribute("aria-expanded", "false");
      openDropdowns.delete(dropdown);
      activeIndex = -1;
    },
    setOptions(options) {
      labels = new Map(options.map((option) => [option.value, option.label]));
      optionValues = options.map((option) => option.value);
      menuEl.innerHTML = "";
      for (const option of options) {
        const item = document.createElement("li");
        item.textContent = option.label;
        item.setAttribute("role", "option");
        item.dataset.value = option.value;
        if (option.value === currentValue) item.classList.add("active");
        // mousedown (rather than click), with preventDefault, stops the
        // browser's default focus-shifting away from the toggle button —
        // otherwise that blur fires first and the blur-to-close handler
        // below hides the menu before the click can land on it.
        item.addEventListener("mousedown", (event) => {
          event.preventDefault();
          dropdown.select(option.value);
        });
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
      toggleEl.focus();
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

  // Tabbing away from an open dropdown should close it rather than leaving
  // it dangling open (a click on an option doesn't move focus off the
  // button, so this doesn't interfere with mouse selection).
  toggleEl.addEventListener("blur", () => dropdown.close());

  // Keyboard support: arrow keys move a highlighted option (focus stays on
  // the toggle button throughout, the same way a native <select> works),
  // Enter picks the highlighted one.
  toggleEl.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (menuEl.hidden) dropdown.open();
      else setActiveIndex(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (menuEl.hidden) dropdown.open();
      else setActiveIndex(activeIndex - 1);
    } else if (event.key === "Home" && !menuEl.hidden) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && !menuEl.hidden) {
      event.preventDefault();
      setActiveIndex(optionValues.length - 1);
    } else if ((event.key === "Enter" || event.key === " ") && !menuEl.hidden) {
      event.preventDefault();
      if (activeIndex >= 0) dropdown.select(optionValues[activeIndex]);
    }
  });

  return dropdown;
}

// A checkbox-style variant of the dropdown above, for picking more than one
// option at once (used for a place's categories). The menu stays open after
// each pick so multiple options can be toggled in one go.
function createMultiSelectDropdown({ containerEl, placeholderText, onChange }) {
  const toggleEl = containerEl.querySelector(".dropdown-toggle");
  const labelEl = toggleEl.querySelector(".dropdown-toggle-label");
  const menuEl = containerEl.querySelector(".dropdown-menu");
  let labels = new Map();
  let optionValues = [];
  let selected = new Set();
  let activeIndex = -1;

  function setActiveIndex(index) {
    const items = menuEl.children;
    if (items.length === 0) return;
    activeIndex = (index + items.length) % items.length;
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle("highlighted", i === activeIndex);
    }
    items[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function updateLabel() {
    const chosenLabels = optionValues.filter((value) => selected.has(value)).map((value) => labels.get(value));
    if (chosenLabels.length === 0) labelEl.textContent = placeholderText;
    else if (chosenLabels.length <= 2) labelEl.textContent = chosenLabels.join(", ");
    else labelEl.textContent = `${chosenLabels.length} categories selected`;
  }

  const dropdown = {
    el: containerEl,
    open() {
      menuEl.hidden = false;
      containerEl.classList.add("open");
      toggleEl.setAttribute("aria-expanded", "true");
      openDropdowns.add(dropdown);
      setActiveIndex(0);
    },
    close() {
      menuEl.hidden = true;
      containerEl.classList.remove("open");
      toggleEl.setAttribute("aria-expanded", "false");
      openDropdowns.delete(dropdown);
      activeIndex = -1;
    },
    setOptions(options) {
      labels = new Map(options.map((option) => [option.value, option.label]));
      optionValues = options.map((option) => option.value);
      menuEl.innerHTML = "";
      for (const option of options) {
        const item = document.createElement("li");
        item.setAttribute("role", "option");
        item.dataset.value = option.value;
        item.setAttribute("aria-selected", selected.has(option.value) ? "true" : "false");
        item.classList.toggle("active", selected.has(option.value));

        const checkbox = document.createElement("span");
        checkbox.className = "option-checkbox";
        item.appendChild(checkbox);
        item.appendChild(document.createTextNode(option.label));

        // mousedown (not click), same reasoning as the single-select
        // dropdown: it stops the browser shifting focus off the toggle
        // button before the pick registers.
        item.addEventListener("mousedown", (event) => {
          event.preventDefault();
          dropdown.toggleValue(option.value);
        });
        menuEl.appendChild(item);
      }
    },
    toggleValue(value) {
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      for (const item of menuEl.children) {
        const isSelected = selected.has(item.dataset.value);
        item.classList.toggle("active", isSelected);
        item.setAttribute("aria-selected", isSelected ? "true" : "false");
      }
      updateLabel();
      containerEl.classList.remove("invalid");
      onChange([...selected]);
    },
    setSelected(values) {
      selected = new Set(values);
      for (const item of menuEl.children) {
        const isSelected = selected.has(item.dataset.value);
        item.classList.toggle("active", isSelected);
        item.setAttribute("aria-selected", isSelected ? "true" : "false");
      }
      updateLabel();
    },
    reset() {
      dropdown.setSelected([]);
    },
    get value() {
      return optionValues.filter((value) => selected.has(value));
    },
  };

  toggleEl.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menuEl.hidden) dropdown.open();
    else dropdown.close();
  });

  toggleEl.addEventListener("blur", () => dropdown.close());

  toggleEl.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (menuEl.hidden) dropdown.open();
      else setActiveIndex(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (menuEl.hidden) dropdown.open();
      else setActiveIndex(activeIndex === -1 ? optionValues.length - 1 : activeIndex - 1);
    } else if (event.key === "Home" && !menuEl.hidden) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && !menuEl.hidden) {
      event.preventDefault();
      setActiveIndex(optionValues.length - 1);
    } else if ((event.key === "Enter" || event.key === " ") && !menuEl.hidden) {
      event.preventDefault();
      if (activeIndex >= 0) dropdown.toggleValue(optionValues[activeIndex]);
    } else if (event.key === "Escape" && !menuEl.hidden) {
      event.preventDefault();
      dropdown.close();
    }
  });

  updateLabel();
  return dropdown;
}

const categoryDropdown = createMultiSelectDropdown({
  containerEl: document.getElementById("place-category-dropdown"),
  placeholderText: "Choose categories",
  onChange: () => {},
});

const modalCategoryDropdown = createMultiSelectDropdown({
  containerEl: document.getElementById("modal-category-dropdown"),
  placeholderText: "Choose categories",
  onChange: () => {},
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
  modalCategoryDropdown.setOptions(categoryOptions);
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
    .filter((p) => !categoryFilter || p.categories.includes(categoryFilter));

  switch (sortDropdown.value) {
    case "name":
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    case "category":
      return filtered.sort((a, b) => a.categories[0].localeCompare(b.categories[0]) || a.name.localeCompare(b.name));
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

  // The whole info area is a button so it's keyboard-reachable (Tab) and
  // activatable (Enter/Space), not just clickable with a mouse.
  const info = document.createElement("button");
  info.type = "button";
  info.className = "place-info";
  info.addEventListener("click", () => openPlaceModal(place));

  const name = document.createElement("h3");
  name.textContent = place.name;
  info.appendChild(name);

  const tags = document.createElement("div");
  tags.className = "place-tags";
  tags.appendChild(makeTag(place.suburb));
  for (const category of place.categories) {
    tags.appendChild(makeTag(category));
  }
  info.appendChild(tags);

  if (place.notes) {
    const notes = document.createElement("p");
    notes.className = "place-notes";
    notes.textContent = place.notes;
    info.appendChild(notes);
  }

  const actions = document.createElement("div");
  actions.className = "place-actions";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", (event) => {
    // Stop this from also bubbling up as a card click, which would pop
    // open the details modal for a place we're about to remove.
    event.stopPropagation();
    deletePlace(place.id);
  });

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

  const categories = categoryDropdown.value;
  if (categories.length === 0) {
    categoryDropdown.el.classList.add("invalid");
    categoryDropdown.el.querySelector(".dropdown-toggle").focus();
    return;
  }

  const newPlace = {
    id: makeId(),
    name: nameInput.value.trim(),
    suburb: suburbInput.value.trim(),
    categories,
    notes: notesInput.value.trim(),
    lat: addPlacePendingLocation ? addPlacePendingLocation.lat : null,
    lng: addPlacePendingLocation ? addPlacePendingLocation.lng : null,
  };

  if (!newPlace.name || !newPlace.suburb) return;

  places.push(newPlace);
  savePlaces(places);

  form.reset();
  categoryDropdown.reset();
  suburbSuggestionsEl.hidden = true;
  clearAddPlacePin();
  refreshSuburbControls();
  render();
});

// --- Suburb autocomplete, replacing the native <datalist> ---
// (suggestions are computed live from suburbs already in use, so there's
// no separate list to keep in sync; used for both the add-place form and
// the edit-place modal)

function setupSuburbAutocomplete(inputEl, suggestionsEl) {
  let activeIndex = -1;

  function highlightItem(index) {
    const items = suggestionsEl.children;
    if (items.length === 0) {
      activeIndex = -1;
      return;
    }
    activeIndex = (index + items.length) % items.length;
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle("highlighted", i === activeIndex);
    }
    items[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function selectSuggestion(suburb) {
    inputEl.value = suburb;
    suggestionsEl.hidden = true;
    activeIndex = -1;
  }

  function updateSuggestions() {
    const query = inputEl.value.trim().toLowerCase();
    const suburbs = getSuburbs();
    // With nothing typed yet, show every suburb in use (like clicking open a
    // dropdown); once typing starts, narrow it down. Free text is always
    // still allowed — suburbs aren't limited to this list.
    const matches = query ? suburbs.filter((suburb) => suburb.toLowerCase().includes(query)) : suburbs;

    suggestionsEl.innerHTML = "";
    activeIndex = -1;

    if (matches.length === 0) {
      suggestionsEl.hidden = true;
      return;
    }

    for (const suburb of matches) {
      const item = document.createElement("li");
      item.textContent = suburb;
      item.setAttribute("role", "option");
      item.dataset.value = suburb;
      // mousedown (rather than click) fires before the input blurs, so we
      // can fill the value in without the suggestions list disappearing first
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectSuggestion(suburb);
      });
      suggestionsEl.appendChild(item);
    }

    suggestionsEl.hidden = false;
  }

  inputEl.addEventListener("input", updateSuggestions);
  inputEl.addEventListener("focus", updateSuggestions);
  inputEl.addEventListener("click", updateSuggestions);

  inputEl.addEventListener("keydown", (event) => {
    const suggestionsOpen = !suggestionsEl.hidden && suggestionsEl.children.length > 0;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (suggestionsOpen) highlightItem(activeIndex + 1);
      else updateSuggestions();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (suggestionsOpen) {
        const previousIndex = activeIndex === -1 ? suggestionsEl.children.length - 1 : activeIndex - 1;
        highlightItem(previousIndex);
      }
    } else if (event.key === "Enter" && suggestionsOpen) {
      // Prevent the Enter from also submitting the whole form — it should
      // only pick the highlighted suggestion (or just close the list).
      event.preventDefault();
      if (activeIndex >= 0) {
        selectSuggestion(suggestionsEl.children[activeIndex].dataset.value);
      } else {
        suggestionsEl.hidden = true;
      }
    } else if (event.key === "Escape") {
      suggestionsEl.hidden = true;
    }
  });

  inputEl.addEventListener("blur", () => {
    suggestionsEl.hidden = true;
  });
}

setupSuburbAutocomplete(suburbInput, suburbSuggestionsEl);

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

const placeModal = document.getElementById("place-modal");
const modalForm = document.getElementById("modal-form");
const modalNameInput = document.getElementById("modal-name");
const modalSuburbInput = document.getElementById("modal-suburb");
const modalSuburbSuggestionsEl = document.getElementById("modal-suburb-suggestions");
const modalNotesInput = document.getElementById("modal-notes");
const modalClearBtn = document.getElementById("modal-clear-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const modalSearchInput = document.getElementById("modal-search-input");
const modalSearchResults = document.getElementById("modal-search-results");

let modalMap = null;
let modalMarker = null;
let modalLocation = null;
let modalPlaceId = null;

setupSuburbAutocomplete(modalSuburbInput, modalSuburbSuggestionsEl);

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

function openPlaceModal(place) {
  modalPlaceId = place.id;
  modalNameInput.value = place.name;
  modalSuburbInput.value = place.suburb;
  modalNotesInput.value = place.notes || "";
  modalCategoryDropdown.setSelected(place.categories);
  modalCategoryDropdown.el.classList.remove("invalid");
  modalSuburbSuggestionsEl.hidden = true;

  modalLocation = hasLocation(place) ? { lat: place.lat, lng: place.lng } : null;
  modalSearchInput.value = "";
  modalSearchResults.innerHTML = "";
  placeModal.hidden = false;

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

function closePlaceModal() {
  placeModal.hidden = true;
  modalPlaceId = null;
}

modalCancelBtn.addEventListener("click", closePlaceModal);

modalClearBtn.addEventListener("click", () => {
  modalLocation = null;
  if (modalMarker) {
    modalMap.removeLayer(modalMarker);
    modalMarker = null;
  }
});

modalForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const categories = modalCategoryDropdown.value;
  if (categories.length === 0) {
    modalCategoryDropdown.el.classList.add("invalid");
    modalCategoryDropdown.el.querySelector(".dropdown-toggle").focus();
    return;
  }

  const name = modalNameInput.value.trim();
  const suburb = modalSuburbInput.value.trim();
  if (!name || !suburb) return;

  const place = places.find((p) => p.id === modalPlaceId);
  if (place) {
    place.name = name;
    place.suburb = suburb;
    place.categories = categories;
    place.notes = modalNotesInput.value.trim();
    place.lat = modalLocation ? modalLocation.lat : null;
    place.lng = modalLocation ? modalLocation.lng : null;
    savePlaces(places);
    refreshSuburbControls();
    render();
  }
  closePlaceModal();
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
    // A place can have several categories now; the pin just uses the first
    // one's color rather than trying to show all of them at once.
    const marker = L.marker([place.lat, place.lng], { icon: getCategoryIcon(place.categories[0]) }).addTo(browseMap);
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
  wrapper.appendChild(document.createTextNode(`${place.suburb} · ${place.categories.join(", ")}`));

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
