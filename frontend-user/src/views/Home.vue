<template>
  <div class="home-container">
    <header class="home-header">
      <h2>Theme: {{ themeName }}</h2>
      <p v-if="loading">Loading products...</p>
      <p v-if="error" class="error-message">{{ error }}</p>
    </header>

    <div v-if="!loading && !error" class="categories-container">
      <div v-for="category in categories" :key="category.cag_name" class="category-section">
        <h3>{{ category.cag_name }}</h3>
        <div class="products-grid">
          <div v-for="product in category.shops" :key="product.id" class="product-card" @click="goToProductDetail(product.id)">
            <img v-if="product.img_url" :src="product.img_url" :alt="product.name" class="product-image" />
            <img v-else src="https://via.placeholder.com/150?text=No+Image" alt="No image available" class="product-image">
            <div class="product-info">
              <h4>{{ product.name }}</h4>
              <p class="product-price">Price: ¥{{ (product.price / 100).toFixed(2) }}</p> <!-- Assuming price is in cents -->
              <p class="product-stock" :class="getStockClass(product.stock_status)">
                Stock: {{ product.stock_status }}
              </p>
              <!-- Add more product details if needed -->
            </div>
          </div>
        </div>
         <p v-if="category.shops.length === 0" class="no-products">No products in this category.</p>
      </div>
       <p v-if="categories.length === 0 && !loading" class="no-products">No categories or products found.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '../services/api';

// Define interfaces based on the backend response structure for /api/v2/products_list
interface Product {
  id: number;
  cag_name: string;
  name: string;
  info?: string;
  img_url?: string;
  sort: number;
  price: number; // Assuming price is in cents
  price_wholesale?: string;
  auto: boolean;
  sales: number;
  tag?: string;
  isactive: boolean;
  stock_status?: '充足' | '少量' | '缺货' | string; // Allow string for flexibility
}

interface Category {
  cag_name: string;
  shops: Product[];
}

interface ProductsListResponse {
  theme: string;
  categories: Category[];
}

const themeName = ref<string>('default');
const categories = ref<Category[]>([]);
const loading = ref<boolean>(true);
const error = ref<string | null>(null);
const router = useRouter();

onMounted(async () => {
  try {
    loading.value = true;
    error.value = null;
    const response = await apiClient.get<ProductsListResponse>('/api/v2/products_list');
    if (response.data) {
      themeName.value = response.data.theme;
      categories.value = response.data.categories;
    } else {
      categories.value = []; // Ensure categories is an empty array if no data
    }
  } catch (err: any) {
    console.error('Failed to load products list:', err);
    error.value = 'Failed to load products. Please try again later.';
    categories.value = []; // Clear categories on error
  } finally {
    loading.value = false;
  }
});

const goToProductDetail = (productId: number) => {
  // Ensure your router has a route named 'ProductDetail' or similar
  // that accepts an 'id' param. E.g., path: '/products/:id/detail'
  router.push({ name: 'ProductDetail', params: { id: productId } });
};

const getStockClass = (stockStatus?: string) => {
  if (!stockStatus) return '';
  switch (stockStatus) {
    case '充足':
      return 'stock-sufficient';
    case '少量':
      return 'stock-low';
    case '缺货':
      return 'stock-out';
    default:
      return '';
  }
};
</script>

<style scoped>
.home-container {
  padding: 1rem;
}

.home-header {
  text-align: center;
  margin-bottom: 2rem;
}

.error-message {
  color: red;
}

.categories-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.category-section {
  border: 1px solid #eee;
  padding: 1rem;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.category-section h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  border-bottom: 2px solid #007bff;
  padding-bottom: 0.5rem;
  color: #333;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.product-card {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  cursor: pointer;
  transition: box-shadow 0.3s ease;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.product-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.product-image {
  width: 100%;
  height: 150px; /* Fixed height for images */
  object-fit: cover; /* Scale image nicely */
  margin-bottom: 0.5rem;
  border-radius: 4px;
}

.product-info h4 {
  margin: 0.5rem 0;
  font-size: 1.1rem;
  color: #333;
}

.product-price {
  color: #007bff;
  font-weight: bold;
  margin: 0.25rem 0;
}

.product-stock {
  font-size: 0.9rem;
  margin: 0.25rem 0;
}

.stock-sufficient {
  color: green;
}

.stock-low {
  color: orange;
}

.stock-out {
  color: red;
}

.no-products {
  text-align: center;
  color: #777;
  margin-top: 1rem;
}
</style>
