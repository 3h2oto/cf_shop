<template>
  <div class="product-detail-container">
    <div v-if="loading" class="loading">Loading product details...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-if="product && !loading && !error" class="product-content">
      <div class="product-image-section">
        <img :src="product.img_url || 'https://via.placeholder.com/300x300?text=No+Image'" :alt="product.name" class="product-image-large" />
      </div>

      <div class="product-info-section">
        <h2>{{ product.name }}</h2>
        
        <p class="product-description" v-html="product.discription || 'No description available.'"></p> <!-- Use v-html if description contains HTML -->
        
        <div class="price-section">
          <p class="current-price">Price: ¥{{ (currentUnitPrice / 100).toFixed(2) }}</p>
          <div v-if="product.pifa && product.pifa.nums && product.pifa.prices" class="wholesale-pricing">
            <h4>Quantity Discounts:</h4>
            <ul>
              <li v-for="(tier, index) in product.pifa.nums" :key="tier">
                {{ tier }} items: ¥{{ (product.pifa.prices[index + 1] / 100).toFixed(2) }} each 
                <!-- Assuming pifa.prices[0] is base, pifa.prices[1] is for first tier in nums -->
              </li>
            </ul>
          </div>
        </div>

        <div class="stock-section">
          <p>Stock: 
            <span v-if="product.stock_value === 0" class="stock-out">Out of Stock</span>
            <span v-else-if="product.stock_value === 9999" class="stock-sufficient">Available</span>
            <span v-else :class="getStockClass(product.stock_value)">{{ product.stock_value }}</span>
          </p>
        </div>

        <div class="quantity-section">
          <label for="quantity">Quantity:</label>
          <div class="quantity-controls">
            <button @click="decrementQuantity" :disabled="quantity <= 1">-</button>
            <input type="number" id="quantity" v-model.number="quantity" min="1" :max="maxQuantity" @change="validateQuantity" />
            <button @click="incrementQuantity" :disabled="quantity >= maxQuantity">+</button>
          </div>
        </div>

        <div class="total-price-section">
          <h3>Total: ¥{{ (totalPrice / 100).toFixed(2) }}</h3>
        </div>

        <button @click="proceedToPayment" class="buy-now-button" :disabled="product.stock_value === 0 || quantity > maxQuantity">
          Proceed to Payment
        </button>
      </div>
    </div>
    <div v-if="!product && !loading && !error" class="product-not-found">
      Product not found.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '../services/api';

interface PifaDetail {
  nums: string[]; // e.g., ["1~9", "10~100", "101~"]
  prices: number[]; // e.g., [basePrice, tier1Price, tier2Price, tier3Price] - prices[0] is base price
  slice: string[]; // e.g., ["9", "100"] - the thresholds
}

interface Product {
  id: number;
  name: string;
  img_url?: string;
  discription?: string; // From backend, maps to description
  price: number; // Base price in cents
  stock_value: number; // 0 for out of stock, 9999 for effectively infinite, or actual count
  pifa?: PifaDetail;
  // Add other fields from ProductDetailResponse if needed
}

const route = useRoute();
const router = useRouter();

const product = ref<Product | null>(null);
const quantity = ref<number>(1);
const loading = ref<boolean>(true);
const error = ref<string | null>(null);

const productId = computed(() => route.params.id as string);

const currentUnitPrice = computed(() => {
  if (!product.value) return 0;
  if (product.value.pifa && product.value.pifa.slice && product.value.pifa.prices.length > 1) {
    const thresholds = product.value.pifa.slice.map(Number); // [9, 100]
    const pifaPrices = product.value.pifa.prices; // [base, price_for_upto_9, price_for_upto_100]

    // Find the correct price tier
    // pifaPrices[0] is base, pifaPrices[1] is for slice[0] threshold, etc.
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (quantity.value >= (i > 0 ? thresholds[i-1] + 1 : 1) && quantity.value <= thresholds[i]) {
         // This logic is a bit tricky with the provided pifa structure.
         // Assuming pifa.prices[0] is base price for qty < first threshold.
         // pifa.prices[i+1] corresponds to the price for the tier ending at thresholds[i].
         // A simpler pifa structure might be [{minQty: 1, price: X}, {minQty: 10, price: Y}]
         // For now, let's use a simplified approach based on the provided pifa.nums
         // "1~9": prices[1], "10~100": prices[2], "101~": prices[3]
         
         // Let's iterate through pifa.slice (thresholds)
         // If quantity <= thresholds[0], use pifa.prices[1]
         // If quantity > thresholds[0] and <= thresholds[1], use pifa.prices[2]
         // etc.
         
         let price = pifaPrices[0]; // Default to base price
         for(let j = 0; j < thresholds.length; j++) {
             if (quantity.value <= thresholds[j]) {
                 price = pifaPrices[j+1]; // prices[0] is base, prices[1] is for first tier
                 break;
             }
             // If quantity is greater than the current threshold, check the next one
             // If it's the last threshold and quantity is still greater, use the price for the highest tier
             if (j === thresholds.length - 1 && quantity.value > thresholds[j]) {
                 price = pifaPrices[j+2] || pifaPrices[pifaPrices.length -1]; // price for "threshold+"
                 break;
             }
         }
         return price;

      }
    }
    return product.value.price; // Base price
  }
  return product.value.price; // Fallback to base price
});


const totalPrice = computed(() => {
  return currentUnitPrice.value * quantity.value;
});

const maxQuantity = computed(() => {
  if (product.value && product.value.stock_value !== 9999) {
    return product.value.stock_value;
  }
  return Infinity; // Effectively no limit if stock is 9999 or not set
});

const fetchProductDetail = async () => {
  if (!productId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get(`/api/v2/products/${productId.value}/detail`);
    product.value = response.data as Product; // Assuming response.data matches Product interface
    if (product.value && product.value.stock_value === 0) {
      quantity.value = 0; // Cannot buy if out of stock
    } else {
      quantity.value = 1; // Reset to 1 when new product loads
    }
  } catch (err: any) {
    console.error('Failed to load product details:', err);
    error.value = 'Failed to load product details. Please try again later.';
    product.value = null;
  } finally {
    loading.value = false;
  }
};

onMounted(fetchProductDetail);

// Watch for route param changes if navigating between product detail pages directly
watch(productId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    fetchProductDetail();
  }
});

const incrementQuantity = () => {
  if (quantity.value < maxQuantity.value) {
    quantity.value++;
  }
};

const decrementQuantity = () => {
  if (quantity.value > 1) {
    quantity.value--;
  }
};

const validateQuantity = () => {
  if (quantity.value < 1) {
    quantity.value = 1;
  } else if (quantity.value > maxQuantity.value && maxQuantity.value !== Infinity) {
    quantity.value = maxQuantity.value;
  }
};

const proceedToPayment = () => {
  if (!product.value || product.value.stock_value === 0 || quantity.value === 0) {
    alert('This product is out of stock or quantity is zero.');
    return;
  }
  // Navigate to a payment page, passing product ID and quantity
  // Ensure your router has a route like '/pay/product/:productId/quantity/:quantity'
  router.push({ 
    name: 'ProductPay',
    params: { 
      productId: product.value.id.toString(), // Ensure productId is string
      quantity: quantity.value.toString()   // Ensure quantity is string for params
    }
  });
};

const getStockClass = (stockValue: number) => {
  if (stockValue > 10 || stockValue === 9999) return 'stock-sufficient';
  if (stockValue > 0) return 'stock-low';
  return 'stock-out'; // Should be caught by stock_value === 0 already
};
</script>

<style scoped>
.product-detail-container {
  max-width: 960px;
  margin: 20px auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.loading, .error-message, .product-not-found {
  text-align: center;
  padding: 20px;
  font-size: 1.2rem;
}
.error-message { color: red; }

.product-content {
  display: grid;
  grid-template-columns: 1fr; /* Single column for small screens */
  gap: 20px;
}

@media (min-width: 768px) {
  .product-content {
    grid-template-columns: 1fr 2fr; /* Two columns for larger screens */
  }
}

.product-image-large {
  width: 100%;
  max-width: 350px;
  height: auto;
  border-radius: 8px;
  border: 1px solid #eee;
  margin-bottom: 10px; /* For smaller screens */
}

.product-info-section h2 {
  margin-top: 0;
  font-size: 2rem;
  color: #333;
}

.product-description {
  color: #555;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}
.product-description >>> p { /* Style p tags if v-html is used */
  margin-bottom: 1em;
}


.price-section {
  margin-bottom: 1.5rem;
}
.current-price {
  font-size: 1.8rem;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 0.5rem;
}
.wholesale-pricing h4 {
  margin-top: 10px;
  margin-bottom: 5px;
  font-size: 1rem;
  color: #444;
}
.wholesale-pricing ul {
  list-style: none;
  padding-left: 0;
  font-size: 0.9rem;
  color: #666;
}
.wholesale-pricing li {
  margin-bottom: 3px;
}

.stock-section p {
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
}
.stock-sufficient { color: green; }
.stock-low { color: orange; }
.stock-out { color: red; font-weight: bold; }

.quantity-section {
  margin-bottom: 1.5rem;
}
.quantity-section label {
  font-weight: bold;
  margin-right: 10px;
}
.quantity-controls {
  display: flex;
  align-items: center;
}
.quantity-controls input {
  width: 60px;
  text-align: center;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin: 0 10px;
}
.quantity-controls button {
  padding: 8px 12px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.quantity-controls button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}

.total-price-section h3 {
  font-size: 1.5rem;
  color: #28a745;
  margin-bottom: 1.5rem;
}

.buy-now-button {
  display: inline-block;
  padding: 12px 25px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  text-align: center;
}
.buy-now-button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}
.buy-now-button:hover:not(:disabled) {
  background-color: #218838;
}
</style>
