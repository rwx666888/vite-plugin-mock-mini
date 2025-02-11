<template>
  <el-button plain @click="open1">getTest</el-button>
  <el-button plain @click="open2">postTest</el-button>

  <el-button plain @click="open3">getTestList2</el-button>
  <el-button plain @click="open4">post test2</el-button>
  <el-button plain @click="open5">get test v1</el-button>
  <el-button plain @click="open6">post test v1</el-button>
</template>

<script lang="ts" setup>
import { postTest, getTestList2, getTest, postTest2, getTestV1, postTestV1 } from '@/apis/test'

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

const open5 = () => {
  getTestV1({ a: 1, b: 2 }).then((res) => {
    console.log('submit!-5', res)
  })
}
const open6 = () => {
  postTestV1({ a: 1, b: 2 }).then((res) => {
    console.log('submit!-6', res)
  })
}
</script>
