import { createServer } from 'vite'

/**
 * 读取响应文本并在断言失败时输出上下文，方便快速定位 mock 返回值问题
 * @param {Response} response
 * @returns {Promise<any>}
 */
async function readJson(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`响应不是合法 JSON，status=${response.status} body=${text}`)
  }
}

/**
 * 断言条件成立
 * @param {boolean} condition
 * @param {string} message
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  const server = await createServer({
    configFile: './vite.config.ts',
    server: {
      host: '127.0.0.1',
      port: 5177,
      strictPort: true
    },
    logLevel: 'silent'
  })

  try {
    await server.listen()
    const baseUrl = 'http://127.0.0.1:5177'

    // 验证 query 解析
    const getResponse = await fetch(`${baseUrl}/testapi/get?a=1&b=2`)
    const getData = await readJson(getResponse)
    assert(getResponse.ok, 'GET /testapi/get 响应失败')
    assert(getData.code === 0, 'GET /testapi/get 返回 code 不正确')
    assert(getData.list.a === '1', 'GET /testapi/get 未正确解析 query.a')
    assert(getData.list.b === '2', 'GET /testapi/get 未正确解析 query.b')

    // 验证 body / query / params 联合解析
    const postResponse = await fetch(`${baseUrl}/testapi/user/123/info?sub=demo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: '123',
        sub: 'demo'
      })
    })
    const postData = await readJson(postResponse)
    assert(postResponse.ok, 'POST /testapi/user/:id/info 响应失败')
    assert(postData.body === '123', 'POST /testapi/user/:id/info 未正确解析 body.id')
    assert(postData.params.id === '123', 'POST /testapi/user/:id/info 未正确解析 params.id')
    assert(postData.query.sub === 'demo', 'POST /testapi/user/:id/info 未正确解析 query.sub')
    assert(postData._id === '123', 'POST /testapi/user/:id/info 的 req.param 未正确返回')

    // 验证分页与筛选逻辑
    const pageResponse = await fetch(
      `${baseUrl}/testapi/com-list?type=CN&currentPage=1&pageSize=5&sort=-id`
    )
    const pageData = await readJson(pageResponse)
    assert(pageResponse.ok, 'GET /testapi/com-list 响应失败')
    assert(typeof pageData.totalCount === 'number', '/testapi/com-list 未返回 totalCount')
    assert(Array.isArray(pageData.list), '/testapi/com-list 未返回 list 数组')
    assert(pageData.list.length <= 5, '/testapi/com-list 分页结果超过 pageSize')
    assert(
      pageData.list.every((item) => item.type === 'CN'),
      '/testapi/com-list type 筛选失败'
    )

    console.log('mock verify passed')
  } finally {
    await server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
