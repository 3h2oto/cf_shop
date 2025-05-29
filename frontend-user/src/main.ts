import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
// import { createPinia } from 'pinia'; // If state management is needed later

// Optional: Import a global CSS file if you have one
// import './assets/main.css'; 

const app = createApp(App)

app.use(router)
// app.use(createPinia()); // If state management is needed later

app.mount('#app')
