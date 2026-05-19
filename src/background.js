importScripts("common.js");

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
  await refreshSchedules(settings);
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await refreshSchedules(settings);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((response) => sendResponse(response))
    .catch((error) => {
      console.error(error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!isCareAlarm(alarm.name)) {
    return;
  }

  const reminderId = parseReminderIdFromAlarm(alarm.name);
  const settings = await getSettings();
  const reminder = settings.reminders.find((item) => item.id === reminderId);

  if (!reminder || !reminder.isEnabled) {
    return;
  }

  await showReminder(reminder, alarm.name);
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!isCareNotification(notificationId)) {
    return;
  }

  const reminderId = parseReminderIdFromNotification(notificationId);

  if (buttonIndex === 0) {
    await completeReminder(reminderId);
  }

  if (buttonIndex === 1) {
    await snoozeReminder(reminderId);
  }
});

chrome.notifications.onClosed.addListener(async (notificationId) => {
  if (isCareNotification(notificationId)) {
    await stopSound();
  }
});

async function handleMessage(message) {
  if (!message || typeof message.type !== "string") {
    return { ok: false };
  }

  if (message.type === "get-state") {
    return { ok: true, settings: await getSettings() };
  }

  if (message.type === "save-settings") {
    const settings = normalizeSettings(message.settings);
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
    await refreshSchedules(settings);
    return { ok: true, settings };
  }

  if (message.type === "test-reminder") {
    const settings = await getSettings();
    const reminder = settings.reminders.find((item) => item.id === message.reminderId) || settings.reminders[0];

    if (!reminder) {
      return { ok: false };
    }

    await showReminder(reminder, "test");
    return { ok: true };
  }

  if (message.type === "complete-reminder") {
    const activeReminder = await getActiveReminder();
    await completeReminder(activeReminder.id);
    return { ok: true };
  }

  if (message.type === "snooze-reminder") {
    const activeReminder = await getActiveReminder();
    await snoozeReminder(activeReminder.id);
    return { ok: true };
  }

  if (message.type === "stop-sound") {
    await stopSound();
    return { ok: true };
  }

  return { ok: false };
}

async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return normalizeSettings(result[STORAGE_KEYS.settings]);
}

async function getActiveReminder() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.activeReminder);
  return cloneReminder(result[STORAGE_KEYS.activeReminder] || DEFAULT_REMINDERS[0]);
}

async function refreshSchedules(settings) {
  const alarms = await chrome.alarms.getAll();
  await Promise.all(
    alarms
      .filter((alarm) => isCareAlarm(alarm.name) || LEGACY_ALARMS.includes(alarm.name))
      .map((alarm) => chrome.alarms.clear(alarm.name))
  );

  await stopSound();

  settings.reminders
    .filter((reminder) => reminder.isEnabled)
    .forEach((reminder) => {
      chrome.alarms.create(getScheduleAlarmName(reminder.id), {
        delayInMinutes: reminder.intervalMinutes,
        periodInMinutes: reminder.intervalMinutes
      });
    });
}

async function showReminder(reminder, source) {
  const cleanReminder = cloneReminder(reminder);

  await chrome.storage.local.set({
    [STORAGE_KEYS.activeReminder]: {
      ...cleanReminder,
      source,
      shownAt: Date.now()
    }
  });

  await playSound();
  await openReminderWindow();
  await showSystemNotification(cleanReminder);
}

async function openReminderWindow() {
  const url = chrome.runtime.getURL(REMINDER_WINDOW_PATH);

  try {
    await chrome.windows.create({
      url,
      type: "popup",
      width: 560,
      height: 560,
      focused: true
    });
  } catch (error) {
    console.warn("Не удалось открыть окно напоминания", error);
  }
}

async function showSystemNotification(reminder) {
  const notificationId = getNotificationId(reminder.id);

  try {
    await chrome.notifications.clear(notificationId);
    await chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("assets/icon-128.png"),
      title: `${reminder.emoji} ${reminder.title}`,
      message: reminder.subtitle,
      priority: 2,
      requireInteraction: true,
      buttons: [
        { title: "Спасибо 🤍" },
        { title: `Напомнить через ${SNOOZE_MINUTES} минут` }
      ]
    });
  } catch (error) {
    console.warn("Не удалось показать системное уведомление", error);
  }
}

async function completeReminder(reminderId) {
  const settings = await getSettings();
  const reminder = settings.reminders.find((item) => item.id === reminderId);

  await stopSound();
  await chrome.notifications.clear(getNotificationId(reminderId));
  await chrome.alarms.clear(getSnoozeAlarmName(reminderId));
  await chrome.alarms.clear(getScheduleAlarmName(reminderId));

  if (reminder && reminder.isEnabled) {
    chrome.alarms.create(getScheduleAlarmName(reminder.id), {
      delayInMinutes: reminder.intervalMinutes,
      periodInMinutes: reminder.intervalMinutes
    });
  }
}

async function snoozeReminder(reminderId) {
  await stopSound();
  await chrome.notifications.clear(getNotificationId(reminderId));
  await chrome.alarms.clear(getScheduleAlarmName(reminderId));
  await chrome.alarms.clear(getSnoozeAlarmName(reminderId));

  chrome.alarms.create(getSnoozeAlarmName(reminderId), {
    delayInMinutes: SNOOZE_MINUTES
  });
}

async function playSound() {
  try {
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({ type: "sound-start" });
  } catch (error) {
    console.warn("Не удалось включить звук", error);
  }
}

async function stopSound() {
  try {
    await chrome.runtime.sendMessage({ type: "sound-stop" });
  } catch (error) {
    console.warn("Не удалось выключить звук", error);
  }
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(SOUND_PATH);

  if (await chrome.offscreen.hasDocument()) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Нужно проигрывать заметный звук при напоминании."
  });
}
