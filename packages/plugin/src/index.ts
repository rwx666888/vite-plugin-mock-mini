import { Plugin, Connect } from 'vite';
import path from 'path';
import chokidar from 'chokidar';
import fastGlob from 'fast-glob';
import crypto from 'crypto';
import { bundleRequire, GetOutputFile } from 'bundle-require';
import bodyParser from 'body-parser';
import { match } from 'path-to-regexp';
import { ServerResponse } from 'http';
import qs from 'qs';

declare const process: {
  cwd(): string;
};

/**
 * Mock数据类型定义
 * @description 定义了单个Mock接口的数据结构
 */
export type MockData = {
  /** 请求URL路径 */
  url: string;
  /** HTTP请求方法 */
  method?: 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';
  /** 响应状态码 */
  status?: number;
  /** 响应超时时间(ms) */
  timeout?: number;
  /** 是否不返回json数据，默认 false */
  isNotJson?: boolean;
  /** @internal path-to-regexp 的 match 函数 */
  __matchFn?: ReturnType<typeof match>;
} & (
  | {
      isNotJson: true;
      /** 响应函数 - 非JSON响应时使用 */
      response: (req: TypeExtendReq, res: ServerResponse) => void;
    }
  | {
      isNotJson?: false;
      /** 响应数据或返回响应数据的函数 - JSON响应时使用 */
      response: unknown | ((req: TypeExtendReq) => unknown | Promise<unknown>);
    }
);

export type mockApiServerOptions = {
  /** mock 数据文件存放的目录 默认 mock */
  mockDir?: string;
  /** 需要导入的 mockAPI文件 默认 '**\/*.{js,ts,cjs,mjs}' */
  mockFileMatch?: string;
  /** 忽略的文件 默认 ['**\/__tmp-\*-\*__.\*'] */
  ignore?: string | string[];
  /** 路由解析器 */
  routerParser?: {
    /** 启用json解析器 默认 true */
    json?: boolean;
    /** 启用url解析器 默认 true */
    url?: boolean;
    /** 启用txt解析器 默认 true */
    txt?: boolean;
    /** 启用raw解析器 默认 true */
    raw?: boolean;
    /** 启用query解析器 默认 true */
    query?: boolean;
  };
  /**
   * 是否显示日志 默认 false
   */
  showLog?: 'info' | 'error' | false;
  /**
   * 限制插件只处理指定前缀下的请求 默认 ''
   * @description 建议mock的接口路径与实际接口路径分离，目的是尽可能规避解析器对非mock接口的影响
   * 支持字符串或字符串数组，例如:
   * - 字符串: '/mock-api'
   * - 数组: ['/mock-api', '/test-api']
   */
  routerPath?: string | string[];
  /**
   * 是否启用内置请求解析器，默认 true
   * @description
   * - true: 按 routerParser 配置启用 json/url/txt/raw/query 解析
   * - false: 不启用上述内置解析器
   * - routerParserArr 请求/响应扩展中间件始终有效
   * - 解析器链只会在命中 mock 路由后执行
   */
  routerParserEnabled?: boolean;
  /**
   * @description 其它支持 connect 的解析器, 格式 [before, after]
   *
   * -- before 在 routerParser 之前执行, 例如 cookie 解析器;
   *
   * -- after 在 routerParser 之后执行
   *
   * @url https://github.com/senchalabs/connect
   *
   * @example cookie-session
   * @url https://www.npmjs.com/package/cookie-session
   *
   * @example cookie-parser
   * @url https://www.npmjs.com/package/cookie-parser
   */
  routerParserArr?: [Connect.NextHandleFunction[], Connect.NextHandleFunction[]];
};

type _opt = mockApiServerOptions & {
  mockFileMatch: string;
  routerParserEnabled: boolean;
};

// 修改 TypeExtendReq 类型定义，继承 IncomingMessage
type TypeExtendReq = Connect.IncomingMessage & {
  params: Record<string, any>;
  query: Record<string, any>;
  body: any;
  param: (paramName: string) => any;
};

/**
 * 扩展 ServerResponse 类型
 */
type TypeExtendRes = ServerResponse & {
  /**
   * 设置响应状态码
   * @param {number} code - HTTP状态码
   * @returns {TypeExtendRes} - 返回响应对象以支持链式调用
   */
  status(code: number): TypeExtendRes;
  /**
   * 发送JSON响应
   * @param {any} body - 要发送的JSON数据
   */
  json(body: any): void;
};

type MatchResult = Exclude<ReturnType<ReturnType<typeof match>>, false>;

type RouteBucket = {
  staticRoutes: Map<string, MockData>;
  dynamicRoutes: MockData[];
};

type RouteIndex = Map<string, RouteBucket>;

type MockRouteMatch = {
  target: MockData;
  params: Record<string, any>;
};

/**
 * 扩展请求对象的中间件
 * @param {TypeExtendReq} req - 请求对象
 * @param {ServerResponse} res - 响应对象
 * @param {Connect.NextFunction} next - 下一个中间件函数
 */
function _extendRequestMiddleware(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction
) {
  const _req = req as TypeExtendReq;
  if (!_req.params) _req.params = {}; // 如果没有 params，初始化为 {}
  if (!_req.query) _req.query = {}; // 如果没有 query，初始化为 {}
  if (!_req.body) _req.body = {}; // 如果没有 body，初始化为 {}
  // 检查 param 方法是否已存在
  if (!_req.param) {
    // 使用箭头函数避免 this 绑定问题
    _req.param = (paramName: string) => {
      return _req.body?.[paramName] || _req.query?.[paramName] || _req.params?.[paramName];
    };
  }
  next();
}

/**
 * 扩展响应对象的中间件
 * @param {TypeExtendReq} req - 请求对象
 * @param {ServerResponse} res - 响应对象
 * @param {Connect.NextFunction} next - 下一个中间件
 */
function _extendResponseMiddleware(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction
) {
  const _response = res as TypeExtendRes;

  if (!_response.status) {
    _response.status = (code: number): TypeExtendRes => {
      _response.statusCode = code;
      return _response;
    };
  }

  if (!_response.json) {
    _response.json = (body: any): void => {
      _response.setHeader('Content-Type', 'application/json; charset=utf-8');
      _response.end(JSON.stringify(body));
    };
  }

  next();
}

/**
 * 规范化请求路径
 * @description
 * - 仅保留路径部分，不包含 query
 * - 尝试对 URL 中的编码字符进行解码，提升中文路径等场景的匹配兼容性
 * - 如果解码失败，则退回原始路径，避免请求阶段因为异常而中断
 * @param {string | undefined} url - 原始请求地址
 * @returns {string} 规范化后的请求路径
 */
function normalizeRequestPath(url?: string) {
  const pathname = (url || '').split('?')[0] || '/';
  try {
    return decodeURI(pathname);
  } catch (_) {
    return pathname;
  }
}

/**
 * 判断路由是否为动态路由
 * @description path-to-regexp 风格的动态路径通常包含 : * ? () + 等标记
 * @param {string} url - mock 路由配置中的 url
 * @returns {boolean} 是否为动态路由
 */
function isDynamicRoute(url: string) {
  return /[:*?()+]/.test(url);
}

/**
 * 构建路由索引
 * @description
 * 将原始 mockData 按 HTTP Method 分桶，再拆分为：
 * - staticRoutes: 静态路由，使用 Map 直接命中
 * - dynamicRoutes: 动态路由，保留顺序后续逐个匹配
 *
 * 这样做的目的是把大多数静态请求从 O(n) 扫描降为接近 O(1) 查找，
 * 动态路由则只在对应 method 的子集合中继续匹配。
 * @param {MockData[]} mockData - 当前全部有效的 mock 配置
 * @returns {RouteIndex} 路由索引表
 */
function buildRouteIndex(mockData: MockData[]): RouteIndex {
  const routeIndex: RouteIndex = new Map();

  for (const item of mockData) {
    const method = (item.method || 'GET').toUpperCase();
    const bucket = routeIndex.get(method) || {
      staticRoutes: new Map<string, MockData>(),
      dynamicRoutes: []
    };

    if (isDynamicRoute(item.url)) {
      bucket.dynamicRoutes.push(item);
    } else {
      bucket.staticRoutes.set(item.url, item);
    }

    routeIndex.set(method, bucket);
  }

  return routeIndex;
}

/**
 * 从路由索引中查找命中的 mock 路由
 * @description
 * 匹配顺序为：
 * 1. 先按 method 找到对应桶
 * 2. 优先匹配静态路由
 * 3. 再遍历动态路由并复用已缓存的 __matchFn
 *
 * 如果命中动态路由，同时返回 params，避免后续再进行第二次扫描。
 * @param {RouteIndex} routeIndex - 路由索引表
 * @param {string | undefined} method - 当前请求方法
 * @param {string} urlPath - 规范化后的请求路径
 * @returns {MockRouteMatch | null} 命中的结果，未命中时返回 null
 */
function findMockRoute(routeIndex: RouteIndex, method: string | undefined, urlPath: string) {
  const bucket = routeIndex.get((method || 'GET').toUpperCase());
  if (!bucket) return null;

  const staticRoute = bucket.staticRoutes.get(urlPath);
  if (staticRoute) {
    return {
      target: staticRoute,
      params: {}
    } as MockRouteMatch;
  }

  for (const item of bucket.dynamicRoutes) {
    const matched = item.__matchFn?.(urlPath);
    if (matched) {
      return {
        target: item,
        params: (matched as MatchResult).params || {}
      };
    }
  }

  return null;
}

/**
 * 判断请求体是否已经被上游解析过
 * @description
 * 某些项目可能已经通过其它中间件提前注入了 req.body，
 * 此时再次执行 body-parser 既没有必要，也可能带来兼容性问题。
 * @param {Connect.IncomingMessage} req - 请求对象
 * @returns {boolean} 是否已经存在 body
 */
function hasParsedBody(req: Connect.IncomingMessage) {
  return typeof (req as TypeExtendReq).body !== 'undefined';
}

/**
 * 创建“按需执行”的 body 解析器包装器
 * @description
 * 只有在请求体尚未被解析时，才真正调用 body-parser；
 * 否则直接跳过，尽量减少和其它中间件的冲突。
 * @param {Connect.NextHandleFunction} parser - 原始解析器
 * @returns {Connect.NextHandleFunction} 包装后的解析器
 */
function createConditionalBodyParser(
  parser: Connect.NextHandleFunction
): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (hasParsedBody(req)) {
      next();
      return;
    }
    parser(req, res, next);
  };
}

/**
 * 顺序执行一组 Connect 中间件
 * @description
 * 由于插件现在改为“命中 mock 后再按需解析”，这里需要手动串联中间件执行顺序。
 * 执行过程中具备以下特性：
 * - 前一个中间件完成后，再进入下一个
 * - 如果响应已经结束，则后续中间件不再执行
 * - 任意中间件抛错或 next(error) 时，会中断并上抛异常
 * @param {Connect.IncomingMessage} req - 请求对象
 * @param {ServerResponse} res - 响应对象
 * @param {Connect.NextHandleFunction[]} middlewares - 中间件数组
 * @returns {Promise<void>} 执行完成后的 Promise
 */
function runMiddlewares(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  middlewares: Connect.NextHandleFunction[]
) {
  return middlewares.reduce<Promise<void>>((promise, middleware) => {
    return promise.then(
      () =>
        new Promise<void>((resolve, reject) => {
          if (res.writableEnded) {
            resolve();
            return;
          }
          try {
            middleware(req, res, (error?: unknown) => {
              if (error) {
                reject(error);
                return;
              }
              resolve();
            });
          } catch (error) {
            reject(error);
          }
        })
    );
  }, Promise.resolve());
}

/**
 * 发送文本错误响应
 * @param {ServerResponse} res - 响应对象
 * @param {number} statusCode - 状态码
 * @param {string} message - 错误文本
 */
function sendTextError(res: ServerResponse, statusCode: number, message: string) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(message);
}

/**
 * 发送 mock 结果
 * @description
 * - 当结果为 Buffer 时，按二进制响应输出
 * - 其它情况按 JSON 响应输出
 * - 如果上游已设置 Content-Type，则优先保留用户自定义响应头
 * @param {ServerResponse} res - 响应对象
 * @param {number} statusCode - HTTP 状态码
 * @param {unknown} result - mock 返回值
 */
function sendMockResult(res: ServerResponse, statusCode: number, result: unknown) {
  res.statusCode = statusCode;

  if (Buffer.isBuffer(result)) {
    if (!res.hasHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    }
    res.end(result);
    return;
  }

  if (!res.hasHeader('Content-Type')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  res.end(JSON.stringify(result));
}

/**
 * 处理mock请求的核心函数
 * @param req - 请求对象
 * @param res - 响应对象
 * @param next - 下一个中间件
 * @param matchedRoute - 命中的 mock 路由
 */
async function handerFn(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
  matchedRoute: MockRouteMatch | null
) {
  const _req = req as TypeExtendReq;

  if (!_req.url || !matchedRoute) {
    next();
    return;
  }

  // 动态路由参数始终在命中路由后注入到 req.params，
  // 这样可以避免旧实现中在独立中间件阶段对所有 mock 做二次扫描
  _req.params = matchedRoute.params;

  const _target = matchedRoute.target;

  // 处理延时
  if (_target.timeout) {
    await _sleep(_target.timeout);
  }

  // 匹配到路由
  if (_target.isNotJson) {
    if (typeof _target.response === 'function') {
      _target.response(_req, res as TypeExtendRes);
    } else {
      sendTextError(res, 500, '---error--- response must be a function when isNotJson is true');
    }
  } else {
    if (typeof _target.response === 'function') {
      try {
        const _result = await Promise.resolve(_target.response(_req));
        sendMockResult(res, _target.status || 200, _result);
      } catch (_) {
        sendTextError(
          res,
          500,
          '---error--- The response function returns data that is not valid JSON.'
        );
      }
    } else if (typeof _target.response !== 'function') {
      try {
        sendMockResult(res, _target.status || 200, _target.response);
      } catch (_) {
        sendTextError(res, 500, '---error--- response is not valid JSON.');
      }
    } else {
      sendTextError(res, 500, '---error--- response is not function or object');
    }
  }
}

// 解析查询参数并附加到 req.query
function queryParser() {
  return (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const _req = req as TypeExtendReq;
    const currentUrl = _req.originalUrl || _req.url;
    if (currentUrl) {
      try {
        // 构造 URL 对象时需要补一个基础 host；
        // 如果上游没有提供 host，则退回 localhost，避免 new URL 直接抛错
        const host = _req.headers.host || 'localhost';
        const parsedUrl = new URL(currentUrl, `http://${host}`);
        _req.query = qs.parse(parsedUrl.search.slice(1));
      } catch (_) {
        // URL 解析失败时，兜底为空对象，避免因为异常影响整个请求处理链
        _req.query = {};
      }
    }
    next();
  };
}

function _sleep(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * 文件依赖关系类型定义
 */
type FileDependencyInfo = {
  /** 依赖的文件路径数组 */
  dependencies: string[];
  /** 被哪些顶层文件依赖 */
  topLevelDependents: string[];
  /** 文件的mock数据 */
  mockData?: MockData[];
};

/**
 * 文件依赖关系映射
 */
type FileDependencyMap = Map<string, FileDependencyInfo>;

/**
 * 创建日志记录器
 * @param {string} level  - 日志级别，默认为 false
 * @returns {Object} 包含 info 和 error 方法的对象
 */
function createLogger(level: false | 'info' | 'error' = false) {
  return {
    info: (...args: any[]) => {
      if (level === 'info') {
        console.log('[vite-plugin-mock-mini]', ...args);
      }
    },
    error: (...args: any[]) => {
      if (level === 'error' || level === 'info') {
        console.error('[vite-plugin-mock-mini]', ...args);
      }
    }
  };
}

export function mockApiServer(options?: mockApiServerOptions): Plugin {
  // 存储 mock 数据
  let mockData: MockData[] = [];
  let routeIndex: RouteIndex = new Map();

  const __logger = createLogger(options?.showLog || false);

  // 存储文件依赖关系
  const fileDependencyMap: FileDependencyMap = new Map();

  const { routerParser: _routerParser = {}, ...otherOpt } = options || {};
  const _opt: _opt = {
    mockDir: 'mock',
    mockFileMatch: '',
    routerParserEnabled: true,
    routerParser: {
      json: true,
      url: true,
      txt: true,
      raw: true,
      query: true,
      ..._routerParser
    },
    ...otherOpt
  };
  // 处理 routerPath
  const _routerPaths = Array.isArray(_opt.routerPath) ? _opt.routerPath : [_opt.routerPath || ''];
  // 处理 ignore
  let _ignore = Array.isArray(_opt.ignore)
    ? _opt.ignore
    : typeof _opt.ignore === 'string'
      ? [_opt.ignore]
      : [];

  // 将 ignore 中的字符串和正则表达式转换为字符串
  _ignore = _ignore.map((pattern: string | RegExp) =>
    pattern instanceof RegExp ? pattern.source : pattern
  );
  _opt.mockFileMatch = _opt.mockFileMatch || '**/*.{js,ts,cjs,mjs}';
  _ignore.push('**/__tmp-*-*__.*');
  // 获取 mock 目录
  const mockDirPath = path.resolve(process.cwd(), _opt.mockDir || 'mock');

  /**
   * 内置请求解析器映射表
   * @description
   * 这里只描述“能力”，不代表一定会对每个请求执行；
   * 真正的执行时机是在命中 mock 路由之后，由 applyMockMiddlewares 统一串行调用。
   */
  const _routerParserMap = {
    json: createConditionalBodyParser(bodyParser.json()),
    url: createConditionalBodyParser(bodyParser.urlencoded({ extended: true })),
    txt: createConditionalBodyParser(bodyParser.text()),
    raw: createConditionalBodyParser(bodyParser.raw()),
    query: queryParser()
  };

  // 添加类型定义
  type RouterParserKey = keyof typeof _routerParserMap;

  // 根据用户配置筛选出真正启用的内置解析器
  const _routerParserArr = _opt.routerParserEnabled
    ? Object.entries(_opt.routerParser || {}).reduce((acc, [key, value]) => {
        if (value === true && _routerParserMap[key as RouterParserKey]) {
          acc.push(_routerParserMap[key as RouterParserKey]);
        }
        return acc;
      }, [] as Connect.NextHandleFunction[])
    : ([] as Connect.NextHandleFunction[]);

  // 无论是否启用 body/query 解析，这两个扩展中间件都应始终存在：
  // - _extendRequestMiddleware: 兜底初始化 req.params / req.query / req.body / req.param
  // - _extendResponseMiddleware: 为 res 增加 status/json 等便捷方法
  _routerParserArr.push(_extendRequestMiddleware, _extendResponseMiddleware);

  /**
   * 更新文件依赖信息
   * @param {string} filePath - 文件路径（绝对路径）
   * @param {string[]} dependencies - 依赖文件路径数组
   * @param {any} mod - 模块内容
   */
  const updateFileDependencyInfo = (
    filePath: string,
    dependencies: string[] = [],
    mod: any = null
  ) => {
    if (!filePath) return;

    const projectRoot = process.cwd();
    const normalizedProjectRoot = path.resolve(projectRoot).replace(/\\/g, '/');

    // 依赖路径转换为绝对路径，并过滤以下内容：
    // 1. 自身路径，避免出现自依赖
    // 2. 项目根目录之外的路径，避免把无关文件纳入依赖图
    // 3. node_modules，避免第三方包进入热更新依赖追踪导致依赖图膨胀
    const realDependencies = dependencies
      .map((dep) => path.resolve(projectRoot, dep).replace(/\\/g, '/'))
      .filter(
        (absoluteDepPath) =>
          absoluteDepPath !== filePath &&
          absoluteDepPath.startsWith(normalizedProjectRoot) &&
          !absoluteDepPath.includes('/node_modules/')
      );

    // 获取现有文件信息
    const existingInfo = fileDependencyMap.get(filePath);

    // 处理 mockData，添加 __matchFn
    let processedMockData: MockData[] | undefined = undefined;
    if (Array.isArray(mod?.default || mod)) {
      processedMockData = (mod?.default || mod).map((item: MockData) => ({
        ...item,
        __matchFn: match(item.url)
      }));
    }

    // 更新文件信息
    fileDependencyMap.set(filePath, {
      dependencies: realDependencies,
      topLevelDependents: [],
      mockData: processedMockData
    });

    // 清理旧的依赖关系
    if (existingInfo) {
      const removedDeps = existingInfo.dependencies.filter(
        (dep) => !realDependencies.includes(dep)
      );
      for (const removedDep of removedDeps) {
        const depInfo = fileDependencyMap.get(removedDep);
        if (depInfo) {
          depInfo.topLevelDependents = depInfo.topLevelDependents.filter((dep) => dep !== filePath);
          fileDependencyMap.set(removedDep, depInfo);
        }
      }
    }

    // 更新所有依赖文件的信息
    for (const absoluteDepPath of realDependencies) {
      try {
        const depInfo = fileDependencyMap.get(absoluteDepPath) || {
          dependencies: [],
          topLevelDependents: [],
          mockData: undefined
        };

        // 被依赖的文件一定不是顶层文件
        // 避免重复添加到 topLevelDependents
        if (!depInfo.topLevelDependents.includes(filePath)) {
          depInfo.topLevelDependents.push(filePath);
        }

        fileDependencyMap.set(absoluteDepPath, depInfo);
      } catch (error) {
        __logger.error(`更新依赖文件信息失败: ${absoluteDepPath}`, error);
      }
    }
  };

  /**
   * 处理文件删除
   * @param {string} deletedFilePath - 被删除的文件路径
   */
  const handleFileDelete = async (deletedFilePath: string) => {
    const fileInfo = fileDependencyMap.get(deletedFilePath);
    if (!fileInfo) return;

    // 从所有依赖文件的 topLevelDependents 中移除对该文件的引用
    for (const depPath of fileInfo.dependencies) {
      const depInfo = fileDependencyMap.get(depPath);
      if (depInfo) {
        depInfo.topLevelDependents = depInfo.topLevelDependents.filter(
          (dep) => dep !== deletedFilePath
        );
        fileDependencyMap.set(depPath, depInfo);
      }
    }

    const topLevelFiles = fileInfo.topLevelDependents;
    // 重新加载受影响的顶层文件
    for (const topLevelFile of topLevelFiles) {
      await loadMockFile(topLevelFile);
    }
    fileDependencyMap.delete(deletedFilePath);
  };

  // 加载mock文件
  const loadMockFile = async (filePath: string) => {
    // 如果该文件已经被其他文件依赖，说明它不是顶层文件，直接跳过加载
    const fileInfo = fileDependencyMap.get(filePath);
    if (fileInfo && fileInfo.topLevelDependents.length > 0) {
      __logger.info(`Skip loading non-top-level file: ${filePath}`);
      return;
    }
    try {
      const { mod, dependencies } = await bundleRequire({
        filepath: filePath,
        format: 'cjs', //当导入的文件中包含 module.exports 时，cjs 兼容最好，只会警告，然而 esm 在目标项目的 type 为 module 时会报错
        preserveTemporaryFile: false, // 是否保留临时文件
        esbuildOptions: {
          sourcemap: false, // 禁用 sourcemap
          sourcesContent: false, // 禁用源代码内容
          sourceRoot: '' // 清空源代码根路径
        },
        getOutputFile: <GetOutputFile>((fpath, format) => {
          const dir = path.dirname(fpath);
          const fileName = path.basename(fpath, path.extname(fpath));
          const randomString = crypto.randomBytes(8).toString('hex');
          return path.resolve(
            dir,
            `__tmp-${fileName}-${randomString}__.${format === 'esm' ? 'mjs' : 'cjs'}`
          );
        })
      });
      __logger.info('---loadMockFile--\n', filePath, '\n dependencies: ', dependencies, '\n----');

      updateFileDependencyInfo(filePath, dependencies, mod);
    } catch (error) {
      __logger.error(`Error loading mock file: ${filePath}`, error);
      // 获取现有的依赖信息
      const existingInfo = fileDependencyMap.get(filePath);
      if (existingInfo) {
        // 保留原有的依赖关系，只清除 mockData
        fileDependencyMap.set(filePath, {
          ...existingInfo,
          mockData: undefined // 只清除 mockData，保留依赖关系
        });
      }
    }
  };

  /**
   * 更新mock数据
   * @param {string} changedFilePath - 变更的文件路径
   * @param {'add' | 'change' | 'unlink'} event - 文件变更类型
   */
  const updateMockData = async (changedFilePath?: string, event?: 'add' | 'change' | 'unlink') => {
    try {
      if (changedFilePath && event) {
        if (event === 'unlink') {
          await handleFileDelete(changedFilePath);
        } else if (event === 'add') {
          // 检查是否有其他文件依赖这个新文件
          // 这可能是由于文件重命名或恢复导致的
          const dependentFiles = Array.from(fileDependencyMap.entries())
            .filter(([_, info]) => info.dependencies.includes(changedFilePath))
            .map(([filePath]) => filePath);

          if (dependentFiles.length > 0) {
            // 重新编译所有依赖这个文件的顶层文件
            for (const depFile of dependentFiles) {
              await loadMockFile(depFile);
            }
          } else {
            // 作为独立的顶层文件加载
            await loadMockFile(changedFilePath);
          }
        } else {
          // 修改文件
          const fileInfo = fileDependencyMap.get(changedFilePath);
          const filesToReload = fileInfo?.topLevelDependents.length
            ? fileInfo.topLevelDependents // 如果有顶层依赖文件,返回依赖数组
            : [changedFilePath]; // 如果没有顶层依赖,返回当前文件数组

          for (const file of filesToReload) {
            await loadMockFile(file);
          }
        }
      } else {
        // 完整加载目录
        const files = await fastGlob.glob(_opt.mockFileMatch, {
          cwd: mockDirPath,
          ignore: _ignore,
          absolute: true,
          onlyFiles: true
        });

        __logger.info('---all-mock-files--\n', files, '\n----');

        // 加载所有文件
        for (const file of files) {
          await loadMockFile(file);
        }
      }

      // 收集所有有效的mockData
      mockData = Array.from(fileDependencyMap.values())
        .filter((info) => info.topLevelDependents.length === 0 && Array.isArray(info.mockData))
        .flatMap((info) => info.mockData as MockData[]);
      routeIndex = buildRouteIndex(mockData);
    } catch (error) {
      __logger.error('更新mock数据失败:', error);
    }
  };

  /**
   * 判断当前请求是否应该交给插件处理
   * @description
   * - 未配置 routerPath：默认认为所有请求都可参与 mock 匹配
   * - 配置了 routerPath：仅处理指定前缀本身或其子路径
   * @param {string} urlPath - 规范化后的请求路径
   * @returns {boolean} 是否进入 mock 处理链
   */
  const shouldHandleRequest = (urlPath: string) => {
    const validBasePaths = _routerPaths
      .map((basePath) => basePath.replace(/\/$/, ''))
      .filter((basePath) => !!basePath);
    if (validBasePaths.length === 0) return true;
    return validBasePaths.some(
      (basePath) => urlPath === basePath || urlPath.startsWith(`${basePath}/`)
    );
  };

  /**
   * 在命中 mock 路由后执行解析器链
   * @description
   * 执行顺序为：
   * 1. 用户自定义 before 中间件
   * 2. 插件内置解析器与请求/响应扩展中间件
   * 3. 用户自定义 after 中间件
   *
   * 之所以在这里统一执行，而不是像旧实现一样提前 use 到全局中间件链，
   * 是为了把解析动作限制在 mock 请求内部，降低对普通 Vite 请求的影响。
   */
  const applyMockMiddlewares = async (req: Connect.IncomingMessage, res: ServerResponse) => {
    const middlewareChain = [
      ...((_opt.routerParserArr || [[], []])[0] || []),
      ..._routerParserArr,
      ...((_opt.routerParserArr || [[], []])[1] || [])
    ];

    await runMiddlewares(req, res, middlewareChain);
  };

  return {
    name: 'vite-plugin-mock-mini',
    async configureServer(server) {
      await updateMockData();

      // 遍历 打印 fileDependencyMap
      /* fileDependencyMap.forEach((value, key) => {
        console.log('--init--fileDependencyMap--\n', key, ' \n', value, '\n----');
      }); */

      // 使用 chokidar 监控文件变化，排除临时文件
      const watchPattern = path.join(mockDirPath, _opt.mockFileMatch);
      const watcher = chokidar.watch(watchPattern, {
        ignored: _ignore,
        ignoreInitial: true
      });

      // 批量更新相关状态
      // updateTimer: 轻量去抖定时器，合并短时间内的多次文件变化
      // updateQueue: 保证批量刷新任务串行执行，避免并发重复编译
      // pendingUpdates: 缓存本轮待处理的文件事件
      let updateTimer: ReturnType<typeof setTimeout> | undefined;
      let updateQueue = Promise.resolve();
      const pendingUpdates = new Map<string, 'add' | 'change' | 'unlink'>();

      /**
       * 刷新积压的文件变更
       * @description
       * 将同一批次收集到的文件事件串行提交给 updateMockData，
       * 完成后通过 Vite WebSocket 向客户端发送自定义更新事件。
       */
      const flushPendingUpdates = () => {
        const updates = Array.from(pendingUpdates.entries());
        pendingUpdates.clear();

        updateQueue = updateQueue
          .then(async () => {
            for (const [filePath, event] of updates) {
              await updateMockData(filePath, event);
            }
            if (updates.length > 0) {
              server.ws.send({
                type: 'custom',
                event: 'mock:update'
              });
            }
          })
          .catch((error) => {
            __logger.error('批量更新 mock 数据失败:', error);
          });
      };

      watcher.on('all', async (event, changedFilePath) => {
        __logger.info('changedFilePath:', event, changedFilePath);
        if (event === 'add' || event === 'change' || event === 'unlink') {
          // 文件变化统一进入待处理队列；同一个文件在短时间内重复变更时，
          // 以最后一次事件为准，减少不必要的重复编译与依赖重建。
          pendingUpdates.set(changedFilePath.replace(/\\/g, '/'), event);
          if (updateTimer) return;
          updateTimer = setTimeout(() => {
            updateTimer = undefined;
            flushPendingUpdates();
          }, 800);
        }
      });

      // Vite 服务关闭时及时释放 watcher 与定时器，避免开发期反复启动造成资源泄漏
      server.httpServer?.once('close', () => {
        if (updateTimer) {
          clearTimeout(updateTimer);
          updateTimer = undefined;
        }
        void watcher.close();
      });

      // 提供一个接口供客户端访问 mock 数据
      server.middlewares.use(async (req, res, next) => {
        // 第一步：规范化请求路径，并根据 routerPath 过滤非 mock 请求
        const urlPath = normalizeRequestPath(req.url);
        if (!shouldHandleRequest(urlPath)) {
          // 非 mock 请求，直接传递给 Vite
          next();
          return;
        }

        // 第二步：通过路由索引查找命中的 mock 路由
        const matchedRoute = findMockRoute(routeIndex, req.method, urlPath);
        if (!matchedRoute) {
          // 未命中 mock 路由，直接传递给 Vite
          next();
          return;
        }

        try {
          // 第三步：命中后再执行解析器链，尽量减少对普通请求的副作用
          await applyMockMiddlewares(req, res);
          if (res.writableEnded) return;
          // 第四步：执行最终 mock 响应；动态路由参数会在这里按命中结果自动注入
          await handerFn(req, res, next, matchedRoute);
        } catch (error) {
          next(error as Error);
        }
      });
    }
  };
}
