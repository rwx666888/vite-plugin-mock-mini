# vite-plugin-mock-mini

一个面向 Vite 开发环境的轻量级 Mock 插件，专注于以下几件事：

    用尽可能少的配置接管本地接口模拟
    支持 js / ts / cjs / mjs Mock 文件
    支持动态路由、查询参数、请求体解析
    支持 Mock 文件热更新与依赖追踪
    支持返回 JSON、Buffer，以及手动控制非 JSON 响应

这是一个 Monorepo 仓库，核心插件位于 `packages/plugin`。

## 文档入口

- 完整使用文档：[`packages/plugin/README.md`](./packages/plugin/README.md)
- Demo 示例：[`packages/demo1`](./packages/demo1)

## 快速跳转

- 查看插件源码：[`packages/plugin/src`](./packages/plugin/src)
- 查看 Demo Mock 示例：[`packages/demo1/mock`](./packages/demo1/mock)
