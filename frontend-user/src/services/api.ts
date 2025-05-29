import axios from 'axios';

// Determine the base URL for the API.
// If your frontend and backend are served from the same domain in production,
// a relative URL (e.g., '/api/v2') is often best.
// For local development, you might point to your Cloudflare Worker's local port.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/'; // Default to relative if not set

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// No interceptors needed for user frontend initially,
// unless there are user-specific authenticated routes later.

export default apiClient;
