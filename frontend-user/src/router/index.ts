import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import Home from '../views/Home.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/products/:id/detail', // Matches the path used in Home.vue for navigation
    name: 'ProductDetail',
    component: () => import('../views/ProductDetail.vue'), // Lazy load
    props: true // Automatically pass route.params as props to ProductDetail.vue
  },
  {
    path: '/pay/product/:productId/quantity/:quantity', 
    name: 'ProductPay',
    component: () => import('../views/ProductPay.vue'), // Lazy load
    props: route => ({
      productId: route.params.productId, // Keep as string or convert to Number if needed in component
      quantity: parseInt(route.params.quantity as string, 10) || 1 // Convert quantity to number
    })
  },
  {
    path: '/order/success/:orderId',
    name: 'OrderSuccess',
    component: () => import('../views/OrderSuccess.vue'), // Lazy load
    props: true // Pass route.params.orderId as a prop to OrderSuccess.vue
  },
  {
    path: '/search',
    name: 'OrderSearch', // Changed from 'Search' to 'OrderSearch' for clarity
    component: () => import('../views/OrderSearch.vue') // Lazy load
  },
  // {
  //   path: '/qrcode', // This was a named route in original, might be for specific payment flow
  //   name: 'QrCodePage', 
  //   component: () => import('../views/QrCodePage.vue'), // Lazy load
  // },
  {
    path: '/contact',
    name: 'Contact',
    component: () => import('../views/Contact.vue') // Lazy load
  },
  // Optional: Catch-all route for 404
  // { 
  //   path: '/:pathMatch(.*)*', 
  //   name: 'NotFound', 
  //   component: () => import('../views/NotFound.vue') 
  // }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
