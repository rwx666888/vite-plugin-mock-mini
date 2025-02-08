import { Plugin, Connect } from 'vite';
import path from 'path';
import chokidar from 'chokidar';
import { glob } from 'fast-glob';
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
} & (
  | {
      isNotJson: true;
      /** 响应函数 - 非JSON响应时使用 */
      response: (req: TypeExtendReq, res: ServerResponse) => void;
    }
  | {
      isNotJson?: false;
      /** 响应数据或返回响应数据的函数 - JSON响应时使用 */
      response: { [key: string]: any } | ((req: TypeExtendReq) => { [key: string]: any });
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
    /** 启用param解析器 默认 true */
    param?: boolean;
  };
  /**
   * 需要使用解析器的路由路径 默认 ''
   * @description 建议mock的接口路径与实际接口路径分离，目的是尽可能规避解析器对非mock接口的影响
   * 支持字符串或字符串数组，例如:
   * - 字符串: '/mock-api'
   * - 数组: ['/mock-api', '/test-api']
   */
  routerPath?: string | string[];
  /**
   * 是否启用 routerParser 中的路由解析器，默认 true，
   * @description 目的是尽可能规避 解析器对非mock接口的影响，否则可能导致接口影响异常；

   *  开启：则应用routerParser 中开启的解析器，
   *
   *   -- routerPath 不为空 则 解析器 只匹配 routerPath 路径;
   *
   *   -- routerPath 为空 则 解析器 匹配注入的mock接口地址 ;
   *
   *  关闭：则不应用routerParser 中开启的解析器，注意：routerParserArr 中解析器依旧有效
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
};

// 修改 TypeExtendReq 类型定义，继承 IncomingMessage
type TypeExtendReq = Connect.IncomingMessage & {
  params: Record<string, any>;
  query: Record<string, any>;
  body: Record<string, any>;
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
  const __1req = req as TypeExtendReq;
  if (!__1req.params) __1req.params = {}; // 如果没有 params，初始化为 {}
  if (!__1req.query) __1req.query = {}; // 如果没有 query，初始化为 {}
  if (!__1req.body) __1req.body = {}; // 如果没有 body，初始化为 {}
  // 检查 param 方法是否已存在
  if (!__1req.param) {
    // 使用箭头函数避免 this 绑定问题
    __1req.param = (paramName: string) => {
      return __1req.body?.[paramName] || __1req.query?.[paramName] || __1req.params?.[paramName];
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
      _response.setHeader('Content-Type', 'application/json');
      _response.end(JSON.stringify(body));
    };
  }

  next();
}

/**
 * 处理mock请求的核心函数
 * @param req - 请求对象
 * @param res - 响应对象
 * @param next - 下一个中间件
 * @param mockData - mock数据数组
 */
async function handerFn(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
  mockData: MockData[]
) {
  const _req = req as TypeExtendReq;

  if (!_req.url) {
    next();
    return;
  }

  // 匹配路由
  const _target = mockData.find((item) => {
    const { method = 'GET' } = item;
    if (method && method.toUpperCase() !== _req.method?.toUpperCase()) {
      return false;
    }
    const matchPath = match(item.url);
    const matchFlag = matchPath(_req.url?.split('?')[0] || '');
    return !!matchFlag;
  });

  if (!_target) {
    next();
    return;
  }

  // 处理延时
  if (_target.timeout) {
    await _sleep(_target.timeout);
  }

  // 匹配到路由
  if (_target.isNotJson) {
    if (typeof _target.response === 'function') {
      _target.response(_req, res as TypeExtendRes);
    } else {
      res.statusCode = 500;
      res.end('---error---  response must be a function when isNotJson is true');
    }
  } else {
    if (typeof _target.response === 'function') {
      try {
        const _result = await Promise.resolve(_target.response(_req));
        res.statusCode = _target.status || 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(_result));
      } catch (_) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('---error--- The response function returns data that is not valid JSON.');
      }
    } else if (typeof _target.response === 'object') {
      try {
        res.statusCode = _target.status || 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(_target.response));
      } catch (_) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('---error--- response is not valid JSON.');
      }
    } else {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('---error--- response is not function or object');
    }
  }
}

// 解析查询参数并附加到 req.query
function queryParser() {
  return (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const _req = req as TypeExtendReq;
    if (_req.originalUrl) {
      const parsedUrl = new URL(_req.originalUrl, `http://${_req.headers.host}`);
      _req.query = qs.parse(parsedUrl.search.slice(1));
    }
    next();
  };
}

// 解析路径参数并附加到 req.params
function paramParser(getMockData: () => MockData[]) {
  return (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const _req = req as TypeExtendReq;
    if (_req.originalUrl) {
      const mockData = getMockData();
      for (const route of mockData) {
        const matcher = match(route.url);
        const matched = matcher(_req.originalUrl.split('?')[0]);
        if (matched) {
          _req.params = matched.params || {};
          break;
        }
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
  /** 是否为顶层文件 */
  isTopLevel: boolean;
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

export function mockApiServer(options?: mockApiServerOptions): Plugin {
  // 存储 mock 数据
  let mockData: MockData[] = [];

  // 存储文件依赖关系
  const fileDependencyMap: FileDependencyMap = new Map();

  const { routerParser: _routerParser = {}, ...otherOpt } = options || {};
  const _opt: _opt = {
    mockDir: 'mock',
    mockFileMatch: '',
    routerParser: {
      json: true,
      url: true,
      txt: true,
      raw: true,
      query: true,
      param: true,
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

  const _routerParserMap = {
    json: bodyParser.json(),
    url: bodyParser.urlencoded({ extended: true }),
    txt: bodyParser.text(),
    raw: bodyParser.raw(),
    query: queryParser(),
    param: paramParser(() => mockData)
  };

  // 添加类型定义
  type RouterParserKey = keyof typeof _routerParserMap;

  // 获取 routerParser 的解析器
  const _routerParserArr = _opt.routerParserEnabled
    ? Object.entries(_opt.routerParser || {}).reduce((acc, [key, value]) => {
        if (value === true && _routerParserMap[key as RouterParserKey]) {
          acc.push(_routerParserMap[key as RouterParserKey]);
        }
        return acc;
      }, [] as Connect.NextHandleFunction[])
    : ([] as Connect.NextHandleFunction[]);

  // 添加扩展请求和响应中间件
  _routerParserArr.push(_extendRequestMiddleware, _extendResponseMiddleware);

  _routerParserArr.unshift(...((_opt.routerParserArr || [[], []])[0] || []));
  _routerParserArr.push(...((_opt.routerParserArr || [[], []])[1] || []));

  /**
   * 更新文件依赖信息
   * @param {string} filePath - 文件路径（绝对路径）
   * @param {string[]} dependencies - 依赖文件路径数组
   * @param {any} mod - 模块内容
   */
  const updateFileDependencyInfo = (filePath: string, dependencies: string[], mod: any) => {
    const projectRoot = process.cwd();

    // 过滤掉自身的依赖
    const realDependencies = dependencies.filter((dep) => {
      // 将相对路径转换为绝对路径进行比较
      const absoluteDepPath = path.resolve(projectRoot, dep).replace(/\\/g, '/');
      return absoluteDepPath !== filePath;
    });

    // 检查是否为顶层文件
    const isTopLevel = !Array.from(fileDependencyMap.values()).some((info) =>
      info.dependencies
        .map((dep) => path.resolve(projectRoot, dep).replace(/\\/g, '/'))
        .includes(filePath)
    );

    // 直接从 mod 中获取 mockData
    const mockData = mod?.default || mod;

    console.log('---filePath--1--\n', filePath, '\n----');
    // 更新文件信息
    fileDependencyMap.set(filePath, {
      isTopLevel,
      dependencies: realDependencies, // 保存相对路径
      topLevelDependents: [],
      mockData: Array.isArray(mockData) ? mockData : undefined
    });

    // 更新被依赖关系
    for (const dep of realDependencies) {
      // 获取依赖文件的绝对路径
      const absoluteDepPath = path.resolve(projectRoot, dep).replace(/\\/g, '/');
      const depInfo = fileDependencyMap.get(absoluteDepPath) || {
        isTopLevel: false,
        dependencies: [],
        topLevelDependents: []
      };

      if (isTopLevel && !depInfo.topLevelDependents.includes(filePath)) {
        depInfo.topLevelDependents.push(filePath);
      }
      fileDependencyMap.set(absoluteDepPath, depInfo);
    }

    // 打印 fileDependencyMap
    fileDependencyMap.forEach((value, key) => {
      console.log('--init-fileDependencyMap--\n', key, value, '\n----');
    });
  };

  /**
   * 递归获取所有顶层依赖文件
   * @param  filePath - 文件路径
   * @param  visited - 已访问的文件集合，用于防止循环依赖
   * @returns  顶层依赖文件路径数组
   */
  const getAllTopLevelDependents = (filePath: string, visited = new Set<string>()): string[] => {
    if (visited.has(filePath)) {
      return [];
    }
    visited.add(filePath);

    const fileInfo = fileDependencyMap.get(filePath);
    if (!fileInfo) {
      // 如果找不到文件信息,返回文件本身
      return [filePath];
    }

    // 如果是顶层文件，直接返回自身
    if (fileInfo.isTopLevel) {
      return [filePath];
    }

    // 递归获取所有直接依赖此文件的文件的顶层依赖
    const allTopLevelDependents = Array.from(fileDependencyMap.entries())
      .filter(([_, info]) => info.dependencies.includes(filePath))
      .flatMap(([dependentPath]) => getAllTopLevelDependents(dependentPath, visited));

    return [...new Set(allTopLevelDependents)];
  };

  // 加载mock文件
  const loadMockFile = async (filePath: string) => {
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
      console.log('---filePath--\n', filePath, '\n dependencies', dependencies, '\n----');

      updateFileDependencyInfo(filePath, dependencies, mod);
    } catch (error) {
      console.error(`Error loading mock file: ${filePath}`, error);
      // 发生错误时更新依赖信息，但清除 mockData
      // updateFileDependencyInfo(filePath, [], null);
    }
  };

  // 加载mock目录下的文件
  /*   const loadMockDir = async () => {
    mockData = []; // 清空旧数据
    const files = await glob(_opt.mockFileMatch, {
      cwd: mockDirPath,
      ignore: _ignore,
      absolute: true,
      onlyFiles: true
    });

    for (const file of files) {
      const data = await loadMockFile(file);
      if (Array.isArray(data)) {
        mockData = mockData.concat(data);
      }
    }
  }; */

  /**
   * 更新mock数据
   * @param {string} changedFilePath - 变更的文件路径
   * @param {'add' | 'change' | 'unlink'} event - 文件变更类型
   */
  const updateMockData = async (changedFilePath?: string, event?: 'add' | 'change' | 'unlink') => {
    try {
      if (changedFilePath && event) {
        // 获取需要重新加载的文件
        // 遍历打印 fileDependencyMap
        fileDependencyMap.forEach((value, key) => {
          console.log('---fileDependencyMap--\n', key, value, '\n----');
        });
        const filesToReload = getAllTopLevelDependents(changedFilePath);
        console.log('---filesToReload--\n', filesToReload, '\n----');
        const isTopLevel = filesToReload[0] === changedFilePath;

        if (event === 'unlink') {
          // 文件被删除
          if (isTopLevel) {
            // 如果是顶层文件，直接从映射中删除
            fileDependencyMap.delete(changedFilePath);
          } else {
            // 如果是被依赖文件，尝试重新加载依赖它的顶层文件
            // 这样会在顶层文件中产生编译错误，更符合开发者预期
            for (const topLevelFile of filesToReload) {
              try {
                await loadMockFile(topLevelFile);
              } catch (error) {
                console.error(
                  `重新加载顶层文件 ${topLevelFile} 失败，可能是由于依赖文件 ${changedFilePath} 被删除:`,
                  error
                );
                // 保留错误状态，但清除该文件的 mockData
                const topLevelInfo = fileDependencyMap.get(topLevelFile);
                if (topLevelInfo) {
                  topLevelInfo.mockData = undefined;
                }
              }
            }
            // 最后删除被依赖文件的映射信息
            fileDependencyMap.delete(changedFilePath);
          }
        } else {
          // 对于新增或修改，尝试加载文件
          for (const file of filesToReload) {
            await loadMockFile(file);
          }
        }
      } else {
        // 完整加载目录
        const files = await glob(_opt.mockFileMatch, {
          cwd: mockDirPath,
          ignore: _ignore,
          absolute: true,
          onlyFiles: true
        });

        // 清理已不存在的文件
        for (const [filePath] of fileDependencyMap) {
          if (!files.includes(filePath)) {
            fileDependencyMap.delete(filePath);
          }
        }
        console.log('---files--\n', files, '\n----');

        // 加载所有文件
        for (const file of files) {
          await loadMockFile(file);
        }
      }

      // 从 fileDependencyMap 中收集所有有效的 mockData
      mockData = Array.from(fileDependencyMap.values())
        .filter((info) => Array.isArray(info.mockData))
        .flatMap((info) => info.mockData as MockData[]);
    } catch (error) {
      console.error('更新 mock 数据失败:', error);
    }
  };

  return {
    name: 'vite-plugin-mock-mini',
    async configureServer(server) {
      await updateMockData();

      // console.log('--5--\n mockData', mockData, '\n----');
      // 使用 chokidar 监控文件变化，排除临时文件
      const watcher = chokidar.watch(mockDirPath, {
        ignored: _ignore,
        ignoreInitial: true
      });

      watcher.on('all', async (event, changedFilePath) => {
        if (event === 'add' || event === 'change' || event === 'unlink') {
          await updateMockData(changedFilePath, event);
          /* server.ws.send({
            type: 'custom',
            event: 'mock-data-updated',
            data: mockData
          }); */
        }
        console.log('--2--\n changedFilePath', event, changedFilePath);
      });

      // 添加 routerParser 的解析器
      if (_routerParserArr.length > 0) {
        if (_opt.routerPath) {
          _routerPaths.forEach((path) => {
            _routerParserArr.forEach((middleware) => {
              server.middlewares.use(path, middleware);
            });
          });
        }
      }

      // 提供一个接口供客户端访问 mock 数据
      server.middlewares.use(async (req, res, next) => {
        const isMatchPath = _routerPaths.some((path) => req.url?.startsWith(path));
        if (isMatchPath) {
          await handerFn(req, res, next, mockData);
        } else {
          next();
        }
      });
    }
  };
}
