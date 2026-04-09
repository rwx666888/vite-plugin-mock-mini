<template>
  <el-button plain @click="open1">getTest</el-button>
  <el-button plain @click="open2">postTest</el-button>

  <el-button plain @click="open3">getTestList2</el-button>
  <el-button plain @click="open4">post test2</el-button>
  <el-button plain @click="open5">get test v1</el-button>
  <el-button plain @click="open6">post test v1</el-button>

  <pre>{{ previewContent }}</pre>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { postTest, getTestList2, getTest, postTest2, getTestV1, postTestV1 } from '@/apis/test'

const previewContent = ref('')

const printPreview = (res: unknown) => {
  previewContent.value = `执行时间：${new Date().toLocaleString()}\n执行结果：${JSON.stringify(res, null, 2)}`
}

const open1 = () => {
  getTest({ a: 1, b: 2 }).then((res) => {
    console.log('submit!-3', res)
    printPreview(res)
  })

}
const open2 = () => {

  postTest({ a: 1, b: 2 }).then((res) => {
    console.log('submit!-1', res)
    printPreview(res)
  })
}
const open3 = () => {
  getTestList2({ a: 11, b: 22 }).then((res) => {
    console.log('submit!-2', res)
    printPreview(res)
  })
}
const open4 = () => {
  postTest2({ id: 1, name: 'test', sub: 'sub' }).then((res) => {
    console.log('submit!-4', res)
    printPreview(res)
  })
}

const open5 = () => {
  getTestV1({ a: 1, b: 2 }).then((res) => {
    console.log('submit!-5', res)
    printPreview(res)
  })
}
const open6 = () => {
  postTestV1({ a: 1, b: 2 }).then((res) => {
    console.log('submit!-6', res)
    printPreview(res)
  })
}
</script>
