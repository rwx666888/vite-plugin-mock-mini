import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import layout from '../layout/index.vue'

export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: layout,
    redirect: '/index',
    meta: {
      title: '首页'
    },
    children: [
      {
        path: '/index',
        name: 'index',
        meta: {
          title: 'index'
        },
        component: () => import('../views/HomeView.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes: constantRoutes
})

export default router
