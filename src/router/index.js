import Vue from 'vue'
import Router from 'vue-router'
import Example from '@/page/Example'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'Hello',
      component: Example
    }
  ]
})
