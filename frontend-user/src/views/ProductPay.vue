<template>
  <div class="payment-page-container">
    <div v-if="loadingProduct || loadingSystemInfo" class="loading">Loading payment details...</div>
    <div v-if="pageError" class="error-message">{{ pageError }}</div>

    <div v-if="product && paymentMethods.length > 0 && !loadingProduct && !loadingSystemInfo && !pageError" class="payment-content">
      <h2>Confirm Your Order</h2>

      <div class="order-summary">
        <h3>Order Summary</h3>
        <p><strong>Product:</strong> {{ product.name }}</p>
        <p><strong>Quantity:</strong> {{ quantity }}</p>
        <p><strong>Unit Price:</strong> ¥{{ (currentUnitPrice / 100).toFixed(2) }}</p>
        <p><strong>Total Price:</strong> <span class="total-price-value">¥{{ (totalOrderPrice / 100).toFixed(2) }}</span></p>
      </div>

      <div class="contact-info">
        <h3>Contact Information</h3>
        <div class="form-group">
          <label for="contactEmail">Email for order updates & card delivery:</label>
          <input type="email" id="contactEmail" v-model="contactEmail" placeholder="your@email.com" :disabled="paymentInitiated" />
        </div>
      </div>
      
      <div class="payment-methods">
        <h3>Select Payment Method</h3>
        <div v-for="method in paymentMethods" :key="method.id" class="payment-method-option">
          <input 
            type="radio" 
            :id="'payment-' + method.id" 
            :value="method.name" 
            v-model="selectedPaymentMethod"
            :disabled="paymentInitiated" 
          />
          <label :for="'payment-' + method.id">
            <img v-if="method.icon" :src="method.icon" :alt="method.name" class="payment-icon" />
            {{ method.name }}
          </label>
        </div>
      </div>

      <button 
        @click="initiatePayment" 
        class="confirm-pay-button" 
        :disabled="!canInitiatePayment || initiatingPayment || paymentInitiated"
      >
        {{ paymentInitiated ? 'Processing...' : (initiatingPayment ? 'Initiating...' : 'Confirm and Pay') }}
      </button>
      <p v-if="paymentError" class="error-message">{{ paymentError }}</p>

      <div v-if="paymentDetails && paymentDetails.qr_url" class="payment-qr">
        <h4>Scan QR Code to Pay</h4>
        <p>Order ID: {{ outOrderId }}</p>
        <img :src="paymentDetails.qr_url" alt="Payment QR Code" />
        <p class="status-message">Status: {{ orderStatus }}</p>
      </div>
      <div v-if="paymentDetails && paymentDetails.payment_url && !paymentDetails.qr_url" class="payment-link">
         <h4>Complete Payment</h4>
         <p>Order ID: {{ outOrderId }}</p>
         <a :href="paymentDetails.payment_url" target="_blank" class="button-link">Click here to Pay</a>
         <p class="status-message">Status: {{ orderStatus }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, defineProps, watch } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '../services/api';

interface PifaDetail {
  nums: string[];
  prices: number[];
  slice: string[];
}

interface Product {
  id: number;
  name: string;
  price: number; // Base price in cents
  price_wholesale?: string;
  pifa?: PifaDetail; // Added for consistency with ProductDetail.vue
  // Other fields if needed for summary, though not strictly required here if price is recalculated
}

interface PaymentMethod {
  id: number;
  name: string;
  icon: string;
}

interface PaymentDetails {
  qr_url?: string;
  payment_url?: string;
  success: boolean;
  message?: string;
}

const props = defineProps<{
  productId: string;
  quantity: number;
}>();

const router = useRouter();

const product = ref<Product | null>(null);
const paymentMethods = ref<PaymentMethod[]>([]);
const selectedPaymentMethod = ref<string>('');
const contactEmail = ref<string>('');

const loadingProduct = ref<boolean>(true);
const loadingSystemInfo = ref<boolean>(true);
const pageError = ref<string | null>(null);

const initiatingPayment = ref<boolean>(false);
const paymentInitiated = ref<boolean>(false); // True after first successful initiation
const paymentError = ref<string | null>(null);
const paymentDetails = ref<PaymentDetails | null>(null);
const orderStatus = ref<string>('Awaiting payment confirmation...');
const outOrderId = ref<string>('');

let pollingInterval: number | undefined;

const currentUnitPrice = computed(() => {
  if (!product.value) return 0;
  const qty = props.quantity;

  if (product.value.pifa && product.value.pifa.slice && product.value.pifa.prices.length > 1) {
    const thresholds = product.value.pifa.slice.map(Number);
    const pifaPrices = product.value.pifa.prices;
    let price = pifaPrices[0]; // Base price
    for (let j = 0; j < thresholds.length; j++) {
      if (qty <= thresholds[j]) {
        price = pifaPrices[j + 1];
        break;
      }
      if (j === thresholds.length - 1 && qty > thresholds[j]) {
        price = pifaPrices[j + 2] || pifaPrices[pifaPrices.length - 1];
        break;
      }
    }
    return price;
  }
  return product.value.price;
});

const totalOrderPrice = computed(() => {
  return currentUnitPrice.value * props.quantity;
});

const canInitiatePayment = computed(() => {
  return product.value && 
         selectedPaymentMethod.value && 
         contactEmail.value && 
         /\S+@\S+\.\S+/.test(contactEmail.value) && // Basic email validation
         props.quantity > 0;
});

const fetchProductDetails = async () => {
  loadingProduct.value = true;
  try {
    const response = await apiClient.get(`/api/v2/products/${props.productId}/detail`);
    // We only need specific fields for price calculation and display here
    const data = response.data;
    product.value = {
      id: data.id,
      name: data.name,
      price: data.price, // base price
      price_wholesale: data.price_wholesale, // string for parsing
      pifa: data.pifa // pre-parsed pifa if backend sends it, otherwise parse price_wholesale
    };
    if (!product.value.pifa && product.value.price_wholesale) { // Fallback parsing if pifa not sent directly
         const parts = product.value.price_wholesale.split('#');
         if (parts.length === 2) {
            const numStrings = parts[0].split(',');
            const priceStrings = parts[1].split(',');
            if (numStrings.length === priceStrings.length) {
                product.value.pifa = {
                    nums: [], // Not strictly needed here, but for consistency
                    prices: [product.value.price, ...priceStrings.map(Number)],
                    slice: numStrings.map(String)
                };
            }
         } else {
            const singleNumMatch = product.value.price_wholesale.match(/^(\d+)#([\d.]+)$/);
            if (singleNumMatch) {
                 product.value.pifa = {
                    nums: [],
                    prices: [product.value.price, parseFloat(singleNumMatch[2])],
                    slice: [singleNumMatch[1]]
                 };
            }
         }
    }


  } catch (err) {
    console.error('Failed to load product details for payment:', err);
    pageError.value = 'Failed to load product information. Please try again.';
  } finally {
    loadingProduct.value = false;
  }
};

const fetchSystemInfo = async () => {
  loadingSystemInfo.value = true;
  try {
    const response = await apiClient.get('/api/v2/system_info');
    paymentMethods.value = response.data.payment_methods || [];
    if (paymentMethods.value.length > 0) {
      selectedPaymentMethod.value = paymentMethods.value[0].name; // Default to first method
    }
  } catch (err) {
    console.error('Failed to load system info for payment:', err);
    pageError.value = 'Failed to load payment methods. Please try again.';
  } finally {
    loadingSystemInfo.value = false;
  }
};

const generateOutOrderId = () => {
  return `F-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const initiatePayment = async () => {
  if (!canInitiatePayment.value || !product.value) return;

  initiatingPayment.value = true;
  paymentError.value = null;
  outOrderId.value = generateOutOrderId();

  try {
    const payload = {
      out_order_id: outOrderId.value,
      name: product.value.name,
      payment_method: selectedPaymentMethod.value,
      contact: contactEmail.value,
      num: props.quantity,
      // contact_txt can be added if there's a field for it
    };
    const response = await apiClient.post<PaymentDetails>('/api/v2/payments/initiate', payload);
    paymentDetails.value = response.data;
    paymentInitiated.value = true; // Prevent re-initiation
    
    if (response.data.success) {
      startPollingStatus();
    } else {
      paymentError.value = response.data.message || 'Payment initiation failed.';
    }
  } catch (err: any) {
    console.error('Payment initiation error:', err);
    paymentError.value = err.response?.data?.error || err.message || 'An unexpected error occurred during payment initiation.';
  } finally {
    initiatingPayment.value = false;
  }
};

const checkPaymentStatus = async () => {
  if (!outOrderId.value) return;
  try {
    const response = await apiClient.post('/api/v2/payments/status', { out_order_id: outOrderId.value });
    if (response.data.status === 'paid') {
      orderStatus.value = 'Payment Successful!';
      stopPollingStatus();
      // Redirect to success page
      router.push({ name: 'OrderSuccess', params: { orderId: outOrderId.value } }); 
    } else if (response.data.status === 'not_found') {
        orderStatus.value = 'Order not found. Please contact support.';
        stopPollingStatus();
    } else {
      orderStatus.value = 'Awaiting payment...'; // Or more specific status from backend if provided
    }
  } catch (err) {
    console.error('Error polling payment status:', err);
    orderStatus.value = 'Error checking status.';
    // Optionally stop polling on certain errors
  }
};

const startPollingStatus = () => {
  if (pollingInterval) clearInterval(pollingInterval); // Clear existing interval if any
  orderStatus.value = 'Confirming payment...';
  // Initial check after a short delay
  setTimeout(checkPaymentStatus, 3000); 
  pollingInterval = setInterval(checkPaymentStatus, 5000); // Poll every 5 seconds

  // Stop polling after a certain time (e.g., 5 minutes) to avoid indefinite polling
  setTimeout(() => {
    if (orderStatus.value === 'Confirming payment...' || orderStatus.value === 'Awaiting payment...') {
        stopPollingStatus();
        orderStatus.value = 'Payment confirmation timed out. Please check your order history or contact support.';
    }
  }, 5 * 60 * 1000); 
};

const stopPollingStatus = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = undefined;
  }
};

onMounted(() => {
  fetchProductDetails();
  fetchSystemInfo();
});

watch(() => props.productId, () => { // Refetch if productId changes (e.g., browser back/forward)
    fetchProductDetails();
});

// Cleanup polling on component unmount
import { onUnmounted } from 'vue';
onUnmounted(stopPollingStatus);

</script>

<style scoped>
.payment-page-container {
  max-width: 700px;
  margin: 20px auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
.loading, .error-message {
  text-align: center;
  padding: 20px;
  font-size: 1.2rem;
}
.error-message { color: red; }

.order-summary, .contact-info, .payment-methods, .payment-qr, .payment-link {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}
.order-summary:last-child, .contact-info:last-child, .payment-methods:last-child {
  border-bottom: none;
}

h2, h3 {
  color: #333;
  margin-bottom: 1rem;
}
h2 { text-align: center; }

.order-summary p {
  margin: 0.5rem 0;
  font-size: 1rem;
}
.total-price-value {
  font-weight: bold;
  font-size: 1.2rem;
  color: #007bff;
}

.form-group {
  margin-bottom: 1rem;
}
.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}
.form-group input[type="email"] {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
.form-group input[type="email"]:disabled {
    background-color: #f0f0f0;
}


.payment-method-option {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  border: 1px solid transparent;
  border-radius: 4px;
}
.payment-method-option input[type="radio"] {
  margin-right: 10px;
}
.payment-method-option input[type="radio"]:disabled + label {
    color: #aaa;
    cursor: not-allowed;
}
.payment-method-option input[type="radio"]:disabled + label .payment-icon {
    filter: grayscale(100%);
}

.payment-method-option label {
  display: flex;
  align-items: center;
  cursor: pointer;
}
.payment-icon {
  width: 24px; /* Adjust size as needed */
  height: 24px;
  margin-right: 8px;
  object-fit: contain;
}

.confirm-pay-button {
  display: block;
  width: 100%;
  padding: 12px 25px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  text-align: center;
  margin-top: 1rem;
}
.confirm-pay-button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}
.confirm-pay-button:hover:not(:disabled) {
  background-color: #218838;
}

.payment-qr {
  text-align: center;
}
.payment-qr img {
  max-width: 250px;
  margin: 10px auto;
  border: 1px solid #eee;
}
.payment-link {
    text-align: center;
}
.button-link {
    display: inline-block;
    padding: 10px 20px;
    margin-top: 10px;
    background-color: #007bff;
    color: white;
    text-decoration: none;
    border-radius: 5px;
}
.button-link:hover {
    background-color: #0056b3;
}

.status-message {
  margin-top: 1rem;
  font-weight: bold;
  font-size: 1.1rem;
}
</style>
