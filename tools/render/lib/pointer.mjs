/**
 * A touch indicator for the clips: a ring that follows the pointer and shrinks while it is pressed, drawn in the
 * page above everything, taking no events. The page's own pointer events move it (`pointermove` reaches the window
 * from inside any shadow root), so a gesture written for the plain mouse animates the ring frame by frame.
 */
import { mousePointer } from './gestures.mjs';

const RING = `(() => {
  const ring = document.createElement('div');
  ring.id = '__fv-pointer';
  ring.style.cssText = [
    'position:fixed', 'left:0', 'top:0', 'width:28px', 'height:28px', 'margin:-14px 0 0 -14px',
    'border-radius:50%', 'pointer-events:none', 'z-index:2147483647', 'opacity:0',
    'background:rgba(128,128,128,0.42)',
    'box-shadow:0 0 0 1.5px #fff, 0 0 0 2.5px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.25)',
    'transition:width 120ms ease, height 120ms ease, margin 120ms ease, opacity 160ms ease',
    'will-change:transform',
  ].join(';');
  document.body.append(ring);
  const follow = (event) => {
    ring.style.transform = 'translate3d(' + event.clientX + 'px,' + event.clientY + 'px,0)';
    ring.style.opacity = '1';
  };
  const press = (down) => {
    const size = down ? 22 : 28;
    ring.style.width = ring.style.height = size + 'px';
    ring.style.margin = '-' + size / 2 + 'px 0 0 -' + size / 2 + 'px';
  };
  window.addEventListener('pointermove', follow, true);
  window.addEventListener('pointerdown', (e) => { follow(e); press(true); }, true);
  window.addEventListener('pointerup', (e) => { follow(e); press(false); }, true);
  window.__fvPointer = { hide: () => (ring.style.opacity = '0') };
})()`;

/** Draws the ring in `page` and returns a Pointer that moves it (through the page's own mouse). */
export async function touchPointer(page) {
  await page.evaluate(RING);
  const pointer = mousePointer(page);
  return {
    ...pointer,
    /** Fades the ring out (the end of a clip). */
    hide: () => page.evaluate(() => window.__fvPointer?.hide()),
  };
}
