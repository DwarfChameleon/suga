import { TestBed } from '@angular/core/testing';

import { ConsumerAuthGuard } from './consumer-auth.guard';

describe('ConsumerAuthGuard', () => {
  let guard: ConsumerAuthGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(ConsumerAuthGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
