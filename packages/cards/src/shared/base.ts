import { FluvyCard, type FluvyCardConfig } from '@fluvy/core';
import { baseStyles, fitPills } from '@fluvy/ui';
import type { CSSResultGroup, PropertyValues } from 'lit';

/**
 * What every card in this package shares on top of the core base class: the fluvy stylesheets and
 * the pill-fitting pass (badges and chips sized from their laid-out text, on the 4 px grid).
 */
export abstract class Card<C extends FluvyCardConfig = FluvyCardConfig> extends FluvyCard<C> {
  static override styles: CSSResultGroup = [...baseStyles];

  private refit: (() => void) | undefined;
  private fontTimer = 0;

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    fitPills(this.renderRoot);
    if (!this.refit && typeof document !== 'undefined' && document.fonts) {
      // one listener per card, released with the card: a web font can land after the first render
      this.refit = () => {
        if (this.isConnected) fitPills(this.renderRoot, true);
      };
      document.fonts.addEventListener('loadingdone', this.refit);
      void document.fonts.ready.then(this.refit);
      this.fontTimer = window.setTimeout(this.refit, 1200); // a face can become usable a frame after `ready` says so
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.refit) document.fonts.removeEventListener('loadingdone', this.refit);
    this.refit = undefined;
    clearTimeout(this.fontTimer);
    this.fontTimer = 0;
  }
}
