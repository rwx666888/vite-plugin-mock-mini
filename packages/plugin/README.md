# vite-plugin-mock-mini

一个面向 Vite 开发环境的轻量级 Mock 插件，专注于以下几件事：

- 用尽可能少的配置接管本地接口模拟
- 支持 `js / ts / cjs / mjs` Mock 文件
- 支持动态路由、查询参数、请求体解析
- 支持 Mock 文件热更新与依赖追踪
- 支持返回 JSON、`Buffer`，以及手动控制非 JSON 响应

## 特色

### 1. 动态路由与静态路由分离匹配

插件会优先匹配静态路由，再匹配动态路由，减少请求阶段的无效扫描。

适合场景：

- Mock 接口数量较多
- 同时存在 `/user/list` 与 `/user/:id`
- 希望在开发阶段仍保持较好的匹配性能

### 2. 命中后按需解析请求

插件不会在所有请求上无差别执行解析器，而是在命中 Mock 路由后再执行：

- `json`
- `urlencoded`
- `text`
- `raw`
- `query`

这样可以尽量减少对非 Mock 请求的影响，也更容易和其它中间件共存。

### 3. Mock 依赖热更新

Mock 文件支持相互引用，修改被依赖文件时，插件会重新编译受影响的顶层 Mock 文件。

适合场景：

- 将示例数据拆到 `mock/data/*.ts`
- 多个 Mock 文件复用同一份测试数据
- 开发中频繁保存文件，希望自动刷新 Mock 结果

### 4. 支持二进制返回

当 Mock 响应函数返回 `Buffer` 时，插件会自动以二进制形式写回响应。

适合场景：

- 文件下载
- 图片、音频、二进制片段调试
- 需要快速伪造导出接口

### 5. 支持完全自定义响应

如果需要流式响应、文件下载头、SSE 或自定义文本输出，可以使用 `isNotJson: true`，直接操作原始 `res`。

## 安装

```bash
pnpm add -D vite-plugin-mock-mini
```

如果你使用 `npm`：

```bash
npm i -D vite-plugin-mock-mini
```

说明：

- 当前插件面向 Vite 开发服务器运行，依赖的是 Vite 内部暴露的 Connect 风格中间件能力

## 基础用法

在 `vite.config.ts` 中注册插件：

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { mockApiServer } from 'vite-plugin-mock-mini';

export default defineConfig({
  plugins: [
    vue(),
    mockApiServer({
      mockDir: 'mock',
      routerPath: '/api',
      routerParserEnabled: true,
      showLog: 'info'
    })
  ]
});
```

推荐目录结构：

```text
mock/
  data/
    users.ts
  user.ts
  order.ts
```

## 编写 Mock 文件

### 返回普通 JSON

```ts
import type { MockData } from 'vite-plugin-mock-mini';

export default [
  {
    url: '/api/user/list',
    method: 'get',
    response: () => {
      return {
        code: 0,
        data: [
          { id: 1, name: 'Tom' },
          { id: 2, name: 'Jerry' }
        ]
      };
    }
  }
] satisfies MockData[];
```

### 读取 query 参数

```ts
import type { MockData } from 'vite-plugin-mock-mini';

export default [
  {
    url: '/api/search',
    method: 'get',
    response: (req) => {
      return {
        code: 0,
        keyword: req.query.keyword,
        page: req.query.page || 1
      };
    }
  }
] satisfies MockData[];
```

### 读取 body 参数

```ts
import type { MockData } from 'vite-plugin-mock-mini';

export default [
  {
    url: '/api/login',
    method: 'post',
    response: (req) => {
      const { username } = req.body;
      return {
        code: 0,
        token: `mock-token-for-${username}`
      };
    }
  }
] satisfies MockData[];
```

### 动态路由参数

```ts
import type { MockData } from 'vite-plugin-mock-mini';

export default [
  {
    url: '/api/user/:id',
    method: 'get',
    response: (req) => {
      return {
        code: 0,
        userId: req.params.id,
        fromParam: req.param('id')
      };
    }
  }
] satisfies MockData[];
```

### 模拟延迟与状态码

```ts
import type { MockData } from 'vite-plugin-mock-mini';

export default [
  {
    url: '/api/order/create',
    method: 'post',
    status: 201,
    timeout: 800,
    response: () => {
      return {
        code: 0,
        message: 'created'
      };
    }
  }
] satisfies MockData[];
```

## 返回 Buffer

如果响应函数返回 `Buffer`，插件会自动设置默认的二进制响应类型并输出内容。

```ts
import type { MockData } from 'vite-plugin-mock-mini';

export default [
  {
    url: '/api/export/text',
    method: 'get',
    response: () => {
      return Buffer.from('mock export content', 'utf-8');
    }
  }
] satisfies MockData[];
```

如果你需要更精细的响应头控制，建议使用 `isNotJson: true`。

## 完全自定义响应

### 文件下载

```ts
import type { MockData } from 'vite-plugin-mock-mini';

export default [
  {
    url: '/api/export/file',
    method: 'get',
    isNotJson: true,
    response: (_req, res) => {
      const content = Buffer.from('id,name\n1,Tom\n2,Jerry', 'utf-8');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
      res.end(content);
    }
  }
] satisfies MockData[];
```

### SSE 或流式响应

```ts
import type { MockData } from 'vite-plugin-mock-mini';

export default [
  {
    url: '/api/sse',
    method: 'get',
    isNotJson: true,
    response: (_req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let count = 0;
      const timer = setInterval(() => {
        count += 1;
        res.write(`data: ${JSON.stringify({ count })}\n\n`);
        if (count >= 3) {
          clearInterval(timer);
          res.end();
        }
      }, 1000);
    }
  }
] satisfies MockData[];
```

## 复用数据文件

```ts
// mock/data/users.ts
export default [
  { id: 1, name: 'Tom' },
  { id: 2, name: 'Jerry' }
];
```

```ts
// mock/user.ts
import users from './data/users';
import type { MockData } from 'vite-plugin-mock-mini';

export default [
  {
    url: '/api/user/list',
    method: 'get',
    response: () => {
      return {
        code: 0,
        data: users
      };
    }
  }
] satisfies MockData[];
```

当 `mock/data/users.ts` 变更时，依赖它的顶层 Mock 文件会自动重新加载。

## 模拟分页与筛选

下面这个例子和 `packages/demo1/mock/test.ts` 中的 `/testapi/com-list` 类似，适合列表页、搜索、分页和简单排序场景。

```ts
import listData from './data/example-data.js';
import type { MockData } from 'vite-plugin-mock-mini';

export default [
  {
    url: '/api/com-list',
    method: 'get',
    response: (req) => {
      const { type, title, currentPage = 1, pageSize = 20, sort } = req.query;

      let mockList = listData.comList_.filter((item) => {
        if (type && item.type !== type) return false;
        if (title && item.title.indexOf(title) < 0) return false;
        return true;
      });

      if (sort === '-id') {
        mockList = mockList.slice().reverse();
      }

      const page = Number(currentPage) || 1;
      const size = Number(pageSize) || 20;
      const pageList = mockList.filter(
        (_item, index) => index < size * page && index >= size * (page - 1)
      );

      return {
        totalCount: mockList.length,
        list: pageList
      };
    }
  }
] satisfies MockData[];
```

常见用法：

- `?currentPage=1&pageSize=20`：分页
- `?title=foo`：按标题模糊筛选
- `?type=CN`：按类型筛选
- `?sort=-id`：按示例逻辑倒序返回

更完整的联动写法、页面调用方式与 mock 数据组织方式，见本项目 `packages/demo1` 示例。

## 配置项

```ts
type mockApiServerOptions = {
  mockDir?: string;
  mockFileMatch?: string;
  ignore?: string | string[];
  routerParser?: {
    json?: boolean;
    url?: boolean;
    txt?: boolean;
    raw?: boolean;
    query?: boolean;
  };
  showLog?: 'info' | 'error' | false;
  routerPath?: string | string[];
  routerParserEnabled?: boolean;
  routerParserArr?: [Connect.NextHandleFunction[], Connect.NextHandleFunction[]];
};
```

### `mockDir`

- 类型：`string`
- 默认值：`mock`
- 说明：Mock 文件目录

### `mockFileMatch`

- 类型：`string`
- 默认值：`**/*.{js,ts,cjs,mjs}`
- 说明：Mock 文件匹配规则

### `ignore`

- 类型：`string | string[]`
- 默认值：自动忽略临时编译文件
- 说明：额外忽略的文件规则

### `routerPath`

- 类型：`string | string[]`
- 默认值：空
- 说明：限制插件只处理指定前缀下的请求，推荐和真实后端接口前缀区分开

### `routerParserEnabled`

- 类型：`boolean`
- 默认值：`true`
- 说明：是否启用内置请求解析能力

### `routerParser`

- 类型：对象
- 默认值：全部启用
- 说明：控制内置请求解析器开关

其中：

- `json`：解析 JSON 请求体
- `url`：解析 `application/x-www-form-urlencoded`
- `txt`：解析文本请求体
- `raw`：解析原始二进制请求体
- `query`：解析查询参数

说明：

- 动态路由参数会在命中路由时自动挂载到 `req.params`
- 同时也可以通过 `req.param('id')` 这类方式读取

### `routerParserArr`

- 类型：`[before, after]`
- 默认值：`[[], []]`
- 说明：插入额外的 Connect 中间件，`before` 在内置解析前执行，`after` 在内置解析后执行

示例：

```ts
import cookieParser from 'cookie-parser';
import { mockApiServer } from 'vite-plugin-mock-mini';

mockApiServer({
  routerPath: '/api',
  routerParserArr: [[cookieParser()], []]
});
```

## 推荐场景

### 场景 1：前后端分离项目本地联调

```ts
mockApiServer({
  mockDir: 'mock',
  routerPath: '/api'
});
```

适合在接口未完成时先跑通页面。

### 场景 2：中后台列表页筛选、分页、详情

```ts
mockApiServer({
  mockDir: 'mock',
  routerPath: ['/api', '/mock-api'],
  routerParserEnabled: true
});
```

适合大量依赖 `query / body / params` 的页面开发。

### 场景 3：导出、下载、音视频片段调试

```ts
mockApiServer({
  mockDir: 'mock',
  routerPath: '/api'
});
```

配合 `Buffer` 返回或 `isNotJson: true` 使用即可。

## 更新通知

当 Mock 文件发生变更时，插件会通过 Vite WebSocket 发送一个自定义事件：

```ts
event: 'mock:update';
```

你可以在前端自行监听：

```ts
if (import.meta.hot) {
  import.meta.hot.on('mock:update', () => {
    console.log('mock updated');
  });
}
```

## 注意事项

- 这是开发阶段使用的 Mock 插件，不建议直接用于生产环境
- 如果你的项目已经有其它请求体解析中间件，建议限制 `routerPath`
- 复杂下载、流式响应、SSE 等场景，优先使用 `isNotJson: true`
- 建议把可复用的模拟数据拆分到独立文件中，方便热更新复用
