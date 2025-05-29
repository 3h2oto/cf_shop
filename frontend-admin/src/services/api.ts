import axios from 'axios';

// Determine the base URL for the API.
// If your frontend and backend are served from the same domain in production,
// a relative URL (e.g., '/api/v4') is often best.
// For local development, you might point to your Cloudflare Worker's local port.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/'; // Default to relative if not set

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Optional: Interceptor to add the auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Optional: Interceptor to handle global errors like 401 (unauthorized)
// apiClient.interceptors.response.use(
//   (response) => {
//     return response;
//   },
//   (error) => {
//     if (error.response && error.response.status === 401) {
//       // Handle unauthorized access, e.g., redirect to login
//       localStorage.removeItem('access_token');
//       // Assuming your router instance is available or you emit an event
//       // router.push('/login'); // This might not work directly here, depends on setup
//       console.error('Unauthorized, redirecting to login.');
//       window.location.href = '/login'; // Simple redirect
//     }
//     return Promise.reject(error);
//   }
// );

export default apiClient;
