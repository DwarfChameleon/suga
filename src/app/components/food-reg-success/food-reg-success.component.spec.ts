import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { FoodRegSuccessComponent } from './food-reg-success.component';

describe('FoodRegSuccessComponent', () => {
  let component: FoodRegSuccessComponent;
  let fixture: ComponentFixture<FoodRegSuccessComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ FoodRegSuccessComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(FoodRegSuccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
