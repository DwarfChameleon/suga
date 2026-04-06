import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-food-reg-success',
  templateUrl: './food-reg-success.component.html',
  styleUrls: ['./food-reg-success.component.scss'],
})
export class FoodRegSuccessComponent  implements OnInit {

  constructor(private router: Router) { }

  ngOnInit() {}

  viewMenu(): void {
    this.router.navigate(['/components/chef'], { queryParams: { tab: 'dishes' } });
  }

}
