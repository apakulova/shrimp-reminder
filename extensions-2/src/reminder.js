const titleElement = document.querySelector("#title");
const subtitleElement = document.querySelector("#subtitle");
const emojiElement = document.querySelector("#emoji");
const doneButton = document.querySelector("#done");
const snoozeButton = document.querySelector("#snooze");

loadReminder();

doneButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "complete-reminder" });
  window.close();
});

snoozeButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "snooze-reminder" });
  window.close();
});

window.addEventListener("beforeunload", () => {
  chrome.runtime.sendMessage({ type: "stop-sound" });
});

async function loadReminder() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.activeReminder);
  const reminder = cloneReminder(result[STORAGE_KEYS.activeReminder] || DEFAULT_SETTINGS.reminder);

  titleElement.textContent = reminder.title;
  subtitleElement.textContent = reminder.subtitle;
  emojiElement.textContent = reminder.emoji;
}
