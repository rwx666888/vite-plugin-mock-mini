<template>
  <el-button plain @click="open1">Click1</el-button>
  <el-button plain @click="open2">Click2</el-button>

  <el-button plain @click="open3">Click3</el-button>
  <el-button plain @click="open4">post test2</el-button>
</template>

<script lang="ts" setup>
import { postTest, getTestList2, getTest, postTest2 } from '@/apis/test'

const open1 = () => {
  getTest({ a: 1, b: 2 }).then((res) => {
    console.log('submit!-3', res)
  })

}
const open2 = () => {

  postTest({ a: 1, b: 2 }).then((res) => {
    console.log('submit!-1', res)
  })
}
const open3 = () => {
  getTestList2({ a: 11, b: 22 }).then((res) => {
    console.log('submit!-2', res)
  })
}
const open4 = () => {
  postTest2({ id: 1, name: 'test', sub: 'sub' }).then((res) => {
    console.log('submit!-4', res)
  })
}
</script>
