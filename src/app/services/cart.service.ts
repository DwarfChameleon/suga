import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CartItem {
  food_id: string;
  dishName: string;
  price: number;
  priceCurrency?: string;
  preparationTime: string;
  chefId: string;
  chefUsername: string;
  image?: string;
  category?: string;
  quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly CART_KEY = 'suga-cart-items';
  private readonly cartSubject = new BehaviorSubject<CartItem[]>(this.readCart());
  readonly cart$ = this.cartSubject.asObservable();

  getItems(): CartItem[] {
    return [...this.cartSubject.value];
  }

  addItem(item: Omit<CartItem, 'quantity'>, quantity = 1): CartItem[] {
    const qty = Math.max(1, Number(quantity || 1));
    const items = this.getItems();
    const index = items.findIndex(
      (i) => i.food_id === item.food_id && i.chefId === item.chefId
    );
    if (index >= 0) {
      items[index] = { ...items[index], quantity: items[index].quantity + qty };
    } else {
      items.push({ ...item, quantity: qty });
    }
    this.persist(items);
    return items;
  }

  removeItem(foodId: string): CartItem[] {
    const items = this.getItems().filter((item) => item.food_id !== foodId);
    this.persist(items);
    return items;
  }

  updateQuantity(foodId: string, quantity: number): CartItem[] {
    const qty = Math.max(1, Number(quantity || 1));
    const items = this.getItems().map((item) =>
      item.food_id === foodId ? { ...item, quantity: qty } : item
    );
    this.persist(items);
    return items;
  }

  clear(): void {
    this.persist([]);
  }

  getItemCount(): number {
    return this.getItems().reduce((sum, item) => sum + item.quantity, 0);
  }

  getSubtotal(): number {
    return this.getItems().reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  private readCart(): CartItem[] {
    try {
      const raw = localStorage.getItem(this.CART_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(items: CartItem[]): void {
    localStorage.setItem(this.CART_KEY, JSON.stringify(items));
    this.cartSubject.next(items);
  }
}
