import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { ElMessage } from 'element-plus'

interface CusInternalAxiosRequestConfig extends InternalAxiosRequestConfig {
  useMockServer?: boolean
  hideGlobalMsg?: boolean
}

const defConfig: AxiosRequestConfig = {
  baseURL: import.meta.env.VITE_APP_BASE,
  headers: {
    'content-type': 'application/json'
  },
  timeout: 60000
}
const instance = axios.create(defConfig)

// Interceptor for requests
instance.interceptors.request.use(
  (config: CusInternalAxiosRequestConfig) => {
    // Control whether to enable mock-server only in development environment
    if (import.meta.env.NODE_ENV === 'development' && config.useMockServer === true) {
      config.baseURL = import.meta.env.VITE_APP_MOCK_SERVER
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor for responses
instance.interceptors.response.use(
  (response) => {
    // console.log('http-response-config:', response.config);
    return response.data
  },
  async (error) => {
    if (
      error.response &&
      !error.response.config.hideGlobalMsg &&
      error.response.status >= 400 &&
      error.response.status !== 404
    ) {
      ElMessage.warning(error.response.data.tip)
    }
    return Promise.reject(error)
  }
)

// Exporting HTTP request methods
export const post = <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
  instance.post(url, data, config)
export const get = <T>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> =>
  instance.get(url, { params, ...config })
export const del = <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
  instance.delete(url, { data, ...config })
export const put = <T>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> =>
  instance.put(url, params, config)

export default instance
