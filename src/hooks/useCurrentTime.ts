import { createSharedComposable, useIntervalFn, useTimestamp } from '@vueuse/core';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

// 所有条目共享每秒更新的时间戳，最后一个使用者卸载时停止计时
export const useCurrentTime = createSharedComposable(() =>
  useTimestamp({ scheduler: callback => useIntervalFn(callback, 1000) }),
);

// 跟随共享时钟刷新相对时间，沿用当前 Day.js 语言
export const useRelativeTime = (time: MaybeRefOrGetter<string | number | Date | Dayjs>) => {
  const currentTime = useCurrentTime();
  return computed(() => dayjs(toValue(time)).from(currentTime.value));
};
