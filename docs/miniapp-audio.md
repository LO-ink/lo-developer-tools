# Audio in mini-games

Some LO WebViews require a user gesture for media playback. A new AudioContext may remain suspended. Try activation at startup and on a user gesture; a playback refusal must remain observable without blocking the game.

```ts
const audio = new AudioContext();
const resume = async () => {
  if (audio.state !== "suspended") return;
  try {
    await audio.resume();
  } catch (error) {
    showAudioError(error); // Let the person enable audio on the next gesture.
  }
};
const onGesture = () => {
  void resume();
};
void resume();
window.addEventListener("pointerdown", onGesture);

const disposeAudio = async () => {
  window.removeEventListener("pointerdown", onGesture);
  await audio.close();
};
```

Keep a sound toggle available. If activation fails after a gesture, show its state and allow another attempt. Handle HTML audio.play() rejection in the same way and invoke playback from the gesture handler. Stop background audio when the mini-app deactivates.

Check the context on the device; do not infer autoplay permission from the host's version number.
