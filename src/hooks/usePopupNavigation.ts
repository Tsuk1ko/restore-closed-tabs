import type { TabRecord } from '@/db/types';

interface PopupNavigationOptions {
  records: Readonly<Ref<TabRecord[]>>;
  page: Ref<number>;
  pageCount: Readonly<Ref<number>>;
  loading: Readonly<Ref<boolean>>;
  isMenuOpen: () => boolean;
  onOpen: (record: TabRecord, middle: boolean) => Promise<void>;
}

// 集中管理 popup 列表的键盘导航、鼠标高亮及异步更新后的焦点恢复
export function usePopupNavigation({
  records,
  page,
  pageCount,
  loading,
  isMenuOpen,
  onOpen,
}: PopupNavigationOptions) {
  const searchInput = ref<{ inputRef: HTMLInputElement | null }>();
  const recordList = ref<HTMLElement>();
  // 导航位置同时是列表唯一的 Tab 停靠点，但不代表列表拥有真实焦点
  const navigationIndex = ref(0);
  // 高亮存在时与导航位置一致，搜索框拥有真实焦点时也可以存在虚拟高亮
  const highlightedIndex = ref<number>();
  // 鼠标显式移出列表时取消待执行的焦点恢复，DOM 焦点始终以 activeElement 为准
  let focusVersion = 0;

  // 清除列表高亮，保留原来的导航位置和 Tab 停靠点
  function clearHighlight() {
    highlightedIndex.value = undefined;
  }

  // 返回搜索框并将光标放到末尾，便于继续编辑已有搜索词
  function focusSearch() {
    clearHighlight();
    const input = searchInput.value?.inputRef;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }

  // 同步列表高亮和导航位置，不改变实际输入焦点
  function selectRecord(index: number) {
    navigationIndex.value = index;
    highlightedIndex.value = index;
  }

  // 聚焦当前页指定行，并确保重复聚焦同一按钮时也能同步高亮
  function focusRecord(index: number) {
    const button = recordList.value?.querySelectorAll<HTMLButtonElement>(':scope > button')[index];
    if (!button) return;

    selectRecord(index);
    button.focus();
  }

  // 焦点离开列表时解除高亮，列表内部的焦点移动由下一项的 focus 事件更新
  function onRecordBlur(event: FocusEvent) {
    if (
      !(event.relatedTarget instanceof Node) ||
      !recordList.value?.contains(event.relatedTarget)
    ) {
      clearHighlight();
    }
  }

  // 翻页保留导航位置，具体行位置和真实焦点在记录更新后恢复
  function turnPage(offset: number) {
    page.value = Math.max(1, Math.min(pageCount.value, page.value + offset));
  }

  // 从当前行向上移动，首项返回搜索框
  function moveUp(index: number) {
    if (index === 0) focusSearch();
    else focusRecord(index - 1);
  }

  // 从当前行向下移动，末项有下一页时将更新后的目标位置设为首项
  function moveDown(index: number) {
    if (index < records.value.length - 1) {
      focusRecord(index + 1);
    } else if (!loading.value && page.value < pageCount.value) {
      // 提前更新导航位置，记录 watcher 据此同步下一页首项，等待期间避免连续跳页
      // 虚拟高亮下不主动聚焦，因此搜索框仍保留真实焦点
      selectRecord(0);
      turnPage(1);
    }
  }

  // 搜索框只识别上下键和翻页键，虚拟高亮时复用导航动作而非列表事件处理器
  function onSearchKeydown(event: KeyboardEvent) {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;

    if (event.key === 'ArrowUp' && highlightedIndex.value !== undefined) {
      event.preventDefault();
      moveUp(highlightedIndex.value);
    } else if (event.key === 'ArrowDown' && records.value.length) {
      event.preventDefault();
      if (highlightedIndex.value === undefined) focusRecord(0);
      else moveDown(highlightedIndex.value);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      turnPage(event.key === 'PageUp' ? -1 : 1);
    }
  }

  // 列表快捷键分别调用导航、聚焦和恢复动作，Tab 与空格等按键保留原生行为
  function onRecordKeydown(event: KeyboardEvent, record: TabRecord, index: number) {
    if (event.isComposing || event.altKey) return;

    // 在过滤修饰键前处理 Ctrl+F / Cmd+F，阻止浏览器默认查找行为
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      focusSearch();
      return;
    }

    if (event.ctrlKey || event.metaKey) return;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        moveUp(index);
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveDown(index);
        break;
      case 'Enter':
        // 阻止原生 Enter 再次触发 click，避免 Shift+Enter 同时前台打开
        event.preventDefault();
        if (!event.repeat) void onOpen(record, event.shiftKey);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        event.preventDefault();
        turnPage(-1);
        break;
      case 'ArrowRight':
      case 'PageDown':
        event.preventDefault();
        turnPage(1);
        break;
      case 'Home':
        event.preventDefault();
        focusRecord(0);
        break;
      case 'End':
        event.preventDefault();
        focusRecord(records.value.length - 1);
        break;
    }
  }

  // 鼠标实际移动时更新选中项，仅保留搜索框的输入焦点，静止鼠标不影响键盘或翻页
  function onRecordPointerMove(event: PointerEvent, index: number) {
    if (event.pointerType !== 'mouse' || (!event.movementX && !event.movementY)) return;
    // 右键菜单打开时保留菜单焦点，避免移动鼠标经过列表导致菜单失去键盘控制
    if (isMenuOpen()) return;

    if (document.activeElement === searchInput.value?.inputRef) selectRecord(index);
    else focusRecord(index);
  }

  // 鼠标离开列表区域时清空导航位置，只移除列表内的真实焦点
  function onRecordListLeave() {
    focusVersion++;
    clearHighlight();
    navigationIndex.value = 0;

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && recordList.value?.contains(activeElement)) {
      activeElement.blur();
    }
  }

  // 翻页及实时记录更新后收缩行位置，再等待 DOM 更新恢复原列表焦点
  watch(records, async () => {
    const version = focusVersion;
    const hadListFocus = recordList.value?.contains(document.activeElement);
    navigationIndex.value = Math.max(0, Math.min(navigationIndex.value, records.value.length - 1));
    // 搜索框上的虚拟高亮也跟随翻页收缩，列表为空时解除高亮
    if (highlightedIndex.value !== undefined) {
      highlightedIndex.value = records.value.length ? navigationIndex.value : undefined;
    }
    await nextTick();

    // 鼠标移出，或用户切换到其他控件、菜单时，不再恢复列表焦点
    if (
      !hadListFocus ||
      version !== focusVersion ||
      (document.activeElement !== document.body &&
        !recordList.value?.contains(document.activeElement))
    ) {
      return;
    }

    if (records.value.length) focusRecord(navigationIndex.value);
    else focusSearch();
  });

  return {
    searchInput,
    recordList,
    navigationIndex: readonly(navigationIndex),
    highlightedIndex: readonly(highlightedIndex),
    onSearchFocusChange: clearHighlight,
    onSearchKeydown,
    onRecordFocus: selectRecord,
    onRecordBlur,
    onRecordPointerDown: focusRecord,
    onRecordPointerMove,
    onRecordKeydown,
    onRecordListLeave,
  };
}
