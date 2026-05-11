export interface Order {
    count: number | undefined;
    _id: string;
    food_Id:string;
    dishName: string;
    chefId: string;
    chefUsername: string;
    price: number;
    currency?: string;
    preparationTime: string;
    userId: string;
    username: string;
    orderTime?: Date;
    status: 'payment_pending' | 'placed' | 'confirmed' | 'declined'| 'delivered' | 'processing' |'completed' | 'approved' | 'cancelled';
    dispatchStatus?: 'unassigned' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered_to_customer' | 'failed';
    deliveryCity?: string;
    deliveryState?: string;
    deliveryCountry?: string;
    deliveryFee?: number;
    deliveryFeeTier?: string;
    deliveryDistanceKm?: number;
    deliveryQrReadableCode?: string;
    deliveryQrVisibleToRider?: boolean;
    deliveryQrVisibleAt?: string | Date | null;
    ratings?: Array<{
      role: 'consumer' | 'chef' | 'dispatch';
      userId: string;
      stars: number;
      comment?: string;
    }>;
    feeAmount?: number;
    totalAmount?: number;
    paymentStatus?: 'unpaid' | 'paid' | 'failed';
    charged?: boolean;
    payoutStatus?: 'not_due' | 'awaiting_consumer_confirmation' | 'released' | 'held';
    deliveryReminderCount?: number;
  }
  
