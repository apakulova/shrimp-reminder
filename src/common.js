const DEFAULT_REMINDERS = [
  {
    id: "eyes",
    title: "Время закапать глаза",
    subtitle: "Отвлекись от экрана и посмотри вдаль —\nэто даст глазам небольшую передышку",
    emoji: "👁️",
    intervalMinutes: 120,
    isEnabled: true,
    isCustom: false
  },
  {
    id: "movement",
    title: "Пора немного размяться",
    subtitle: "Встань, потянись, пройдись пару минут —\nспина скажет спасибо",
    emoji: "🧘",
    intervalMinutes: 60,
    isEnabled: false,
    isCustom: false
  }
];

const LOCKED_REMINDER_IDS = DEFAULT_REMINDERS.map((reminder) => reminder.id);

const DEFAULT_SETTINGS = {
  reminders: DEFAULT_REMINDERS
};

const CUSTOM_REMINDER_EMOJIS = [
  "✨",
  "☕",
  "🌸",
  "🫧",
  "🍋",
  "🪴",
  "🧡",
  "⭐",
  "🌈",
  "🫶"
];

const STORAGE_KEYS = {
  settings: "careReminderSettings",
  activeReminder: "careActiveReminder"
};

const ALARM_PREFIXES = {
  schedule: "careScheduleAlarm:",
  snooze: "careSnoozeAlarm:"
};

const LEGACY_ALARMS = [
  "careScheduleAlarm",
  "careSnoozeAlarm"
];

const NOTIFICATION_PREFIX = "careReminderNotification:";
const REMINDER_WINDOW_PATH = "src/reminder.html";
const SOUND_PATH = "src/sound.html";
const SNOOZE_MINUTES = 10;

function cloneReminder(reminder) {
  return {
    id: reminder.id || createReminderId(),
    title: reminder.title || "Пора позаботиться о себе",
    subtitle: reminder.subtitle || "Сделай короткую паузу.",
    emoji: reminder.emoji || "✨",
    intervalMinutes: normalizeMinutes(reminder.intervalMinutes, 30),
    isEnabled: Boolean(reminder.isEnabled),
    isCustom: Boolean(reminder.isCustom)
  };
}

function createCustomReminder() {
  return {
    id: createReminderId(),
    title: "Новое напоминание",
    subtitle: "Напиши здесь то, что хочется услышать от себя.",
    emoji: getRandomCustomReminderEmoji(),
    intervalMinutes: 30,
    isEnabled: false,
    isCustom: true
  };
}

function getRandomCustomReminderEmoji() {
  const index = Math.floor(Math.random() * CUSTOM_REMINDER_EMOJIS.length);
  return CUSTOM_REMINDER_EMOJIS[index];
}

function createReminderId() {
  return `custom-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function normalizeMinutes(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 1), 1440);
}

function normalizeSettings(settings) {
  if (settings && Array.isArray(settings.reminders)) {
    return {
      reminders: normalizeReminderList(settings.reminders)
    };
  }

  if (settings && settings.reminder) {
    return {
      reminders: normalizeReminderList([
        {
          ...settings.reminder,
          isEnabled: settings.isEnabled
        }
      ])
    };
  }

  return {
    reminders: DEFAULT_REMINDERS.map(cloneReminder)
  };
}

function normalizeReminderList(reminders) {
  const normalizedReminders = reminders
    .map(getMigratedReminder)
    .filter(Boolean)
    .map(cloneReminder);
  const remindersById = new Map(normalizedReminders.map((reminder) => [reminder.id, reminder]));
  const defaultReminders = DEFAULT_REMINDERS.map((reminder) => remindersById.get(reminder.id) || cloneReminder(reminder));
  const customReminders = normalizedReminders.filter((reminder) => !isLockedReminder(reminder.id));

  return [...defaultReminders, ...customReminders];
}

function getMigratedReminder(reminder) {
  if (
    reminder.id === "eyes" &&
    reminder.title === "Пора закапать глаза" &&
    reminder.subtitle === "Пара секунд сейчас — и глазам будет спокойнее." &&
    reminder.emoji === "💧" &&
    normalizeMinutes(reminder.intervalMinutes, 20) === 20
  ) {
    return {
      ...DEFAULT_REMINDERS[0],
      isEnabled: reminder.isEnabled
    };
  }

  if (
    reminder.id === "back" &&
    reminder.title === "Разомни спину" &&
    reminder.subtitle === "Встань, расправь плечи и мягко потянись." &&
    reminder.emoji === "🧘" &&
    normalizeMinutes(reminder.intervalMinutes, 60) === 60
  ) {
    return {
      ...DEFAULT_REMINDERS[1],
      isEnabled: reminder.isEnabled
    };
  }

  if (
    reminder.id === "water" &&
    reminder.title === "Время воды" &&
    reminder.subtitle === "Сделай несколько глотков и проверь, как ты себя чувствуешь." &&
    reminder.emoji === "🥛" &&
    normalizeMinutes(reminder.intervalMinutes, 45) === 45
  ) {
    return null;
  }

  if (
    reminder.id === "breath" &&
    reminder.title === "Пауза на дыхание" &&
    reminder.subtitle === "Сделай пять медленных вдохов и выдохов." &&
    reminder.emoji === "🌿" &&
    normalizeMinutes(reminder.intervalMinutes, 30) === 30
  ) {
    return null;
  }

  return reminder;
}

function isLockedReminder(reminderId) {
  return LOCKED_REMINDER_IDS.includes(reminderId);
}

function getScheduleAlarmName(reminderId) {
  return `${ALARM_PREFIXES.schedule}${reminderId}`;
}

function getSnoozeAlarmName(reminderId) {
  return `${ALARM_PREFIXES.snooze}${reminderId}`;
}

function getNotificationId(reminderId) {
  return `${NOTIFICATION_PREFIX}${reminderId}`;
}

function parseReminderIdFromAlarm(alarmName) {
  if (alarmName.startsWith(ALARM_PREFIXES.schedule)) {
    return alarmName.slice(ALARM_PREFIXES.schedule.length);
  }

  if (alarmName.startsWith(ALARM_PREFIXES.snooze)) {
    return alarmName.slice(ALARM_PREFIXES.snooze.length);
  }

  return "";
}

function isCareAlarm(alarmName) {
  return alarmName.startsWith(ALARM_PREFIXES.schedule) || alarmName.startsWith(ALARM_PREFIXES.snooze);
}

function isCareNotification(notificationId) {
  return notificationId.startsWith(NOTIFICATION_PREFIX);
}

function parseReminderIdFromNotification(notificationId) {
  if (!isCareNotification(notificationId)) {
    return "";
  }

  return notificationId.slice(NOTIFICATION_PREFIX.length);
}
