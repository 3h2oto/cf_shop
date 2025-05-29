<template>
  <div class="contact-page-container">
    <h2>Contact Us</h2>

    <div v-if="isLoading" class="loading-indicator">
      Loading contact information...
    </div>

    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
    </div>

    <div v-if="!isLoading && !error && contactInfo" class="contact-info-content" v-html="contactInfo">
    </div>

    <div v-if="!isLoading && !error && !contactInfo" class="no-contact-info">
      <p>Contact information is currently unavailable.</p>
    </div>

    <router-link to="/" class="home-button-contact">Back to Home</router-link>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from '../services/api';

const contactInfo = ref<string | null>(null);
const isLoading = ref<boolean>(true);
const error = ref<string | null>(null);

onMounted(async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get('/api/v2/system_info');
    if (response.data && response.data.configs && response.data.configs.contact_us) {
      contactInfo.value = response.data.configs.contact_us;
    } else {
      contactInfo.value = null; // Or a default message if 'contact_us' is not found
      console.warn("Contact information ('contact_us' key) not found in system_info response.");
    }
  } catch (err: any) {
    console.error('Failed to load contact information:', err);
    error.value = 'Failed to load contact information. Please try again later.';
    contactInfo.value = null;
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.contact-page-container {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  text-align: center; /* Center align title and button */
}

h2 {
  margin-bottom: 1.5rem;
  color: #333;
}

.loading-indicator,
.error-message,
.no-contact-info {
  padding: 1rem;
  margin-top: 1rem;
  text-align: center;
}

.error-message {
  color: red;
  border: 1px solid red;
  background-color: #ffe0e0;
  border-radius: 4px;
}

.no-contact-info {
  color: #555;
}

.contact-info-content {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 4px;
  background-color: #f9f9f9;
  text-align: left; /* Align content of v-html to left */
}

/* Style content within v-html if needed, use deep selector */
.contact-info-content >>> p {
  margin-bottom: 0.5em;
  line-height: 1.6;
}
.contact-info-content >>> a {
  color: #007bff;
}
.contact-info-content >>> a:hover {
  text-decoration: underline;
}


.home-button-contact {
  display: inline-block;
  margin-top: 2rem;
  padding: 10px 20px;
  background-color: #6c757d;
  color: white;
  text-decoration: none;
  border-radius: 5px;
  transition: background-color 0.2s;
}
.home-button-contact:hover {
  background-color: #5a6268;
}
</style>
