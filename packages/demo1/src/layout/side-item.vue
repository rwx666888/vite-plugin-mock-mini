<template>
  <template v-if="props.menu">
    <el-sub-menu :index="props.menu.path" v-if="props.menu.children && props.menu.children.length > 0">
      <template #title>{{ props.menu.meta.title }}</template>
      <side-item v-for="(child, index) in props.menu.children" :menu="child" :key="index"></side-item>
    </el-sub-menu>
    <el-menu-item v-else :index="props.menu.path">{{ props.menu.meta.title }}</el-menu-item>
  </template>
</template>

<script setup lang="ts">

const props = defineProps({
  menu: Object
})
</script>

<style scoped>
/* Add your custom styles here */
</style>
