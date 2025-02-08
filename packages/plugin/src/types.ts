/**
 * Mock插件配置接口
 */
export interface MockOptions {
  /**
   * mock文件目录
   */
  dir?: string;
  /**
   * URL前缀
   */
  urlPath?: string;
  /**
   * 文件过滤规则
   */
  include?: string | RegExp | (string | RegExp)[];
  /**
   * 文件排除规则
   */
  exclude?: string | RegExp | (string | RegExp)[];
}
