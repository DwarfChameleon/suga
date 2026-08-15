import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FoodService } from 'src/app/services/food.service';
import { OrderModalComponent } from '../order-modal/order-modal.component';
import { Food } from 'src/app/interface/food';
import { UserService } from '../../services/user.service';
import { UserDetails } from '../../interface/user-details';
import { OrderService } from 'src/app/services/order.service';
import { ModalController } from '@ionic/angular';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { CartService } from 'src/app/services/cart.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { CartComponent } from '../cart/cart.component';
import { Subscription } from 'rxjs';
import { resolveUploadUrl } from 'src/app/utils/media-url';


@Component({
  selector: 'app-food-profile',
  templateUrl: './food-profile.component.html',
  styleUrls: ['./food-profile.component.scss']
})
export class FoodProfileComponent implements OnInit, OnDestroy {
  @Input() foodId!: string;
  food: any;
  chefFoods: Food[] = [];
  similarFoodsByRegion: Food[] = [];
  chefName:any;
  count: number | undefined;
  cartCount = 0;
  cartSubtotal = 0;
  showIngredients = false;
  recommendationTag: 'suggested' | 'not_recommended' | '' = '';
  private dietPreferences = { allergies: [] as string[], desiredIngredients: [] as string[] };
  private cartSub?: Subscription;
 
  
  constructor(
    private modalController: ModalController,
    private foodService: FoodService,
    private userService: UserService,
    private orderService:OrderService,
    private tokenStorage: TokenStorageService,
    private cartService: CartService,
    private uiFeedback: UiFeedbackService
  ) { }

  ngOnInit(): void {
    this.loadFood();
    this.loadDietPreferences();
    this.refreshCartState();
    this.cartSub = this.cartService.cart$.subscribe(() => this.refreshCartState());
  }

  ngOnDestroy(): void {
    this.cartSub?.unsubscribe();
  }

  countOrder(): void{
    this.orderService.countOrders(this.foodId).subscribe(
      response=>{
        this.count = response.count;
         });
  }

 moreFoodByChef(chefName: string): void {
    this.foodService.getFoodsWithChefNames(chefName).subscribe(
      (foods: Food[]) => {
        if (foods.length === 0) {
          this.chefFoods = [];
        } else {
          this.chefFoods = foods;
        }
      },
      (error) => {
        console.error('Error fetching foods:', error);
              }
    );
  }
  
    async openModalFood(foodId: string) {
      this.fetchFood(foodId);
      try { await this.modalController.dismiss(); } catch (e) {}
      const modal = await this.modalController.create({
        component: FoodProfileComponent,
        componentProps: { foodId },
        cssClass: 'suga-food-profile-sheet',
        handle: true,
        initialBreakpoint: 0.9,
        breakpoints: [0, 0.58, 0.9, 1]
      });
      await modal.present();
    }
      fetchFood(foodId: string) {
    this.foodService.getFoodById(foodId).subscribe(
      (food: Food) => {
        console.log('Fetched food:', food);
      },
      (error: any) => {
        console.error('Error fetching food:', error);
      }
    );
  }
async openOrderModal(food: Food) {
  const chefID = (food as any).chefID || (food as any).chefId || (food as any).createdBy;
  const storedUser = this.tokenStorage.getUser();

  // If not logged in, open modal without user profile; order modal will prompt login
  if (!storedUser?._id) {
    const modal = await this.modalController.create({
      component: OrderModalComponent,
      componentProps: {
        dishName: food.dishName,
        price: food.price,
        priceCurrency: food.priceCurrency,
        preparationTime: food.preparationTime,
        chefName: food.chefName,
        chefID,
        food_id: food._id,
        image: (food as any).image,
        category: (food as any).category,
        user: undefined,
        food
      }
    });
    await modal.present();
    return;
  }

  this.userService.getUserDetails().subscribe(
    async (userProfile: UserDetails) => {
      const modal = await this.modalController.create({
        component: OrderModalComponent,
        componentProps: {
          dishName: food.dishName,
          price: food.price,
          priceCurrency: food.priceCurrency,
          preparationTime: food.preparationTime,
          chefName: food.chefName,
          chefID,
          food_id: food._id,
          image: (food as any).image,
          category: (food as any).category,
          user: userProfile,
          food
        }
      });
      await modal.present();
    },
    async (error) => {
      console.error('Error loading user profile:', error);
      const modal = await this.modalController.create({
        component: OrderModalComponent,
        componentProps: {
          dishName: food.dishName,
          price: food.price,
          priceCurrency: food.priceCurrency,
          preparationTime: food.preparationTime,
          chefName: food.chefName,
          chefID,
          food_id: food._id,
          image: (food as any).image,
          category: (food as any).category,
          user: undefined,
          food
        }
      });
      await modal.present();
    }
  );
}

    closeModal() {
    this.modalController.dismiss();
  }

  loadFood() {
    this.foodService.getFoodById(this.foodId).subscribe(
      (response) => {
        this.food = { ...response, chefName: response.chef };
        this.recommendationTag = this.getRecommendationTag(this.food);
        this.chefName = this.food.chefName;
        if (this.chefName) {
          this.moreFoodByChef(this.chefName);
        }
        this.loadRecommendations();
        this.countOrder();
        console.log('Mapped Food response:', this.food);
      },
      (error) => {
        console.error('Error fetching food:', error);
      }
    );
  }

  getIngredientList(food: Food | any = this.food): string[] {
    const source = Array.isArray(food?.ingredientsList) && food.ingredientsList.length
      ? food.ingredientsList
      : String(food?.ingredients || '').split(/[\n,]/);
    return [...new Set<string>(source.map((item: any) => String(item || '').trim()).filter(Boolean))];
  }

  toggleIngredients(): void {
    this.showIngredients = !this.showIngredients;
  }

  isFoodVerified(): boolean {
    return this.food?.verificationStatus === 'verified' || !!this.food?.profileCompletion?.verified;
  }

  private getRecommendationTag(food: Food | any): 'suggested' | 'not_recommended' | '' {
    const user = this.tokenStorage.getUser() as any;
    const preferences = {
      allergies: this.dietPreferences.allergies.length ? this.dietPreferences.allergies : user?.dietPreferences?.allergies,
      desiredIngredients: this.dietPreferences.desiredIngredients.length ? this.dietPreferences.desiredIngredients : user?.dietPreferences?.desiredIngredients
    };
    const allergies = this.normalizeTags(preferences.allergies);
    const desired = this.normalizeTags(preferences.desiredIngredients);
    if (!allergies.length && !desired.length) return '';

    const ingredients = this.normalizeTags(this.getIngredientList(food));
    if (allergies.some((item) => ingredients.includes(item))) return 'not_recommended';
    if (desired.some((item) => ingredients.includes(item))) return 'suggested';
    return '';
  }

  private normalizeTags(value: any): string[] {
    const list = Array.isArray(value) ? value : String(value || '').split(/[\n,]/);
    return [...new Set(list.map((item: any) => String(item || '').trim().toLowerCase()).filter(Boolean))];
  }

  private loadDietPreferences(): void {
    const storedUser = this.tokenStorage.getUser();
    this.dietPreferences = {
      allergies: this.normalizeTags(storedUser?.dietPreferences?.allergies),
      desiredIngredients: this.normalizeTags(storedUser?.dietPreferences?.desiredIngredients)
    };

    if (!this.tokenStorage.getAccessToken()) {
      return;
    }

    this.userService.getEditableProfile().subscribe({
      next: (profile: any) => {
        this.dietPreferences = {
          allergies: this.normalizeTags(profile?.dietPreferences?.allergies),
          desiredIngredients: this.normalizeTags(profile?.dietPreferences?.desiredIngredients)
        };
        if (this.food) {
          this.recommendationTag = this.getRecommendationTag(this.food);
        }
      }
    });
  }



  getImageUrl(image: string): string {
    return resolveUploadUrl(image);
  }

  addCurrentFoodToCart(): void {
    const chefID = this.food?.chefID || this.food?.chefId || this.food?.createdBy;
    if (!this.food?._id || !chefID || !this.food?.dishName || !this.food?.price || !this.food?.preparationTime || !this.food?.chefName) {
      this.uiFeedback.error('Unable to add this item to cart.');
      return;
    }

    this.cartService.addItem({
      food_id: this.food._id,
      dishName: this.food.dishName,
      price: this.food.price,
      priceCurrency: this.food.priceCurrency,
      preparationTime: this.food.preparationTime,
      chefId: chefID,
      chefUsername: this.food.chefName,
      image: this.food.image,
      category: this.food.category
    });
    this.uiFeedback.success('Added to cart.');
    this.refreshCartState();
  }

  async goToCart(): Promise<void> {
    await this.modalController.dismiss();
    const modal = await this.modalController.create({
      component: CartComponent,
      cssClass: 'suga-cart-sheet',
      handle: true,
      initialBreakpoint: 0.92,
      breakpoints: [0, 0.72, 0.92, 1]
    });
    await modal.present();
  }

  private refreshCartState(): void {
    this.cartCount = this.cartService.getItemCount();
    this.cartSubtotal = this.cartService.getSubtotal();
  }

  private loadRecommendations(): void {
    if (!this.foodId) return;
    this.foodService.getFoodRecommendations(this.foodId).subscribe({
      next: (data) => {
        this.similarFoodsByRegion = data?.sameCategoryRegion || [];
      },
      error: () => {
        this.similarFoodsByRegion = [];
      }
    });
  }


}
