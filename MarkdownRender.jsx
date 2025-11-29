import markdownIt from "markdown-it";
import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  onMounted,
  ref,
} from "vue";
import "github-markdown-css/github-markdown-light.css";

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

    onMounted(() => {
      console.log(docContainer.value);

      docContainer.value.addEventListener(
        "pointerenter",
        (ev) => {
          if (ev.target.classList.contains("block")) {
            /**
             * @type {HTMLElement}
             */
            const block = ev.target;
            selectedRange.lineBegin = block.dataset.lineBegin;
            selectedRange.lineEnd = block.dataset.lineEnd;

            toolbarContainer.value.style.top = block.offsetTop + "px";
            toolbarContainer.value.style.display = "block";
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
      }
    }

    return () => {
      console.log(2);
      return (
        <div class="doc-container markdown-body" ref={docContainer}>
          {renderTokenGroups(vm.appContext, tokenGroups.value)}
          <div ref={toolbarContainer} class="toolbar-mount-point">
            <div class="toolbar" onClick={edit}>
              ✏️编辑
            </div>
          </div>
        </div>
      );
    };
  },
});

export default MarkdownRender;
