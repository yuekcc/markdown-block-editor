import "github-markdown-css/github-markdown-light.css";
import markdownIt from "markdown-it";
import { defineComponent, h, onMounted, shallowRef } from "vue";

const md = markdownIt();

function tokensToVNodes(tokens) {
  const root = { children: [] };
  const stack = [root];
  const headingStack = [];
  let nextId = 0;

  // console.log("tokens", tokens);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let parent = stack.at(-1);
    let parentId = headingStack.at(-1)?.id;

    if (token.type.endsWith("_open")) {
      if (token.level === 0 && token.block) {
        const id = ++nextId;

        if (token.type === "heading_open") {
          const level = parseInt(token.tag.substring(1), 10);

          const prev = JSON.parse(JSON.stringify(headingStack));

          while (
            headingStack.length > 0 &&
            headingStack.at(-1).level >= level
          ) {
            headingStack.pop();
          }
          parentId = headingStack.at(-1)?.id;

          headingStack.push({ level, id });
          const curr = JSON.parse(JSON.stringify(headingStack));
          console.log("headingStack", prev, "=>", curr);
        }

        const wrapper = h("div", { class: "block", parentId, id: id }, []);
        parent.children.push(wrapper);
        stack.push(wrapper);
        parent = stack.at(-1);

        const div = h(token.tag, { parentId, id: ++nextId }, []);
        parent.children.push(div);
        stack.push(div);
      } else {
        const div = h(token.tag, {}, []);
        parent.children.push(div);
        stack.push(div);
      }
    } else if (token.type.endsWith("_close")) {
      if (token.level === 0 && token.block) {
        stack.pop();
      }
      stack.pop();
    } else if (token.type === "inline") {
      const divs = tokensToVNodes(token.children ?? []);
      parent.children.push(h("span", { parentId }, divs));
    } else if (token.type === "fence") {
      const div = h("div", { class: "block", parentId }, []);
      div.children.push(h("pre", {}, [h("code", {}, token.content)]));
      parent.children.push(div);
    } else {
      parent.children.push(token.content);
    }
  }

  return root.children;
}

function parseMarkdownText(text) {
  const tokens = md.parse(text);
  return tokensToVNodes(tokens);
}

const MarkdownRender = defineComponent({
  props: ["content"],
  setup(props) {
    const containerRef = shallowRef();
    const blockToolbarContainerRef = shallowRef();
    const blockEditorContainerRef = shallowRef();
    const blockRefs = shallowRef([]);
    const lastVisited = shallowRef([]);

    function queryBlocks() {
      blockRefs.value = containerRef.value.querySelectorAll(".block");
      // console.log(blockRefs.value);
    }

    function addSelected(target) {
      target.classList.add("selected");
      lastVisited.value.push(target);

      if (/h\d/i.test(target.firstChild.nodeName)) {
        // debugger
        const subNodes = containerRef.value.querySelectorAll(
          `.block[parentid=${JSON.stringify(target.id)}]`
        );
        for (const subNode of subNodes) {
          // subNode.classList.add("selected");
          // lastVisited.value.push(subNode);
          addSelected(subNode);
        }
      }
    }

    function setupBlockToolbar() {
      containerRef.value.addEventListener(
        "pointerenter",
        (ev) => {
          // console.log("pointerenter");
          if (!ev.target.classList.contains("block")) {
            return;
          }

          if (lastVisited.value.length > 0) {
            lastVisited.value.forEach((el) => {
              el.classList.remove("selected");
            });
            lastVisited.value = [];
          }

          addSelected(ev.target);
        },
        { capture: true }
      );

      containerRef.value.addEventListener("pointerleave", (ev) => {
        // console.log("pointerleave");
        if (lastVisited.value.length > 0) {
          lastVisited.value.forEach((el) => {
            el.classList.remove("selected");
          });
          lastVisited.value = [];
        }
      });
    }

    const RenderContent = defineComponent({
      setup() {
        onMounted(() => {
          // console.log("RenderContent mounted");
          queryBlocks();
          setupBlockToolbar();
        });
        return () => parseMarkdownText(props.content ?? "");
      },
    });

    return () => {
      return (
        <div class="markdown-body" style="width: 800px; margin: 0 auto">
          <div ref={containerRef}>
            <RenderContent />
          </div>
          <div class="blockToolbarContainer" ref={blockToolbarContainerRef}>
            <div class="mount"></div>
          </div>
          <div class="blockEditorContainer" ref={blockEditorContainerRef}>
            <div class="mount"></div>
          </div>
        </div>
      );
    };
  },
});

export default MarkdownRender;
