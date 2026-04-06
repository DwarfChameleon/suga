import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
@Component({
  selector: 'app-unauthorized',
  templateUrl: './unauthorized.component.html',
  styleUrls: ['./unauthorized.component.scss'],
})
export class UnauthorizedComponent  implements OnInit {

  constructor(private ionicModule:IonicModule) { }
  message="You do not have access to this module";
  ngOnInit() {}

}
