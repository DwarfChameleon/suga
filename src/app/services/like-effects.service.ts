import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LikeEffectsService {
  private sequence = 0;

  readonly alreadyLikedMessage = 'Like sent already.';

  createHeartBurst(count = 5): number[] {
    return Array.from({ length: count }, () => ++this.sequence);
  }

  applyHeartBurst(
    store: Record<string, number[]>,
    itemId: string,
    clearAfterMs = 1100
  ): void {
    store[itemId] = this.createHeartBurst();
    setTimeout(() => {
      delete store[itemId];
    }, clearAfterMs);
  }
}

