import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
// import { createPinia } from 'pinia' // Uncomment if Pinia is used

import './assets/main.css' // Optional: if you have a global stylesheet

const app = createApp(App)

app.use(router)
// app.use(createPinia()) // Uncomment if Pinia is used

app.mount('#app')
