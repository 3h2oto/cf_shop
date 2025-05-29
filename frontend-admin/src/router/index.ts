import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import Login from '../views/Login.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false } // Explicitly mark as not requiring auth
  },
  {
    path: '/admin/dashboard',
    name: 'AdminDashboard',
    component: () => import('../views/Dashboard.vue'), // Lazy load
    meta: { requiresAuth: true } // Mark as requiring authentication
  },
  // Redirect root path
  {
    path: '/',
    redirect: () => {
      // Redirect to dashboard if authenticated, otherwise to login
      const isAuthenticated = !!localStorage.getItem('access_token');
      if (isAuthenticated) {
        return { name: 'AdminDashboard' };
      } else {
        return { name: 'Login' };
      }
    }
  },
  // Optional: Catch-all route for 404 - can be added later
  // { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('../views/NotFound.vue') }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Navigation Guard
router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('access_token');
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);

  if (requiresAuth && !isAuthenticated) {
    // If route requires auth and user is not authenticated, redirect to login
    next({ name: 'Login' });
  } else if (to.name === 'Login' && isAuthenticated) {
    // If user is authenticated and tries to access login page, redirect to dashboard
    next({ name: 'AdminDashboard' });
  } else {
    // Otherwise, allow navigation
    next();
  }
});

export default router;
