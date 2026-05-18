const elements = {
  addReminder: document.querySelector("#add-reminder"),
  reminderList: document.querySelector("#reminder-list"),
  status: document.querySelector("#status")
};

let settings = normalizeSettings();
let openReminderId = "";

init();

async function init() {
  const state = await sendMessage({ type: "get-state" });

  if (!state.ok) {
    showStatus("Не получилось загрузить настройки.", true);
    return;
  }

  settings = normalizeSettings(state.settings);
  renderReminders();

  elements.addReminder.addEventListener("click", addCustomReminder);
}

function renderReminders() {
  elements.reminderList.replaceChildren();

  settings.reminders.forEach((reminder) => {
    elements.reminderList.append(createReminderCard(reminder));
  });
}

function createReminderCard(reminder) {
  const card = document.createElement("article");
  card.className = `reminder-card${openReminderId === reminder.id ? " is-open" : ""}`;
  card.dataset.id = reminder.id;

  const summary = document.createElement("div");
  summary.className = "reminder-summary";
  summary.tabIndex = 0;
  summary.setAttribute("role", "button");
  summary.setAttribute("aria-label", `Настроить напоминание ${reminder.title}`);
  summary.addEventListener("click", () => toggleDetails(reminder.id));
  summary.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleDetails(reminder.id);
    }
  });

  const emojiInput = document.createElement("input");
  emojiInput.className = "emoji-input";
  emojiInput.value = reminder.emoji;
  emojiInput.maxLength = 4;
  emojiInput.setAttribute("aria-label", "Иконка напоминания");
  emojiInput.addEventListener("click", stopEvent);
  emojiInput.addEventListener("input", () => updateReminder(reminder.id, { emoji: emojiInput.value.trim() || "✨" }));

  const summaryText = document.createElement("div");
  summaryText.className = "summary-text";

  const title = document.createElement("strong");
  title.textContent = reminder.title;

  const interval = document.createElement("span");
  interval.textContent = `Раз в ${reminder.intervalMinutes} мин.`;

  summaryText.append(title, interval);

  const switchLabel = document.createElement("label");
  switchLabel.className = "switch";
  switchLabel.addEventListener("click", stopEvent);

  const switchInput = document.createElement("input");
  switchInput.type = "checkbox";
  switchInput.checked = reminder.isEnabled;
  switchInput.setAttribute("aria-label", "Включить напоминание");
  switchInput.addEventListener("change", () => toggleReminder(reminder.id, switchInput.checked));

  const switchTrack = document.createElement("span");
  switchTrack.className = "switch-track";

  switchLabel.append(switchInput, switchTrack);
  summary.append(emojiInput, summaryText, switchLabel);

  const details = document.createElement("div");
  details.className = "reminder-details";

  const titleLabel = createField("Заголовок", "input", reminder.title);
  const subtitleLabel = createField("Текст", "textarea", reminder.subtitle);
  const intervalLabel = createField("Интервал, минут", "input", reminder.intervalMinutes);
  const intervalInput = intervalLabel.field;
  intervalInput.type = "number";
  intervalInput.min = "1";
  intervalInput.max = "1440";
  intervalInput.step = "1";

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const saveButton = document.createElement("button");
  saveButton.className = "primary";
  saveButton.type = "button";
  saveButton.textContent = "Сохранить";
  saveButton.addEventListener("click", () => saveCard(reminder.id, {
    title: titleLabel.field.value.trim(),
    subtitle: subtitleLabel.field.value.trim(),
    intervalMinutes: intervalInput.value
  }));

  const testButton = document.createElement("button");
  testButton.type = "button";
  testButton.textContent = "Проверить";
  testButton.addEventListener("click", () => testReminder(reminder.id));

  actions.append(saveButton, testButton);
  details.append(titleLabel.wrapper, subtitleLabel.wrapper, intervalLabel.wrapper, actions);
  card.append(summary, details);

  return card;
}

function createField(labelText, fieldType, value) {
  const wrapper = document.createElement("label");
  const label = document.createElement("span");
  const field = document.createElement(fieldType);

  label.textContent = labelText;
  field.value = value;

  wrapper.append(label, field);
  return { wrapper, field };
}

async function addCustomReminder() {
  const reminder = createCustomReminder();
  settings.reminders = [reminder, ...settings.reminders];
  openReminderId = reminder.id;
  await persistSettings("Добавлено свое напоминание.");
  renderReminders();
}

async function toggleDetails(reminderId) {
  openReminderId = openReminderId === reminderId ? "" : reminderId;
  renderReminders();
}

async function toggleReminder(reminderId, isEnabled) {
  updateReminder(reminderId, { isEnabled });
  await persistSettings(isEnabled ? "Напоминание включено." : "Напоминание выключено.");
  renderReminders();
}

async function saveCard(reminderId, changes) {
  updateReminder(reminderId, changes);
  openReminderId = "";
  await persistSettings("Сохранено.");
  renderReminders();
}

async function testReminder(reminderId) {
  const response = await sendMessage({ type: "test-reminder", reminderId });

  if (!response.ok) {
    showStatus("Не получилось показать проверку.", true);
    return;
  }

  showStatus("Проверочное напоминание отправлено.");
}

function updateReminder(reminderId, changes) {
  settings.reminders = settings.reminders.map((reminder) => {
    if (reminder.id !== reminderId) {
      return reminder;
    }

    return cloneReminder({
      ...reminder,
      ...changes
    });
  });
}

async function persistSettings(message) {
  const response = await sendMessage({ type: "save-settings", settings });

  if (!response.ok) {
    showStatus("Не получилось сохранить.", true);
    return;
  }

  settings = normalizeSettings(response.settings);
  showStatus(message);
}

function stopEvent(event) {
  event.stopPropagation();
}

function showStatus(text, isError = false) {
  elements.status.textContent = text;
  elements.status.classList.toggle("is-error", isError);
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}
