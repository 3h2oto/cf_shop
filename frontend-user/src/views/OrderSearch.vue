<template>
  <div class="order-search-container">
    <h2>Search Your Orders</h2>
    <p>Enter your contact information (e.g., email or phone) used during purchase to find recent orders.</p>
    
    <form @submit.prevent="handleSearch" class="search-form">
      <div class="form-group">
        <label for="contact">Contact Information:</label>
        <input type="text" id="contact" v-model="contact" placeholder="Enter email or phone" required />
      </div>
      <button type="submit" :disabled="isLoading" class="search-button">
        {{ isLoading ? 'Searching...' : 'Search Orders' }}
      </button>
    </form>

    <div v-if="isLoading" class="loading-indicator">Searching for orders...</div>
    
    <div v-if="error" class="error-message">
      <p>Error: {{ error }}</p>
    </div>

    <div v-if="searchPerformed && !isLoading && !error">
      <div v-if="searchedOrders.length > 0" class="search-results">
        <h3>Search Results:</h3>
        <div v-for="order in searchedOrders" :key="order.out_order_id" class="order-item">
          <p><strong>Order ID:</strong> {{ order.out_order_id }}</p>
          <p><strong>Product:</strong> {{ order.name }}</p>
          <p><strong>Order Time:</strong> {{ order.updatetime }}</p>
          <div v-if="order.card" class="card-details-search">
            <h4>Card Information:</h4>
            <pre class="card-info-box">{{ order.card }}</pre>
            <button @click="copyCardDetails(order.card, order.out_order_id)" :id="'copy-btn-' + order.out_order_id" class="copy-button">
              Copy Card
            </button>
          </div>
          <div v-else class="no-card-info-search">
            <p>No card details available for this order.</p>
          </div>
        </div>
      </div>
      <div v-else class="no-results-message">
        <p>No recent orders found for this contact information, or your order is older than 2 hours.</p>
      </div>
    </div>
     <router-link to="/" class="home-button-search">Back to Home</router-link>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import apiClient from '../services/api';

interface SearchedOrder {
  out_order_id: string;
  name: string; // Product name
  card: string | null;
  updatetime: string; // Formatted datetime string
}

const contact = ref<string>('');
const searchedOrders = ref<SearchedOrder[]>([]);
const isLoading = ref<boolean>(false);
const error = ref<string | null>(null);
const searchPerformed = ref<boolean>(false); // To distinguish initial state from "no results"

const handleSearch = async () => {
  if (!contact.value.trim()) {
    error.value = 'Please enter your contact information.';
    return;
  }

  isLoading.value = true;
  error.value = null;
  searchPerformed.value = true;
  searchedOrders.value = []; // Clear previous results

  try {
    const response = await apiClient.post<{ message?: string; out_order_id?: string; name?: string; card?: string; updatetime?: string }>('/api/v2/orders/search', {
      contact: contact.value.trim(),
    });

    if (response.data.message === "not found") {
      // Handled by searchedOrders.length being 0 and searchPerformed being true
    } else if (response.data.out_order_id) {
      // Backend returns a single object if found, wrap it in an array for consistency
      searchedOrders.value = [{
        out_order_id: response.data.out_order_id,
        name: response.data.name || 'N/A',
        card: response.data.card || null,
        updatetime: response.data.updatetime || 'N/A',
      }];
    }
  } catch (err: any) {
    console.error('Failed to search orders:', err);
    error.value = err.response?.data?.error || err.message || 'Failed to search orders. Please try again later.';
  } finally {
    isLoading.value = false;
  }
};

const copyCardDetails = async (cardDetails: string | null, orderId: string) => {
  const button = document.getElementById('copy-btn-' + orderId) as HTMLButtonElement | null;
  if (!cardDetails || !button) return;

  const originalButtonText = button.innerText;
  try {
    await navigator.clipboard.writeText(cardDetails);
    button.innerText = 'Copied!';
    setTimeout(() => {
      button.innerText = originalButtonText;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy card details: ', err);
    button.innerText = 'Failed!';
    setTimeout(() => {
      button.innerText = originalButtonText;
    }, 2000);
  }
};
</script>

<style scoped>
.order-search-container {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

h2 {
  text-align: center;
  margin-bottom: 1rem;
  color: #333;
}
.order-search-container > p {
    text-align: center;
    margin-bottom: 1.5rem;
    color: #555;
}

.search-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input[type="text"] {
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

.search-button {
  padding: 0.75rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}
.search-button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}
.search-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.loading-indicator, .error-message, .no-results-message {
  text-align: center;
  padding: 1rem;
  margin-top: 1rem;
}
.error-message { color: red; border: 1px solid red; background-color: #ffe0e0; border-radius: 4px;}
.no-results-message { color: #555; }

.search-results {
  margin-top: 2rem;
}
.search-results h3 {
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.order-item {
  background-color: #f9f9f9;
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 1rem;
}
.order-item p {
  margin: 0.3rem 0;
}

.card-details-search h4 {
  margin-top: 0.5rem;
  margin-bottom: 0.3rem;
  font-size: 1rem;
}
.card-info-box {
  background-color: #e9ecef;
  padding: 0.75rem;
  border-radius: 4px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Courier New', Courier, monospace;
  border: 1px solid #ced4da;
  max-height: 150px;
  overflow-y: auto;
  margin-bottom: 0.5rem;
}

.copy-button {
  padding: 6px 12px;
  font-size: 0.9rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.copy-button:hover {
  background-color: #0056b3;
}

.no-card-info-search p {
    font-style: italic;
    color: #777;
}

.home-button-search {
  display: inline-block;
  margin-top: 2rem;
  padding: 10px 20px;
  background-color: #6c757d;
  color: white;
  text-decoration: none;
  border-radius: 5px;
  transition: background-color 0.2s;
}
.home-button-search:hover {
  background-color: #5a6268;
}

</style>
