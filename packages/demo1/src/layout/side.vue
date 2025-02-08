<template>
  <el-menu router class="side-menu">
    <side-item v-for="(v, k) in constantRoutes" :menu="v" :key="k"></side-item>
  </el-menu>
</template>

<script setup lang="ts">
import { constantRoutes } from '@/router'
import SideItem from './side-item.vue'
</script>

<style scoped>
/* Add your custom styles here */
</style>
