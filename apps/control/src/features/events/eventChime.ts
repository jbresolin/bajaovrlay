// The page's one AudioContext, made at the first chime and kept: a browser allows only a
// few at a time, and one made per chime would run out over a long race (gate 2 of PR #22).
let sharedAudioContext: AudioContext | undefined;

/** The page's AudioContext, made the first time it is needed. */
function readSharedAudioContext(): AudioContext {
  sharedAudioContext ??= new AudioContext();
  return sharedAudioContext;
}

/**
 * The short chime of a new pending event: two soft tones made with the browser's Web Audio,
 * so the page ships no sound file. Never throws: a browser without Web Audio, or one that
 * has not yet let the page play sound (no click on it since it opened), simply stays silent.
 */
export function playEventChime(): void {
  try {
    const audioContext = readSharedAudioContext();
    const tonesInHz = [880, 1320];
    const toneLengthSeconds = 0.12;
    tonesInHz.forEach((toneInHz, toneIndex) => {
      const startsAtSeconds = audioContext.currentTime + toneIndex * toneLengthSeconds;
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.frequency.value = toneInHz;
      volume.gain.setValueAtTime(0.15, startsAtSeconds);
      volume.gain.exponentialRampToValueAtTime(0.001, startsAtSeconds + toneLengthSeconds);
      oscillator.connect(volume).connect(audioContext.destination);
      oscillator.start(startsAtSeconds);
      oscillator.stop(startsAtSeconds + toneLengthSeconds);
    });
  } catch {
    // Deliberate: no sound is better than a page that breaks on a missing feature.
  }
}
