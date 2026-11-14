import { css } from 'lit';

/**
 * Where a modal bottom sheet stands on a phone (#190), the one rule every sheet of ours shares (a light's details,
 * the alerts', the cameras', an item's, a schedule's, the room lights' colours, the robot's drive, the keypad, the
 * Energy period's, Customise's options): its foot clears the system's bar — the inset the Companion app hands Home
 * Assistant (`--safe-area-inset-bottom`), else the browser's — and a tall one stops short of the top by 24, or by the
 * status bar and the notch where they take more, so there is always scrim to tap and its body scrolls. The insets
 * are the screen's pixels: a sheet drawn larger (`--fv-zoom`, the size of the view or of the card that opened it)
 * takes them in its own.
 */
export const sheetInsets = css`
  dialog .fv-sheet {
    max-height: calc(
      100% - max(
          24px,
          var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) / var(--fv-zoom, 1)
        )
    );
    padding-bottom: max(
      16px,
      var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) / var(--fv-zoom, 1)
    );
  }
`;
