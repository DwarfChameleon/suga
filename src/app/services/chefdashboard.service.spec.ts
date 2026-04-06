import { TestBed } from '@angular/core/testing';

import { ChefdashboardService } from './chefdashboard.service';

describe('ChefdashboardService', () => {
  let service: ChefdashboardService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChefdashboardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
