import { get, post } from './request'

export const getTest = (data?: object) => get<any>('/testapi/get', data)
export const postTest = (data?: object) => post<any>('/testapi/post', data)
export const getTestList2 = (data?: object) => post<any>('/testapi/post2?c=6', data)
export const postTest2 = (data: { [key: string]: any }) =>
  post<any>(`/testapi/user/${data.id}/info?sub=${data.sub}`, data)
