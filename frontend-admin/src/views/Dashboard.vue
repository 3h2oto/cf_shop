<template>
  <div>
    <h1>Admin Dashboard</h1>
    <p>Welcome, admin!</p>
    <button @click="logout">Logout</button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
const router = useRouter();
const logout = () => {
  localStorage.removeItem('access_token');
  router.push('/login');
};
</script>

<style scoped>
div {
  padding: 20px;
  text-align: center;
}
button {
  margin-top: 20px;
  padding: 10px 20px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background-color: #c82333;
}
</style>
