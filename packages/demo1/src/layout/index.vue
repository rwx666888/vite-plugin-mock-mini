<template>
  <el-container class="layout-container-demo" style="height: 100vh">
    <el-header style="text-align: right; font-size: 12px">
      <div class="toolbar">
        <span>Tom</span>
      </div>
    </el-header>

    <el-container class="main-warp">
      <el-aside width="200px">
        <el-scrollbar>
          <sidebar />
        </el-scrollbar>
      </el-aside>

      <el-main>
        <el-scrollbar>
          <router-view></router-view>
        </el-scrollbar>
      </el-main>
    </el-container>
  </el-container>
</template>

<script lang="ts" setup>
  import sidebar from './side.vue'
</script>

<style scoped>
  .layout-container-demo .el-header {
    position: relative;
    background-color: var(--el-color-primary-light-7);
    color: var(--el-text-color-primary);
  }
  .layout-container-demo .el-aside {
    color: var(--el-text-color-primary);
    border-right: 1px solid var(--el-border-color);
  }
  .layout-container-demo .el-menu {
    border-right: none;
  }
  .layout-container-demo .el-main {
    padding: 0;
  }
  .layout-container-demo .toolbar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    right: 20px;
  }
  .main-warp {
    flex: 1 1 0%;
    min-height: 0;
  }
</style>
