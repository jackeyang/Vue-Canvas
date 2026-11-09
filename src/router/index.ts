import { createRouter, createWebHistory } from 'vue-router'
import ExampleView from '@/views/ExampleView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'example', component: ExampleView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
