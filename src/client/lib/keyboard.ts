/**
 * Marks `<html data-keyboard>` while the on-screen keyboard is up, for the `keyboard:` variant (the tab bar and the
 * floating buttons step aside), and brings a `[data-keyboard-reveal]` holding the focused field to the top of its
 * scroller, so a search's suggestions show under its input instead of under the keyboard.
 *
 * The page is laid out above the keyboard (`interactive-widget=resizes-content` in index.html, Android); the visual
 * viewport covers iOS, which only shrinks that. Zoom is factored out so pinching does not count as a keyboard.
 */
export function watchKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  let tallest = 0;
  let width = 0;
  let open = false;
  const update = () => {
    const height = vv.height * vv.scale;
    if (window.innerWidth !== width) {
      width = window.innerWidth; // rotated: a new reference height
      tallest = height;
    }
    tallest = Math.max(tallest, height);
    const now = height < tallest * 0.8;
    if (now === open) return;
    open = now;
    document.documentElement.toggleAttribute("data-keyboard", open);
    if (open) {
      // after the layout settles above the keyboard
      requestAnimationFrame(() =>
        document.activeElement?.closest("[data-keyboard-reveal]")?.scrollIntoView({ block: "start", behavior: "smooth" }),
      );
    }
  };
  vv.addEventListener("resize", update);
  update();
}
