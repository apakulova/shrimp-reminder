const DEFAULT_REMINDERS = [
  {
    id: "eyes",
    title: "Пора закапать глаза",
    subtitle: "Пара секунд сейчас — и глазам будет спокойнее.",
    emoji: "💧",
    intervalMinutes: 20,
    isEnabled: true,
    isCustom: false
  },
  {
    id: "water",
    title: "Время воды",
    subtitle: "Сделай несколько глотков и проверь, как ты себя чувствуешь.",
    emoji: "🥛",
    intervalMinutes: 45,
    isEnabled: false,
    isCustom: false
  },
  {
    id: "back",
    title: "Разомни спину",
    subtitle: "Встань, расправь плечи и мягко потянись.",
    emoji: "🧘",
    intervalMinutes: 60,
    isEnabled: false,
    isCustom: false
  },
  {
    id: "breath",
    title: "Пауза на дыхание",
    subtitle: "Сделай пять медленных вдохов и выдохов.",
    emoji: "🌿",
    intervalMinutes: 30,
    isEnabled: false,
    isCustom: false
  }
];

const DEFAULT_SETTINGS = {
  reminders: DEFAULT_REMINDERS
};

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
    title: "Свое напоминание",
    subtitle: "Напиши здесь то, что хочется услышать от себя.",
    emoji: "✨",
    intervalMinutes: 30,
    isEnabled: false,
    isCustom: true
  };
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
      reminders: settings.reminders.map(cloneReminder)
    };
  }

  if (settings && settings.reminder) {
    return {
      reminders: [
        cloneReminder({
          ...settings.reminder,
          isEnabled: settings.isEnabled
        })
      ]
    };
  }

  return {
    reminders: DEFAULT_REMINDERS.map(cloneReminder)
  };
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
