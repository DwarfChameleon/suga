import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FoodCategory, FoodService } from 'src/app/services/food.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { LoaderService } from 'src/app/services/loader.service';
import { LoadingService } from 'src/app/services/loading.service';
import { environment } from 'src/environments/environment';

interface CategoryFormProfile {
  title: string;
  itemLabel: string;
  itemPlaceholder: string;
  prepLabel: string;
  prepPlaceholder: string;
  hints: string[];
  dynamicFields: DynamicField[];
  requiredKeys: string[];
}

interface DynamicField {
  key: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'select';
  options?: string[];
}

@Component({
  selector: 'app-food-registration',
  templateUrl: './food-registration.component.html',
  styleUrls: ['./food-registration.component.css']
})
export class FoodRegistrationComponent implements OnInit {
  foodForm!: FormGroup;
  currentStep: 1 | 2 = 1;
  categories: FoodCategory[] = [];
  selectedCategoryName = '';
  activeProfile: CategoryFormProfile = {
    title: 'Dish Details',
    itemLabel: 'Dish Name',
    itemPlaceholder: 'Enter dish name',
    prepLabel: 'Preparation Time',
    prepPlaceholder: 'e.g., 20 mins',
    hints: [],
    dynamicFields: [],
    requiredKeys: []
  };
  selectedFile: File | undefined;
  selectedImage: string | undefined;
  invalidFormMessage!: string;
  errorMessage: string = '';
  loading: boolean = false;
  loaderTimeout: any;
  showPopup: boolean | undefined;
  prepHours = 0;
  prepMinutes = 0;
  readonly prepHourOptions = Array.from({ length: 13 }, (_, i) => i);
  readonly prepMinuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  currencyCode = 'NGN';
  currencySymbol = '₦';
  private readonly countryCurrencyMap: Record<string, string> = {
    nigeria: 'NGN',
    ghana: 'GHS',
    kenya: 'KES',
    'south africa': 'ZAR',
    uganda: 'UGX',
    tanzania: 'TZS',
    rwanda: 'RWF',
    egypt: 'EGP',
    india: 'INR',
    'united states': 'USD',
    usa: 'USD',
    canada: 'CAD',
    uk: 'GBP',
    'united kingdom': 'GBP',
    france: 'EUR',
    germany: 'EUR',
    italy: 'EUR',
    spain: 'EUR',
    netherlands: 'EUR',
    australia: 'AUD',
    'new zealand': 'NZD'
  };

  constructor(
    private foodService: FoodService,
    private tokenStorage: TokenStorageService,
    private router: Router,
    private formBuilder: FormBuilder,
    public loaderService: LoaderService,
    private loadingService: LoadingService
  ) {}
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('categoryList') categoryList?: ElementRef<HTMLElement>;

  ngOnInit(): void {
    this.foodForm = this.formBuilder.group({
      dishName: ['', Validators.required],
      preparationTime: ['', Validators.required],
      price: ['', Validators.required],
      category: ['', Validators.required],
      availability: ['', Validators.required],
      image: ['', Validators.required],
      servingSize: [''],
      spiceLevel: [''],
      flavorProfile: [''],
      drinkType: [''],
      servingTemperature: [''],
      isAlcoholic: ['No']
    });
    this.loadCategories();
    this.resolveCurrency();
  }
  togglePopup() {
    this.showPopup = !this.showPopup;
  }

  get categoryStepDone(): boolean {
    return !!this.selectedCategoryName;
  }

  get priceLabel(): string {
    return `Price (${this.currencyCode} ${this.currencySymbol})`;
  }

  getCategoryImage(image?: string): string {
    if (!image) return '/assets/img/hambuga.png';
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    return `${environment.uploadUrl}/${image.replace(/^\/+/, '')}`;
  }

  goBackToCategoryStep(): void {
    this.currentStep = 1;
  }

  selectCategory(category: FoodCategory): void {
    const name = String(category.name || '').trim();
    if (!name) return;
    this.selectedCategoryName = name;
    this.foodForm.patchValue({ category: name });
    this.activeProfile = this.getProfileForCategory(name);
    this.currentStep = 2;
    this.clearDynamicFields();
    this.prepHours = 0;
    this.prepMinutes = 0;
    this.onPrepTimeChange();
    this.invalidFormMessage = '';
    this.scrollCategoryIntoView(name);
  }

  private scrollCategoryIntoView(name: string): void {
    const list = this.categoryList?.nativeElement;
    if (!list) return;
    const selectedEl = Array.from(list.querySelectorAll('[data-category-name]'))
      .find((el) => el.getAttribute('data-category-name') === name) as HTMLElement | undefined;
    if (!selectedEl) return;
    setTimeout(() => {
      selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  private loadCategories(): void {
    this.foodService.getCategoryList().subscribe({
      next: (categories) => {
        this.categories = Array.isArray(categories) ? categories : [];
      },
      error: () => {
        this.categories = [
          { name: 'Food', image: '' },
          { name: 'Snacks', image: '' },
          { name: 'Breakfast', image: '' },
          { name: 'Lunch', image: '' },
          { name: 'Dinner', image: '' },
          { name: 'Desserts', image: '' },
          { name: 'Restaurant Specials', image: '' },
          { name: 'Non-Alcoholic Drinks', image: '' },
          { name: 'Juice & Fruit Blends', image: '' },
          { name: 'Hot Drinks', image: '' }
        ];
      }
    });
  }

  private getProfileForCategory(categoryName: string): CategoryFormProfile {
    const normalized = categoryName.toLowerCase();

    const drinkKeywords = ['drink', 'beverage', 'juice', 'smoothie', 'tea', 'coffee', 'cocktail', 'alcohol'];
    const dessertKeywords = ['dessert', 'ice', 'cake', 'sweet', 'pastry'];

    if (drinkKeywords.some((k) => normalized.includes(k))) {
      return {
        title: 'Drink Details',
        itemLabel: 'Drink Name',
        itemPlaceholder: 'e.g., Pineapple Ginger Blend',
        prepLabel: 'Preparation Time / Chilling Time',
        prepPlaceholder: 'e.g., 8 mins',
        hints: ['Add clear name', 'Mention serving style in name if needed', 'Use high-quality product image'],
        dynamicFields: [
          { key: 'drinkType', label: 'Drink Type', type: 'select', options: ['Juice', 'Smoothie', 'Soda', 'Tea', 'Coffee', 'Mocktail', 'Other'] },
          { key: 'servingTemperature', label: 'Serving Temperature', type: 'select', options: ['Cold', 'Warm', 'Hot', 'Room Temperature'] },
          { key: 'isAlcoholic', label: 'Alcoholic?', type: 'select', options: ['No', 'Yes'] }
        ],
        requiredKeys: ['drinkType', 'servingTemperature']
      };
    }

    if (dessertKeywords.some((k) => normalized.includes(k))) {
      return {
        title: 'Dessert Details',
        itemLabel: 'Dessert Name',
        itemPlaceholder: 'e.g., Chocolate Lava Cake',
        prepLabel: 'Prep + Bake Time',
        prepPlaceholder: 'e.g., 30 mins',
        hints: ['Include portion style in title if needed', 'Use clear plating image'],
        dynamicFields: [
          { key: 'servingSize', label: 'Serving Size', type: 'text', placeholder: 'e.g., 2 slices / 500ml cup' },
          { key: 'flavorProfile', label: 'Flavor Profile', type: 'text', placeholder: 'e.g., Sweet, Chocolate, Creamy' }
        ],
        requiredKeys: ['servingSize']
      };
    }

    return {
      title: 'Dish Details',
      itemLabel: 'Dish Name',
      itemPlaceholder: 'e.g., Jollof Rice with Chicken',
      prepLabel: 'Preparation Time',
      prepPlaceholder: 'e.g., 25 mins',
      hints: ['Keep dish title concise', 'Use appetizing image for conversion'],
      dynamicFields: [
        { key: 'servingSize', label: 'Serving Size', type: 'text', placeholder: 'e.g., 1 bowl / 1 plate' },
        { key: 'spiceLevel', label: 'Spice Level', type: 'select', options: ['Mild', 'Medium', 'Hot'] },
        { key: 'flavorProfile', label: 'Flavor Notes', type: 'text', placeholder: 'e.g., Savory, Smoky, Spicy' }
      ],
      requiredKeys: ['servingSize', 'spiceLevel']
    };
  }

  private clearDynamicFields(): void {
    ['servingSize', 'spiceLevel', 'flavorProfile', 'drinkType', 'servingTemperature', 'isAlcoholic'].forEach((key) => {
      const defaultValue = key === 'isAlcoholic' ? 'No' : '';
      this.foodForm.patchValue({ [key]: defaultValue }, { emitEvent: false });
    });
  }

  onPrepTimeChange(): void {
    const hours = Number(this.prepHours || 0);
    const minutes = Number(this.prepMinutes || 0);

    if (hours <= 0 && minutes <= 0) {
      this.foodForm.patchValue({ preparationTime: '' }, { emitEvent: false });
      return;
    }

    const hPart = hours > 0 ? `${hours} hr${hours > 1 ? 's' : ''}` : '';
    const mPart = minutes > 0 ? `${minutes} min${minutes > 1 ? 's' : ''}` : '';
    const prepText = [hPart, mPart].filter(Boolean).join(' ');
    this.foodForm.patchValue({ preparationTime: prepText }, { emitEvent: false });
  }

  private resolveCurrency(): void {
    const user = this.tokenStorage.getUser() || {};
    const preferred = String(user.preferredCurrency || '').trim().toUpperCase();
    if (preferred) {
      this.currencyCode = preferred;
      this.currencySymbol = this.getCurrencySymbol(preferred);
      return;
    }

    const country = String(user.country || '').trim().toLowerCase();
    const guessed = this.countryCurrencyMap[country];
    if (guessed) {
      this.currencyCode = guessed;
      this.currencySymbol = this.getCurrencySymbol(guessed);
    }
  }

  private getCurrencySymbol(code: string): string {
    try {
      const parts = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code
      }).formatToParts(1);
      return parts.find((p) => p.type === 'currency')?.value || code;
    } catch {
      return code;
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.selectedCategoryName) {
      this.invalidFormMessage = 'Select a category first.';
      this.currentStep = 1;
      return;
    }

    if (!this.selectedFile) {
      this.invalidFormMessage = 'Please upload a food image.';
      return;
    }

    if (this.foodForm.invalid) {
      this.invalidFormMessage = 'Please complete all required fields.';
      return;
    }

    const missingDynamic = this.activeProfile.requiredKeys.filter((key) => {
      const val = String(this.foodForm.value[key] ?? '').trim();
      return !val;
    });
    if (missingDynamic.length > 0) {
      this.invalidFormMessage = 'Please complete required category-specific fields.';
      return;
    }

    this.loaderService.showLoader();
    await this.loadingService.show('Posting dish...');
    this.loading = true;
  
    const user = this.tokenStorage.getUser();
    if (!user || !user._id || !user.username) {
      this.invalidFormMessage = 'User not found. Please log in again.';
      this.stopLoader();
      return;
    }
  
    const formData = new FormData();
    formData.append('image', this.selectedFile);
    formData.append('dishName', this.foodForm.value.dishName);
    formData.append('preparationTime', this.foodForm.value.preparationTime);
    formData.append('price', this.foodForm.value.price.toString());
    formData.append('category', this.selectedCategoryName);
    formData.append('availability', this.foodForm.value.availability);
    formData.append('priceCurrency', this.currencyCode);
    const additionalDetails = {
      servingSize: this.foodForm.value.servingSize || '',
      spiceLevel: this.foodForm.value.spiceLevel || '',
      flavorProfile: this.foodForm.value.flavorProfile || '',
      drinkType: this.foodForm.value.drinkType || '',
      servingTemperature: this.foodForm.value.servingTemperature || '',
      isAlcoholic: this.foodForm.value.isAlcoholic || 'No'
    };
    formData.append('additionalDetails', JSON.stringify(additionalDetails));
    formData.append('chefID', user._id);  // Adding chefID
    formData.append('chefUsername', user.username); // Adding chefUsername
  
    // Set a timeout to stop the loader after a specified time (e.g., 10 seconds)
    this.loaderTimeout = setTimeout(() => {
      this.stopLoader();
    }, 10000); // 10 seconds
  
    this.foodService.registerFood(formData).subscribe(
      (response: any) => {
        console.log('Food registered successfully:', response);
        this.stopLoader();
        this.router.navigate(['/components/food-reg-success']);
      },
      (error: any) => {
        console.error('Error registering food:', error);
        this.errorMessage = 'Error registering food. Please try again.';
        this.stopLoader();
      }
    );
  }
  

  stopLoader(): void {
    this.loaderService.hideLoader();
    this.loadingService.hide();
    this.loading = false;
    clearTimeout(this.loaderTimeout); // Clear the timeout if the loader is stopped manually
  }
  openFilePicker() {
    this.fileInput.nativeElement.click();
  }
  openCamera() {
    this.router.navigate(['/camera']);
  }


  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.foodForm.patchValue({ image: file });
      this.foodForm.get('image')?.updateValueAndValidity();

      const reader = new FileReader();
      reader.onload = () => {
        this.selectedImage = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }
}
