(() => {
  "use strict";

  const ITEM_KEY = "myCalendar.v2.items";
  const NOTE_KEY = "myCalendar.v2.dayNotes";
  const THEME_KEY = "myCalendar.v2.theme";
  const MIGRATION_KEY = "myCalendar.v2.legacyMigrated";
  const ITEM_TYPES = ["birthday", "holiday", "shift", "event", "note"];
  const TYPE_LABELS = {
    birthday: "Birthday",
    holiday: "Holiday",
    shift: "Work shift",
    event: "Event",
    note: "Daily note",
  };

  const elements = {
    monthHeading: document.querySelector("#month-heading"),
    mobileMonthHeading: document.querySelector("#mobile-month-heading"),
    calendarGrid: document.querySelector("#calendar-grid"),
    agendaTitle: document.querySelector("#agenda-title"),
    agendaDate: document.querySelector("#agenda-date"),
    daySummary: document.querySelector("#day-summary"),
    agendaList: document.querySelector("#agenda-list"),
    quickNote: document.querySelector("#quick-note"),
    noteStatus: document.querySelector("#note-status"),
    search: document.querySelector("#calendar-search"),
    dialog: document.querySelector("#item-dialog"),
    form: document.querySelector("#item-form"),
    dialogEyebrow: document.querySelector("#dialog-eyebrow"),
    dialogTitle: document.querySelector("#dialog-title"),
    itemId: document.querySelector("#item-id"),
    itemTitle: document.querySelector("#item-title"),
    itemType: document.querySelector("#item-type"),
    itemDate: document.querySelector("#item-date"),
    startTime: document.querySelector("#start-time"),
    endTime: document.querySelector("#end-time"),
    allDay: document.querySelector("#all-day"),
    repeatAnnual: document.querySelector("#repeat-annual"),
    itemDetails: document.querySelector("#item-details"),
    birthdayRepeatField: document.querySelector("#birthday-repeat-field"),
    shiftPresetField: document.querySelector("#shift-preset-field"),
    shiftPreset: document.querySelector("#shift-preset"),
    deleteItem: document.querySelector("#delete-item"),
    dataButton: document.querySelector("#data-button"),
    dataMenu: document.querySelector("#data-menu"),
    importInput: document.querySelector("#import-input"),
    toast: document.querySelector("#toast"),
  };

  const today = startOfDay(new Date());
  let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let selectedDate = today;
  let items = readJson(ITEM_KEY, []);
  let dayNotes = readJson(NOTE_KEY, {});
  let activeTypes = new Set(ITEM_TYPES);
  let searchQuery = "";
  let toastTimer;
  let noteTimer;

  migrateLegacyData();
  applySavedTheme();
  bindControls();
  render();

  function bindControls() {
    document.querySelector("#previous-month").addEventListener("click", () => changeMonth(-1));
    document.querySelector("#mobile-previous-month").addEventListener("click", () => changeMonth(-1));
    document.querySelector("#next-month").addEventListener("click", () => changeMonth(1));
    document.querySelector("#mobile-next-month").addEventListener("click", () => changeMonth(1));
    document.querySelector("#today-button").addEventListener("click", goToToday);
    document.querySelector("#add-item-button").addEventListener("click", () => openItemForm(toKey(selectedDate)));
    document.querySelector("#add-selected-button").addEventListener("click", () => openItemForm(toKey(selectedDate)));
    document.querySelector("#theme-button").addEventListener("click", toggleTheme);
    document.querySelector("#close-dialog").addEventListener("click", closeDialog);
    document.querySelector("#cancel-dialog").addEventListener("click", closeDialog);
    document.querySelector("#export-button").addEventListener("click", exportBackup);
    document.querySelector("#clear-button").addEventListener("click", clearAllData);

    elements.dataButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = elements.dataMenu.hidden;
      elements.dataMenu.hidden = !willOpen;
      elements.dataButton.setAttribute("aria-expanded", String(willOpen));
    });

    document.addEventListener("click", (event) => {
      if (!elements.dataMenu.hidden && !elements.dataMenu.contains(event.target)) {
        elements.dataMenu.hidden = true;
        elements.dataButton.setAttribute("aria-expanded", "false");
      }
    });

    elements.dataMenu.addEventListener("click", (event) => event.stopPropagation());
    elements.importInput.addEventListener("change", importBackup);

    document.querySelectorAll(".filter-pill").forEach((button) => {
      button.addEventListener("click", () => updateFilter(button));
    });

    elements.search.addEventListener("input", () => {
      searchQuery = elements.search.value.trim().toLocaleLowerCase("en-GB");
      renderCalendar();
      renderAgenda();
    });

    elements.quickNote.addEventListener("input", () => {
      elements.noteStatus.textContent = "Saving…";
      window.clearTimeout(noteTimer);
      noteTimer = window.setTimeout(saveQuickNote, 320);
    });

    elements.itemType.addEventListener("change", () => {
      setTypeDefaults(elements.itemType.value);
      updateFormVisibility();
    });

    elements.allDay.addEventListener("change", updateTimeFields);
    elements.shiftPreset.addEventListener("change", applyShiftPreset);
    elements.form.addEventListener("submit", saveItemFromForm);
    elements.deleteItem.addEventListener("click", deleteCurrentItem);

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "n") {
        event.preventDefault();
        openItemForm(toKey(selectedDate));
      } else if (!isTyping && event.key.toLocaleLowerCase() === "t") {
        goToToday();
      }
    });
  }

  function render() {
    renderCalendar();
    renderAgenda();
    loadQuickNote();
  }

  function renderCalendar() {
    const monthText = new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
    }).format(visibleMonth);

    elements.monthHeading.textContent = monthText;
    elements.mobileMonthHeading.textContent = monthText;
    document.title = `${monthText} · My Calendar`;
    elements.calendarGrid.replaceChildren();

    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = addDays(firstDay, -mondayOffset);

    for (let index = 0; index < 42; index += 1) {
      const date = addDays(gridStart, index);
      elements.calendarGrid.append(createDayCell(date));
    }
  }

  function createDayCell(date) {
    const key = toKey(date);
    const cell = document.createElement("div");
    const outside = date.getMonth() !== visibleMonth.getMonth();
    const isToday = isSameDay(date, today);
    const isSelected = isSameDay(date, selectedDate);
    const dateItems = filteredItemsForDate(date);

    cell.className = [
      "day-cell",
      outside ? "outside" : "",
      isToday ? "today" : "",
      isSelected ? "selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    cell.dataset.date = key;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-selected", String(isSelected));
    cell.setAttribute(
      "aria-label",
      `${formatLongDate(date)}${dateItems.length ? `, ${dateItems.length} item${dateItems.length === 1 ? "" : "s"}` : ""}`,
    );
    cell.tabIndex = isSelected ? 0 : -1;

    const head = document.createElement("div");
    head.className = "cell-head";

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = String(date.getDate());

    const addButton = document.createElement("button");
    addButton.className = "cell-add";
    addButton.type = "button";
    addButton.textContent = "+";
    addButton.setAttribute("aria-label", `Add item on ${formatLongDate(date)}`);
    addButton.addEventListener("click", (event) => {
      event.stopPropagation();
      selectDate(date);
      openItemForm(key);
    });

    head.append(number, addButton);
    cell.append(head);

    const itemContainer = document.createElement("div");
    itemContainer.className = "cell-items";

    dateItems.slice(0, 3).forEach((item) => {
      itemContainer.append(createCalendarItem(item));
    });

    if (dateItems.length > 3) {
      const moreButton = document.createElement("button");
      moreButton.className = "more-items";
      moreButton.type = "button";
      moreButton.textContent = `+${dateItems.length - 3} more`;
      moreButton.addEventListener("click", (event) => {
        event.stopPropagation();
        selectDate(date);
        elements.agendaList.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      itemContainer.append(moreButton);
    }

    cell.append(itemContainer);
    cell.addEventListener("click", () => selectDate(date, outside));
    cell.addEventListener("dblclick", () => openItemForm(key));
    cell.addEventListener("keydown", (event) => handleCellKeydown(event, date));
    return cell;
  }

  function createCalendarItem(item) {
    const button = document.createElement("button");
    button.className = `calendar-item ${item.type}`;
    button.type = "button";
    button.title = `${TYPE_LABELS[item.type]}: ${item.title}`;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openItemForm(item.date, item);
    });

    const dot = document.createElement("span");
    dot.className = `dot ${item.type}`;
    dot.setAttribute("aria-hidden", "true");

    const title = document.createElement("span");
    title.className = "item-title";
    title.textContent = item.title;

    button.append(dot, title);

    if (!item.allDay && item.start) {
      const time = document.createElement("span");
      time.className = "item-time";
      time.textContent = item.start;
      button.append(time);
    }
    return button;
  }

  function renderAgenda() {
    const dateItems = filteredItemsForDate(selectedDate);
    const headingText = isSameDay(selectedDate, today)
      ? "Today"
      : new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(selectedDate);
    elements.agendaTitle.textContent = headingText;
    elements.agendaDate.textContent = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(selectedDate);

    renderDaySummary(dateItems);
    elements.agendaList.replaceChildren();

    if (dateItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-agenda";
      const inner = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = searchQuery ? "No matching items" : "This day is clear";
      const text = document.createElement("span");
      text.textContent = searchQuery
        ? "Try a different search or switch a filter back on."
        : "Add an event, shift, birthday, holiday or note.";
      inner.append(strong, text);
      empty.append(inner);
      elements.agendaList.append(empty);
      return;
    }

    dateItems.forEach((item) => elements.agendaList.append(createAgendaItem(item)));
  }

  function renderDaySummary(dateItems) {
    elements.daySummary.replaceChildren();
    if (dateItems.length === 0) {
      elements.daySummary.textContent = "No scheduled items";
      return;
    }

    const counts = ITEM_TYPES.map((type) => ({
      type,
      count: dateItems.filter((item) => item.type === type).length,
    })).filter((entry) => entry.count > 0);

    counts.forEach(({ type, count }) => {
      const chip = document.createElement("span");
      chip.className = "summary-chip";
      const dot = document.createElement("i");
      dot.className = `dot ${type}`;
      const text = document.createElement("span");
      text.textContent = `${count} ${count === 1 ? TYPE_LABELS[type] : pluralLabel(type)}`;
      chip.append(dot, text);
      elements.daySummary.append(chip);
    });
  }

  function createAgendaItem(item) {
    const article = document.createElement("article");
    article.className = "agenda-item";

    const time = document.createElement("div");
    time.className = "agenda-time";
    const primaryTime = document.createElement("strong");
    primaryTime.textContent = item.allDay || !item.start ? "All day" : item.start;
    time.append(primaryTime);
    if (!item.allDay && item.end) {
      const end = document.createElement("span");
      end.textContent = `to ${item.end}`;
      time.append(end);
    }

    const content = document.createElement("div");
    content.className = "agenda-content";
    const title = document.createElement("h3");
    title.textContent = item.title;
    content.append(title);

    if (item.details) {
      const details = document.createElement("p");
      details.textContent = item.details;
      content.append(details);
    }

    const badge = document.createElement("span");
    badge.className = `type-badge ${item.type}`;
    badge.textContent = TYPE_LABELS[item.type];
    content.append(badge);

    const edit = document.createElement("button");
    edit.className = "agenda-edit";
    edit.type = "button";
    edit.textContent = "✎";
    edit.setAttribute("aria-label", `Edit ${item.title}`);
    edit.addEventListener("click", () => openItemForm(item.date, item));

    article.append(time, content, edit);
    return article;
  }

  function selectDate(date, moveToMonth = false) {
    selectedDate = startOfDay(date);
    if (moveToMonth) {
      visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    }
    render();
  }

  function handleCellKeydown(event, date) {
    const movements = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key in movements) {
      event.preventDefault();
      selectDate(addDays(date, movements[event.key]), true);
      requestAnimationFrame(() => {
        document.querySelector(`[data-date="${toKey(selectedDate)}"]`)?.focus();
      });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectDate(date, date.getMonth() !== visibleMonth.getMonth());
    } else if (event.key.toLocaleLowerCase() === "a") {
      event.preventDefault();
      openItemForm(toKey(date));
    }
  }

  function changeMonth(amount) {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1);
    selectedDate = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    render();
  }

  function goToToday() {
    visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    selectedDate = today;
    render();
  }

  function openItemForm(dateKey, item = null) {
    elements.form.reset();
    elements.itemId.value = item?.id ?? "";
    elements.itemDate.value = item?.date ?? dateKey;
    elements.itemType.value = item?.type ?? "event";
    elements.itemTitle.value = item?.title ?? "";
    elements.startTime.value = item?.start ?? "";
    elements.endTime.value = item?.end ?? "";
    elements.allDay.checked = item?.allDay ?? false;
    elements.repeatAnnual.checked = item?.repeatAnnual ?? true;
    elements.itemDetails.value = item?.details ?? "";
    elements.shiftPreset.value = item?.shiftPreset ?? "";
    elements.deleteItem.hidden = !item;
    elements.dialogEyebrow.textContent = item ? "Edit calendar item" : "New calendar item";
    elements.dialogTitle.textContent = item ? item.title : "Add item";

    if (!item) {
      setTypeDefaults(elements.itemType.value, false);
    }
    updateFormVisibility();
    elements.dialog.showModal();
    requestAnimationFrame(() => elements.itemTitle.focus());
  }

  function closeDialog() {
    elements.dialog.close();
  }

  function updateFormVisibility() {
    const type = elements.itemType.value;
    elements.birthdayRepeatField.hidden = type !== "birthday";
    elements.shiftPresetField.hidden = type !== "shift";
    updateTimeFields();
  }

  function setTypeDefaults(type, updateTitle = true) {
    if (type === "birthday" || type === "holiday" || type === "note") {
      elements.allDay.checked = true;
    } else {
      elements.allDay.checked = false;
    }

    if (type === "birthday") {
      elements.repeatAnnual.checked = true;
    }

    if (updateTitle && !elements.itemTitle.value.trim()) {
      const defaults = {
        birthday: "Birthday",
        holiday: "Holiday",
        shift: "Work shift",
        event: "",
        note: "",
      };
      elements.itemTitle.value = defaults[type];
    }
  }

  function updateTimeFields() {
    const disabled = elements.allDay.checked;
    document.querySelectorAll(".time-field").forEach((field) => {
      field.hidden = disabled;
    });
    elements.startTime.disabled = disabled;
    elements.endTime.disabled = disabled;
  }

  function applyShiftPreset() {
    const preset = elements.shiftPreset.value;
    const presets = {
      morning: { title: "Morning shift", start: "07:00", end: "15:00", allDay: false },
      afternoon: { title: "Afternoon shift", start: "15:00", end: "23:00", allDay: false },
      night: { title: "Night shift", start: "23:00", end: "07:00", allDay: false },
      extra: { title: "Extra shift", start: "", end: "", allDay: false },
      leave: { title: "Leave", start: "", end: "", allDay: true },
    };

    if (!presets[preset]) return;
    const values = presets[preset];
    elements.itemTitle.value = values.title;
    elements.startTime.value = values.start;
    elements.endTime.value = values.end;
    elements.allDay.checked = values.allDay;
    updateTimeFields();
  }

  function saveItemFromForm(event) {
    event.preventDefault();
    if (!elements.form.reportValidity()) return;

    const existingId = elements.itemId.value;
    const item = {
      id: existingId || createId(),
      type: ITEM_TYPES.includes(elements.itemType.value) ? elements.itemType.value : "event",
      title: elements.itemTitle.value.trim(),
      date: elements.itemDate.value,
      start: elements.allDay.checked ? "" : elements.startTime.value,
      end: elements.allDay.checked ? "" : elements.endTime.value,
      allDay: elements.allDay.checked,
      repeatAnnual: elements.itemType.value === "birthday" && elements.repeatAnnual.checked,
      shiftPreset: elements.itemType.value === "shift" ? elements.shiftPreset.value : "",
      details: elements.itemDetails.value.trim(),
      createdAt:
        items.find((entry) => entry.id === existingId)?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingId) {
      items = items.map((entry) => (entry.id === existingId ? item : entry));
    } else {
      items.push(item);
    }

    writeJson(ITEM_KEY, items);
    selectedDate = parseKey(item.date);
    visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    closeDialog();
    render();
    showToast(existingId ? "Item updated" : "Item added");
  }

  function deleteCurrentItem() {
    const id = elements.itemId.value;
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;

    items = items.filter((entry) => entry.id !== id);
    writeJson(ITEM_KEY, items);
    closeDialog();
    render();
    showToast("Item deleted");
  }

  function updateFilter(button) {
    const type = button.dataset.filter;
    if (type === "all") {
      activeTypes = new Set(ITEM_TYPES);
    } else if (activeTypes.has(type)) {
      activeTypes.delete(type);
    } else {
      activeTypes.add(type);
    }

    document.querySelectorAll(".filter-pill").forEach((filterButton) => {
      const filterType = filterButton.dataset.filter;
      const active =
        filterType === "all" ? activeTypes.size === ITEM_TYPES.length : activeTypes.has(filterType);
      filterButton.classList.toggle("active", active);
      filterButton.setAttribute("aria-pressed", String(active));
    });

    renderCalendar();
    renderAgenda();
  }

  function filteredItemsForDate(date) {
    return itemsForDate(date)
      .filter((item) => activeTypes.has(item.type))
      .filter((item) => {
        if (!searchQuery) return true;
        return `${item.title} ${item.details} ${TYPE_LABELS[item.type]}`
          .toLocaleLowerCase("en-GB")
          .includes(searchQuery);
      })
      .sort(compareItems);
  }

  function itemsForDate(date) {
    const key = toKey(date);
    return items.filter((item) => {
      if (item.type === "birthday" && item.repeatAnnual) {
        const original = parseKey(item.date);
        return original.getMonth() === date.getMonth() && original.getDate() === date.getDate();
      }
      return item.date === key;
    });
  }

  function compareItems(a, b) {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    if ((a.start || "") !== (b.start || "")) return (a.start || "").localeCompare(b.start || "");
    return a.title.localeCompare(b.title, "en-GB");
  }

  function loadQuickNote() {
    const key = toKey(selectedDate);
    elements.quickNote.value = typeof dayNotes[key] === "string" ? dayNotes[key] : "";
    elements.quickNote.setAttribute("aria-label", `Quick note for ${formatLongDate(selectedDate)}`);
    elements.noteStatus.textContent = "Saved";
  }

  function saveQuickNote() {
    const key = toKey(selectedDate);
    const value = elements.quickNote.value;
    if (value.trim()) {
      dayNotes[key] = value;
    } else {
      delete dayNotes[key];
    }
    writeJson(NOTE_KEY, dayNotes);
    elements.noteStatus.textContent = "Saved";
  }

  function exportBackup() {
    const backup = {
      app: "My Calendar",
      version: 2,
      exportedAt: new Date().toISOString(),
      items,
      dayNotes,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my-calendar-backup-${toKey(today)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    elements.dataMenu.hidden = true;
    elements.dataButton.setAttribute("aria-expanded", "false");
    showToast("Backup exported");
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.items) || typeof data.dayNotes !== "object") {
        throw new Error("Invalid backup");
      }
      if (!window.confirm("Importing this backup will replace the current calendar data. Continue?")) {
        return;
      }
      items = data.items.filter(isValidItem).map(normaliseItem);
      dayNotes = data.dayNotes ?? {};
      writeJson(ITEM_KEY, items);
      writeJson(NOTE_KEY, dayNotes);
      render();
      showToast("Backup imported");
    } catch {
      showToast("That file is not a valid My Calendar backup");
    }
  }

  function clearAllData() {
    elements.dataMenu.hidden = true;
    elements.dataButton.setAttribute("aria-expanded", "false");
    if (!window.confirm("Delete all calendar items and daily notes from this device?")) return;
    items = [];
    dayNotes = {};
    localStorage.removeItem(ITEM_KEY);
    localStorage.removeItem(NOTE_KEY);
    render();
    showToast("All calendar data cleared");
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
  }

  function applySavedTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const preferredDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = saved || (preferredDark ? "dark" : "light");
  }

  function migrateLegacyData() {
    if (localStorage.getItem(MIGRATION_KEY) === "true") {
      items = Array.isArray(items) ? items.map(normaliseItem).filter(isValidItem) : [];
      return;
    }

    const migrated = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);
      if (!storageKey || (!storageKey.startsWith("shifts-") && !storageKey.startsWith("birthdays-"))) {
        continue;
      }

      const legacy = readJson(storageKey, {});
      Object.entries(legacy).forEach(([legacyDate, value]) => {
        const date = normaliseLegacyDate(legacyDate);
        if (!date) return;

        if (storageKey.startsWith("shifts-") && value && typeof value === "object") {
          const shiftName = capitalise(String(value.type || "work"));
          migrated.push({
            id: createId(),
            type: "shift",
            title: value.type === "leave" ? "Leave" : `${shiftName} shift`,
            date,
            start: "",
            end: "",
            allDay: value.type === "leave",
            repeatAnnual: false,
            shiftPreset: value.type || "",
            details: value.timing ? `Original timing: ${value.timing}` : "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        if (storageKey.startsWith("birthdays-") && typeof value === "string" && value.trim()) {
          migrated.push({
            id: createId(),
            type: "birthday",
            title: `${value.trim()}'s birthday`,
            date,
            start: "",
            end: "",
            allDay: true,
            repeatAnnual: true,
            shiftPreset: "",
            details: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      });
    }

    if (migrated.length) {
      const signatures = new Set(items.map((item) => `${item.type}|${item.date}|${item.title}`));
      migrated.forEach((item) => {
        const signature = `${item.type}|${item.date}|${item.title}`;
        if (!signatures.has(signature)) {
          items.push(item);
          signatures.add(signature);
        }
      });
      writeJson(ITEM_KEY, items);
    }
    localStorage.setItem(MIGRATION_KEY, "true");
  }

  function normaliseLegacyDate(value) {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
    if (!match) return "";
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? "" : toKey(date);
  }

  function isValidItem(item) {
    return (
      item &&
      typeof item.id === "string" &&
      ITEM_TYPES.includes(item.type) &&
      typeof item.title === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    );
  }

  function normaliseItem(item) {
    return {
      id: String(item.id || createId()),
      type: ITEM_TYPES.includes(item.type) ? item.type : "event",
      title: String(item.title || "Untitled"),
      date: String(item.date || toKey(today)),
      start: String(item.start || ""),
      end: String(item.end || ""),
      allDay: Boolean(item.allDay),
      repeatAnnual: Boolean(item.repeatAnnual),
      shiftPreset: String(item.shiftPreset || ""),
      details: String(item.details || ""),
      createdAt: String(item.createdAt || new Date().toISOString()),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
    };
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      showToast("This browser could not save the latest change");
    }
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 2600);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, amount) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function toKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatLongDate(date) {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function pluralLabel(type) {
    const labels = {
      birthday: "birthdays",
      holiday: "holidays",
      shift: "work shifts",
      event: "events",
      note: "daily notes",
    };
    return labels[type];
  }

  function capitalise(value) {
    return value ? value.charAt(0).toLocaleUpperCase("en-GB") + value.slice(1) : value;
  }

  function createId() {
    return window.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
})();
