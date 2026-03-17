import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import zh from './zh';
import en from './en';

const DICTS = { zh, en };

/**
 * 深层取值：按 key 数组逐层访问对象
 */
function getDeep(obj, keys) {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

/**
 * useT() — 国际化翻译 Hook
 *
 * 返回一个 t(key, params?) 函数：
 *  - key: 点分路径字符串，如 'nav.home'、'explore.heatmapInsight'
 *  - params: 当字典值为函数时，传给该函数的参数对象
 *  - 若 key 在当前语言中找不到，回退到中文；仍找不到则返回 key 本身
 *
 * 示例：
 *   const t = useT();
 *   t('nav.home')                              // '首页' | 'Home'
 *   t('explore.heatmapInsight', { year: 27 }) // 动态模板字符串
 */
export function useT() {
  const { settings } = useSettings();
  const langCode = settings.language;

  return useMemo(() => {
    const dict = DICTS[langCode] ?? DICTS.zh;

    return function t(key, params) {
      const keys = key.split('.');
      let val = getDeep(dict, keys);

      // 中文回退
      if (val === undefined) {
        val = getDeep(zh, keys);
      }

      // 支持函数模板
      if (typeof val === 'function') {
        return val(params ?? {});
      }

      return val ?? key;
    };
  }, [langCode]);
}
