import { readonly, ref } from 'vue';

const canAddPayment = ref(null);

export const useEventActionContext = () => ({
  canAddPayment: readonly(canAddPayment),
  setPaymentAvailability(value) {
    canAddPayment.value = value == null ? null : Boolean(value);
  },
});
