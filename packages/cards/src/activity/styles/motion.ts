import { css } from 'lit';

/** Motion: the day's turn, every keyframe the page uses, and none of it with reduced motion. */
export const motionStyles = css`
  /* the day's title turns the page: the new one slides in from where the day went */
  .av-turn.is-next {
    animation: av-turn-next 360ms var(--fv-ease-out, ease-out) both;
  }
  .av-turn.is-prev {
    animation: av-turn-prev 360ms var(--fv-ease-out, ease-out) both;
  }
  .av-day__date.av-turn {
    animation-delay: 40ms;
  }

  @keyframes av-turn-next {
    from {
      opacity: 0;
      transform: translateX(16px);
    }
  }
  @keyframes av-turn-prev {
    from {
      opacity: 0;
      transform: translateX(-16px);
    }
  }
  @keyframes av-leave-next {
    to {
      opacity: 0;
      transform: translateX(-24px);
    }
  }
  @keyframes av-leave-prev {
    to {
      opacity: 0;
      transform: translateX(24px);
    }
  }
  @keyframes av-rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  @keyframes av-dim {
    from {
      opacity: 0.3;
    }
  }
  @keyframes av-roll {
    from {
      opacity: 0;
      transform: translateY(40%);
    }
  }
  @keyframes av-open-row {
    from {
      grid-template-rows: 0fr;
      opacity: 0;
    }
  }
  @keyframes av-ring {
    from {
      opacity: 0.9;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(1.45);
    }
  }
  @keyframes av-open {
    from {
      grid-template-rows: 0fr;
      padding-top: 0;
      padding-bottom: 0;
      opacity: 0;
    }
  }
  @keyframes av-shut {
    to {
      grid-template-rows: 0fr;
      padding-top: 0;
      padding-bottom: 0;
      opacity: 0;
    }
  }
  @keyframes av-pill {
    from {
      opacity: 0;
      transform: translateY(-12px) scale(0.94);
    }
  }
  @keyframes av-shimmer {
    to {
      opacity: 0.45;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }
  :host([reduced-motion]) *,
  :host([reduced-motion]) *::before,
  :host([reduced-motion]) *::after {
    animation: none !important;
    transition: none !important;
  }
`;
