<template>
  <div class="login-container">
    <div class="login-form">
      <h2>Admin Login</h2>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" v-model="email" required />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" v-model="password" required />
        </div>
        <button type="submit" :disabled="loading">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
        <p v-if="error" class="error-message">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '../services/api'; // Assuming api.ts is created

const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);
const router = useRouter();

const handleLogin = async () => {
  error.value = null;
  loading.value = true;
  try {
    // The API endpoint is /api/v4/login as per previous backend setup
    const response = await apiClient.post('/api/v4/login', {
      email: email.value,
      password: password.value,
    });

    if (response.data && response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
      // Redirect to a placeholder dashboard page.
      // This route will need to be defined in the router.
      router.push('/admin/dashboard'); 
    } else {
      // Handle cases where token is not in the expected format
      error.value = 'Login failed: Invalid response from server.';
    }
  } catch (err: any) {
    if (err.response && err.response.data && err.response.data.error) {
      error.value = `Login failed: ${err.response.data.error}`;
    } else if (err.message) {
      error.value = `Login failed: ${err.message}`;
    } else {
      error.value = 'Login failed: An unexpected error occurred.';
    }
    console.error('Login error:', err);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f0f2f5;
}

.login-form {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #555;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

button {
  width: 100%;
  padding: 0.75rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

.error-message {
  color: red;
  margin-top: 1rem;
  text-align: center;
}
</style>
