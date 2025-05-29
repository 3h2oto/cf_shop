<template>
  <div class="order-success-container">
    <div v-if="loading" class="loading">Loading order details...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-if="orderDetails && !loading && !error" class="order-details-content">
      <h2>Payment Successful!</h2>
      <p>Thank you for your purchase. Here are your order details:</p>
      
      <div class="order-info">
        <p><strong>Order ID:</strong> {{ orderId }}</p>
        <p><strong>Order Time:</strong> {{ formattedOrderTime }}</p>
      </div>

      <div v-if="orderDetails.card" class="card-details">
        <h3>Your Card Information:</h3>
        <pre class="card-info-box">{{ orderDetails.card }}</pre>
        <button @click="copyCardDetails" class="copy-button">
          {{ copyButtonText }}
        </button>
      </div>
      <div v-else class="no-card-info">
        <p>No card details associated with this order (e.g., for non-card products or if details are sent via email).</p>
      </div>

      <router-link to="/" class="home-button">Back to Home</router-link>
    </div>
    <div v-if="!orderDetails && !loading && !error" class="order-not-found">
      Order details could not be retrieved. Please check your order ID or contact support.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, defineProps } from 'vue';
// import { useRoute } from 'vue-router'; // Not needed if using props: true
import apiClient from '../services/api';

interface OrderDetails {
  card: string | null;
  updatetime: string; // ISO timestamp
}

const props = defineProps<{
  orderId: string; // This will be out_order_id / trade_no
}>();

const orderDetails = ref<OrderDetails | null>(null);
const loading = ref<boolean>(true);
const error = ref<string | null>(null);
const copyButtonText = ref<string>('Copy Card Details');

// const route = useRoute(); // Not needed if using props
// const orderId = computed(() => route.params.orderId as string); // Not needed if using props

const formattedOrderTime = computed(() => {
  if (orderDetails.value?.updatetime) {
    return new Date(orderDetails.value.updatetime).toLocaleString();
  }
  return 'N/A';
});

const fetchOrderDetails = async () => {
  if (!props.orderId) {
    error.value = 'Order ID is missing.';
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.post<OrderDetails>('/api/v2/orders/retrieve_card', {
      out_order_id: props.orderId,
    });
    orderDetails.value = response.data;
  } catch (err: any) {
    console.error('Failed to load order details:', err);
    if (err.response && err.response.status === 404) {
        error.value = err.response.data.message || 'Order not found or not paid. Please verify your order ID or contact support if payment was successful.';
    } else {
        error.value = 'Failed to load order details. Please try again later or contact support.';
    }
    orderDetails.value = null;
  } finally {
    loading.value = false;
  }
};

const copyCardDetails = async () => {
  if (orderDetails.value?.card) {
    try {
      await navigator.clipboard.writeText(orderDetails.value.card);
      copyButtonText.value = 'Copied!';
      setTimeout(() => {
        copyButtonText.value = 'Copy Card Details';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy card details: ', err);
      copyButtonText.value = 'Failed to copy';
       setTimeout(() => {
        copyButtonText.value = 'Copy Card Details';
      }, 2000);
    }
  }
};

onMounted(fetchOrderDetails);
</script>

<style scoped>
.order-success-container {
  max-width: 700px;
  margin: 20px auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  text-align: center;
}

.loading, .error-message, .order-not-found {
  padding: 20px;
  font-size: 1.2rem;
}
.error-message { color: red; }

.order-details-content h2 {
  color: #28a745;
  margin-bottom: 1rem;
}

.order-info {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #f9f9f9;
  border-radius: 4px;
  text-align: left;
}
.order-info p {
  margin: 0.5rem 0;
}

.card-details {
  margin-bottom: 1.5rem;
}
.card-details h3 {
  margin-bottom: 0.5rem;
}
.card-info-box {
  background-color: #e9ecef;
  padding: 1rem;
  border-radius: 4px;
  white-space: pre-wrap; /* Allows line breaks */
  word-wrap: break-word; /* Breaks long words if necessary */
  text-align: left;
  font-family: 'Courier New', Courier, monospace;
  border: 1px solid #ced4da;
  max-height: 200px; /* Limit height and make scrollable if content is too long */
  overflow-y: auto;
}

.copy-button {
  margin-top: 10px;
  padding: 8px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.copy-button:hover {
  background-color: #0056b3;
}

.no-card-info {
  margin: 1.5rem 0;
  padding: 1rem;
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeeba;
  border-radius: 4px;
}

.home-button {
  display: inline-block;
  padding: 10px 20px;
  background-color: #6c757d;
  color: white;
  text-decoration: none;
  border-radius: 5px;
  transition: background-color 0.2s;
}
.home-button:hover {
  background-color: #5a6268;
}
</style>
