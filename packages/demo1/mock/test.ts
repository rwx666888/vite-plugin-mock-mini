// @ts-nocheck
import tmpData from './data/example-data.js'
import type { MockData } from 'vite-plugin-mock-mini'
import t1 from './data/t1.js'
export default [
  {
    url: '/testapi/get',
    method: 'get',
    response: (req) => {
      console.log('--mock-1--\n req', req.query, req.body, req.params, '---\n')
      return {
        code: 0,
        list: req.query
      }
    }
  } as MockData,
  {
    url: '/testapi/user/:id/info',
    method: 'post',
    response: (req) => {
      return {
        body: req.body.id,
        params: req.params,
        query: req.query,
        _id: req.param('id')
      }
    }
  } as MockData,
  {
    url: '/testapi/post',
    method: 'post',
    status: 200,
    timeout: 1000,
    response: (req) => {
      console.log('--mock-1--\n req', req.query, req.body, req.params, '---\n')
      return {
        code: 0,
        list: t1
      }
    }
  } as MockData,
  {
    url: '/testapi/post2',
    method: 'post',
    timeout: 1000,
    response: (req) => {
      console.log('--mock-1--\n req', req.query, req.body, req.params, '---\n')
      return {
        code: 0,
        list: []
      }
    }
  } as MockData,
  {
    url: '/testapi/com-list',
    method: 'get',
    response: (config) => {
      const { type, title, currentPage = 1, pageSize = 20, sort } = config.query

      let mockList = tmpData.comList_.filter((item) => {
        if (type && item.type !== type) return false
        if (title && item.title.indexOf(title) < 0) return false
        return true
      })

      if (sort === '-id') {
        mockList = mockList.reverse()
      }

      const pageList = mockList.filter(
        (item, index) => index < pageSize * currentPage && index >= pageSize * (currentPage - 1)
      )

      return {
        totalCount: mockList.length,
        list: pageList
      }
    }
  }
]
