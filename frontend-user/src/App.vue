<template>
  <div id="app-layout">
    <header class="app-header">
      <!-- Placeholder for Logo/Site Name -->
      <h1>{{ siteName }}</h1>
      <!-- Basic Navigation (can be expanded later) -->
      <nav>
        <router-link to="/">Home</router-link>
        <!-- <router-link to="/search">Search</router-link> -->
        <!-- <router-link to="/contact">Contact</router-link> -->
      </nav>
    </header>

    <main class="app-main">
      <router-view></router-view>
    </main>

    <footer class="app-footer">
      <p>{{ siteFooter }}</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from './services/api';

const siteName = ref('Kamifaka'); // Default site name
const siteFooter = ref('© Kamifaka'); // Default footer

// Optional: Fetch site name and footer from system_info if needed globally
// For simplicity, keeping it static here for now, can be moved to a Pinia store
onMounted(async () => {
  try {
    // This assumes your /api/v2/system_info returns configs like 'web_name' and 'web_footer'
    const response = await apiClient.get('/api/v2/system_info');
    if (response.data && response.data.configs) {
      siteName.value = response.data.configs.web_name || 'Kamifaka';
      siteFooter.value = response.data.configs.web_footer || `© ${new Date().getFullYear()} Kamifaka`;
    }
  } catch (error) {
    console.error('Failed to load global site info for App.vue:', error);
  }
});
</script>

<style scoped>
#app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  color: #2c3e50;
}

.app-header {
  background-color: #f8f9fa;
  padding: 1rem 2rem;
  border-bottom: 1px solid #e7e7e7;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.app-header nav a {
  margin-left: 1rem;
  text-decoration: none;
  color: #007bff;
}

.app-header nav a:hover {
  text-decoration: underline;
}

.app-main {
  flex-grow: 1;
  padding: 1rem; /* Add some padding around the content */
}

.app-footer {
  background-color: #f8f9fa;
  padding: 1rem;
  text-align: center;
  border-top: 1px solid #e7e7e7;
  font-size: 0.9rem;
  color: #6c757d;
}
</style>
