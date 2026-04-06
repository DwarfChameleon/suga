import { TestBed } from '@angular/core/testing';

import { AutoredirectguardService } from './autoredirectguard.service';

describe('AutoredirectguardService', () => {
  let service: AutoredirectguardService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AutoredirectguardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
