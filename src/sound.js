let audioContext = null;
let masterGain = null;
let chimeTimer = null;
let activeOscillators = [];

const CHIME_NOTES = [
  { frequency: 987.77, start: 0, duration: 0.95 },
  { frequency: 1318.51, start: 0.28, duration: 1.05 },
  { frequency: 1567.98, start: 0.58, duration: 1.15 }
];

const CHIME_REPEAT_MS = 2600;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "sound-start") {
    startSound();
  }

  if (message.type === "sound-stop") {
    stopSound();
  }
});

async function startSound() {
  stopSound();

  audioContext = new AudioContext();
  await audioContext.resume();

  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.78;
  masterGain.connect(audioContext.destination);

  playChime();
  chimeTimer = setInterval(playChime, CHIME_REPEAT_MS);
}

function playChime() {
  if (!audioContext || !masterGain) {
    return;
  }

  const now = audioContext.currentTime;

  CHIME_NOTES.forEach((note) => {
    playBellNote(note.frequency, now + note.start, note.duration);
  });
}

function playBellNote(frequency, startAt, duration) {
  const oscillator = audioContext.createOscillator();
  const overtone = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  overtone.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  overtone.frequency.setValueAtTime(frequency * 2.01, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.72, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.22, startAt + duration * 0.38);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  overtone.connect(gain);
  gain.connect(masterGain);

  oscillator.start(startAt);
  overtone.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
  overtone.stop(startAt + duration + 0.04);
  activeOscillators.push(oscillator);
  activeOscillators.push(overtone);

  oscillator.onended = () => {
    activeOscillators = activeOscillators.filter((activeOscillator) => activeOscillator !== oscillator);
  };

  overtone.onended = () => {
    activeOscillators = activeOscillators.filter((activeOscillator) => activeOscillator !== overtone);
  };
}

function stopSound() {
  if (chimeTimer) {
    clearInterval(chimeTimer);
    chimeTimer = null;
  }

  activeOscillators.forEach((oscillator) => {
    if (oscillator) {
      try {
        oscillator.stop();
      } catch (_error) {
        // Звук мог уже остановиться.
      }
    }
  });
  activeOscillators = [];

  if (audioContext) {
    audioContext.close();
  }

  audioContext = null;
  masterGain = null;
}
