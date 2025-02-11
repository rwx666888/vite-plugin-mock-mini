import type { MockData } from 'vite-plugin-mock-mini'
import t1 from './data/t1.js'
export default [
  {
    url: '/testapi/v1/get',
    method: 'get',
    response: (req) => {
      console.log('--mock-1--\n req', req.query, req.body, req.params, '---\n')
      return {
        code: 'v1-get',
        list: req.query
      }
    }
  } as MockData,
  {
    url: '/testapi/v1/user/:id/info',
    method: 'post',
    response: (req) => {
      return {
        code: 'v1-user-info',
        body: req.body.id,
        params: req.params,
        query: req.query,
        _id: req.param('id')
      }
    }
  } as MockData,
  {
    url: '/testapi/v1/post',
    method: 'post',
    status: 200,
    timeout: 1000,
    response: (req) => {
      console.log('--mock-1--\n req', req.query, req.body, req.params, '---\n')
      return {
        code: 'v1-post',
        list: t1
      }
    }
  } as MockData
]
