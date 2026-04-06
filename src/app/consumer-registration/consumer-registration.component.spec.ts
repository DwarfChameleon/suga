import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ConsumerRegistrationComponent } from './consumer-registration.component';

describe('ConsumerRegistrationComponent', () => {
  let component: ConsumerRegistrationComponent;
  let fixture: ComponentFixture<ConsumerRegistrationComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ ConsumerRegistrationComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(ConsumerRegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
