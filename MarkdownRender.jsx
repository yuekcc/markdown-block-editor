import markdownIt from "markdown-it";
import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  onMounted,
  ref,
  shallowRef,
  render,
} from "vue";
import "github-markdown-css/github-markdown-light.css";
import TextEditBox from "./TextEditBox";

function parseMarkdownText(text) {
  const md = markdownIt();
  const tokens = md.parse(text);
  // console.log("tokens", tokens);

  const root = [];
  const stack = [root];

  for (const token of tokens) {
    const parent = stack.at(-1);
    if (token.type.endsWith("_open")) {
      const block = [token];
      parent.push(block);
      stack.push(block);
    } else if (token.type.endsWith("_close")) {
      parent.push(token);
      stack.pop();
    } else {
      parent.push([token]);
    }
  }

  const result = root.map((block) => block.flat(Infinity));
  console.log("分块", result);

  return result;
}

function renderToVNodes(appContext, tokens) {
  const range = tokens.map((token) => token.map ?? []).flat(Infinity);
  const lineBegin = Math.min(...range);
  const lineEnd = Math.max(...range);

  const root = h(
    "div",
    { class: "block", "data-line-begin": lineBegin, "data-line-end": lineEnd },
    [],
  );
  const stack = [root];

  for (const token of tokens) {
    const parent = stack.at(-1);
    if (token.type.endsWith("_open")) {
      const node = h(token.tag, {}, []);
      parent.children.push(node);
      stack.push(node);
    } else if (token.type.endsWith("_close")) {
      // parent.push(token);
      stack.pop();
    } else if (token.type === "inline") {
      const vnode = renderToVNodes(appContext, token.children ?? []);
      parent.children.push(...vnode.children);
    } else if (token.type === "fence") {
      parent.children.push(h("pre", {}, [h("code", {}, token.content)]));
    } else {
      parent.children.push(h(token.tag || "span", {}, [token.content]));
    }
  }

  return root;
}

function renderTokenGroups(appContext, tokenGroups) {
  return tokenGroups.map((tokens) => renderToVNodes(appContext, tokens));
}

const MarkdownRender = defineComponent({
  props: {
    content: { type: String, required: true },
  },
  setup(props) {
    const vm = getCurrentInstance();
    const docContainer = ref();
    const toolbarContainer = ref();
    const textEditBoxContainer = ref();
    const lastVisitBlock = shallowRef([]);

    const tokenGroups = computed(() => {
      return parseMarkdownText(props.content);
    });

    const contentLines = computed(() => {
      return props.content.replaceAll("\r\n", "\n").split("\n");
    });

    const selectedRange = {
      lineBegin: null,
      lineEnd: null,
    };

    let isSelecting = false; // 是否正在框选

    /**
     *
     * @param {HTMLDivElement} block
     * @param {{lineBegin: number; lineEnd: number}} param1
     */
    function showToolbar(block, { lineBegin, lineEnd }) {
      selectedRange.lineBegin = lineBegin;
      selectedRange.lineEnd = lineEnd;

      const { x, y } = block.getBoundingClientRect();

      toolbarContainer.value.style.top = y + "px";
      toolbarContainer.value.style.left = x - 80 + "px";
      toolbarContainer.value.style.display = "block";
    }

    onMounted(() => {
      console.log(docContainer.value);
      isSelecting = false;

      docContainer.value.addEventListener(
        "pointerenter",
        (ev) => {
          if (lastVisitBlock.value.length > 0) {
            console.log("isSelecting", isSelecting, "skip pointerenter");
            return;
          }

          console.log("isSelecting", isSelecting);

          if (ev.target.classList.contains("block")) {
            /**
             * @type {HTMLElement}
             */
            const block = ev.target;
            showToolbar(block, {
              lineBegin: block.dataset.lineBegin,
              lineEnd: block.dataset.lineEnd,
            });
            lastVisitBlock.value = [block];
          }
        },
        true,
      );
    });

    function edit() {
      const { lineBegin, lineEnd } = selectedRange;
      if (lineBegin != null && lineEnd != null) {
        const text = contentLines.value.slice(lineBegin, lineEnd).join("\n");
        console.log("edit", lineBegin, lineEnd, text);

        textEditBoxContainer.value.style.display = "block";

        const height = lastVisitBlock.value
          .map((el) => el.getBoundingClientRect())
          .map((box) => box.height)
          .reduce((acc, it) => (acc += it), 0);

        /**
         * @type {HTMLDivElement}
         */
        const block = lastVisitBlock.value[0];
        if (!block) {
          return;
        }

        render(null, textEditBoxContainer.value);
        const { width } = block.getBoundingClientRect();

        textEditBoxContainer.value.style.top = block.offsetTop + "px";
        textEditBoxContainer.value.style.width = width + "px";
        textEditBoxContainer.value.style.height = height + "px";
        render(
          h(TextEditBox, {
            content: text,
            onClose: (updated) => {
              console.log("xxxxxxxxxxxxxxxx", updated);
              render(null, textEditBoxContainer.value);
              textEditBoxContainer.value.style.display = "none";
            },
          }),
          textEditBoxContainer.value,
        );
      }
    }

    let selectionBox = null; // 框选层元素

    let startX = 0; // 框选起始X坐标
    let startY = 0; // 框选起始Y坐标

    onMounted(() => {
      let targetBoxes = [];
      console.log('document.querySelectorAll(".block")', targetBoxes);

      docContainer.value.addEventListener("mousedown", (e) => {
        if (e.target !== docContainer.value) {
          return;
        }

        targetBoxes = document.querySelectorAll(".block");

        isSelecting = true;
        // 记录起始坐标（基于视口的坐标，与fixed定位匹配）
        startX = e.clientX;
        startY = e.clientY;

        // 创建框选层
        selectionBox = document.createElement("div");
        selectionBox.className = "selection-box";
        // 设置框选层初始位置
        selectionBox.style.left = `${startX}px`;
        selectionBox.style.top = `${startY}px`;
        document.body.appendChild(selectionBox);

        // 阻止默认行为：避免拖动时选中页面文字
        e.preventDefault();
      });

      // 3. 监听鼠标移动事件：更新框选范围
      document.addEventListener("mousemove", (e) => {
        if (!isSelecting || !selectionBox) return;

        // 计算实时坐标与起始坐标的差值
        const currentX = e.clientX;
        const currentY = e.clientY;

        // 处理反向拖动（向左/向上拖时，left/top为当前坐标，width/height为负数）
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        // 更新框选层的位置和大小
        selectionBox.style.left = `${left}px`;
        selectionBox.style.top = `${top}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;

        // 实时判断并标记选中的div（可选：也可在mouseup时一次性判断，性能更优）
        updateSelectedBoxes(left, top, width, height);
      });

      // 4. 监听鼠标松开事件：结束框选
      document.addEventListener("mouseup", () => {
        if (isSelecting && selectionBox) {
          // 移除框选层
          document.body.removeChild(selectionBox);
          // 重置状态
          isSelecting = false;
          selectionBox = null;
        }
      });

      // 5. 核心函数：判断div是否在框选范围内，更新选中状态
      function updateSelectedBoxes(
        selectLeft,
        selectTop,
        selectWidth,
        selectHeight,
      ) {
        // 框选区域的右边界和下边界
        const selectRight = selectLeft + selectWidth;
        const selectBottom = selectTop + selectHeight;

        const selectedBlocks = [];

        targetBoxes.forEach((box) => {
          // 获取div的位置信息（基于视口的坐标）
          const boxRect = box.getBoundingClientRect();

          // 碰撞检测：div与框选区域有重叠即视为选中
          // 条件：div的左边界 < 框选右边界 && div的右边界 > 框选左边界 && div的上边界 < 框选下边界 && div的下边界 > 框选上边界
          const isOverlap =
            boxRect.left < selectRight &&
            boxRect.right > selectLeft &&
            boxRect.top < selectBottom &&
            boxRect.bottom > selectTop;

          // 切换选中状态
          box.classList.toggle("selected", isOverlap);
          if (isOverlap) {
            selectedBlocks.push(box);
          }
        });

        if (selectedBlocks.length > 0) {
          const lineBegin = Math.min(
            ...selectedBlocks.map((it) => it.dataset.lineBegin),
          );
          const lineEnd = Math.max(
            ...selectedBlocks.map((it) => it.dataset.lineEnd),
          );

          console.log("selectedBlocks", selectedBlocks, lineBegin, lineEnd);

          showToolbar(selectedBlocks[0], { lineBegin, lineEnd });
          lastVisitBlock.value = selectedBlocks;
        }
      }
    });

    return () => {
      console.log(2);
      return (
        <div class="doc-container markdown-body" ref={docContainer}>
          <div style="width: 80%; margin: 0 auto;">
            {renderTokenGroups(vm.appContext, tokenGroups.value)}
            <div>
              <div
                ref={textEditBoxContainer}
                class="textEditBoxContainer"
              ></div>
            </div>
            <div ref={toolbarContainer} class="toolbar-mount-point">
              <div class="toolbar" onClick={edit}>
                ✏️编辑
              </div>
            </div>
          </div>
        </div>
      );
    };
  },
});

export default MarkdownRender;
