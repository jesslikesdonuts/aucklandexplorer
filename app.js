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

const SEED_PLACES = [
  { id: "seed-1", name: "Federal Delicatessen", suburb: "Auckland CBD", category: "Breakfast/Brunch", notes: "Classic American-style diner brunch." },
  { id: "seed-2", name: "Best Ugly Bagels", suburb: "Ponsonby", category: "Bakery", notes: "" },
  { id: "seed-3", name: "Ozone Coffee Roasters", suburb: "Britomart", category: "Coffee", notes: "" },
  { id: "seed-4", name: "Cocoro", suburb: "Mount Eden", category: "Dinner", notes: "Japanese, book ahead." },
  { id: "seed-5", name: "Cheese Barrel", suburb: "Kingsland", category: "Bar", notes: "Wine and cheese, good for a wind-down." },
  { id: "seed-6", name: "Mission Bay Beach", suburb: "Mission Bay", category: "Activities", notes: "Walk along the waterfront." },
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

function renderPlaces() {
  const suburbFilter = filterSuburbSelect.value;
  const categoryFilter = filterCategorySelect.value;

  const filtered = places
    .filter((p) => !suburbFilter || p.suburb === suburbFilter)
    .filter((p) => !categoryFilter || p.category === categoryFilter)
    .sort((a, b) => a.suburb.localeCompare(b.suburb) || a.name.localeCompare(b.name));

  placesCountEl.textContent = `${filtered.length} place${filtered.length === 1 ? "" : "s"}`;

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

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => deletePlace(place.id));

  card.appendChild(info);
  card.appendChild(deleteBtn);
  return card;
}

function makeTag(text) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = text;
  return tag;
}

function deletePlace(id) {
  places = places.filter((p) => p.id !== id);
  savePlaces(places);
  refreshSuburbControls();
  renderPlaces();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const newPlace = {
    id: makeId(),
    name: nameInput.value.trim(),
    suburb: suburbInput.value.trim(),
    category: categorySelect.value,
    notes: notesInput.value.trim(),
  };

  if (!newPlace.name || !newPlace.suburb || !newPlace.category) return;

  places.push(newPlace);
  savePlaces(places);

  form.reset();
  refreshSuburbControls();
  renderPlaces();
});

filterSuburbSelect.addEventListener("change", renderPlaces);
filterCategorySelect.addEventListener("change", renderPlaces);

populateCategoryOptions();
refreshSuburbControls();
renderPlaces();
