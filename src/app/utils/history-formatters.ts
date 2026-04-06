const TRANSACTION_LABELS: Record<string, string> = {
  'wallet:chef_payout': 'Chef payout',
  'wallet:chef_payout_auto': 'Chef payout',
  'wallet:dispatch_payout': 'Dispatch payout',
  'wallet:dispatch_payout_auto': 'Dispatch payout',
  'wallet:escrow_hold': 'Order escrow held',
  'wallet:service_fee_consumer': 'Service fee held',
  'wallet:service_fee_chef': 'Service fee released',
  'wallet:delivery_fee_hold': 'Delivery fee held',
  'wallet:transfer_request': 'Transfer request',
  'wallet:transfer_in': 'Incoming transfer',
  'wallet:transfer_out': 'Outgoing transfer',
  'wallet:withdrawal_request': 'Withdrawal request',
  'wallet:withdrawal_approved': 'Withdrawal approved',
  'wallet:withdrawal_rejected': 'Withdrawal rejected',
  'wallet:topup': 'Wallet top up',
  'rewards:token_to_wallet': 'Token conversion',
  'wallet:order_payment': 'Order payment',
  'wallet:order_accept_debit': 'Order accepted payment',
  'wallet:refund': 'Refund',
  'wallet:admin_escrow_release': 'Escrow released by review',
  'wallet:admin_escrow_refund': 'Escrow refunded by review',
  'wallet:admin_consumer_refund': 'Consumer refund',
  'wallet:admin_chef_payout': 'Chef payout',
  'wallet:floating_cash': 'Floating cash'
};

const REWARD_LABELS: Record<string, string> = {
  order_placed_consumer: 'Order placed',
  order_completed_consumer: 'Order completed',
  order_completed_gifter: 'Gift completed',
  order_completed_chef: 'Chef order completed',
  order_completed_dispatch: 'Dispatch delivery completed',
  follow_chef: 'Followed a chef',
  like_food: 'Liked a dish',
  like_video: 'Liked a story',
  comment_food: 'Commented on a dish',
  comment_video: 'Commented on a story',
  admin_bonus: 'Admin bonus'
};

export function humanizeHistoryLabel(value?: string): string {
  const key = String(value || '').trim();
  if (!key) return 'Activity';
  const mapped = TRANSACTION_LABELS[key] || REWARD_LABELS[key];
  if (mapped) return mapped;
  return key
    .replace(/^wallet:/, '')
    .replace(/^rewards:/, '')
    .replace(/[_:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatHistoryRef(value?: string): string {
  const key = String(value || '').trim();
  if (!key) return '';
  return key.startsWith('@') ? key : `@${key}`;
}
