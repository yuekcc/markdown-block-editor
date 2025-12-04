<script setup>
import "github-markdown-css/github-markdown-light.css";
import markdownIt from "markdown-it";
import { defineComponent, h, onMounted, shallowRef } from "vue";

const md = markdownIt();

function tokensToVNodes(tokens) {
  const root = { children: [] };
  const stack = [root];

  for (const token of tokens) {
    let parent = stack.at(-1);

    if (token.type.endsWith("_open")) {
      if (token.level === 0 && token.block) {
        const wrapper = h("div", { class: "block" }, []);
        parent.children.push(wrapper);
        stack.push(wrapper);
        parent = stack.at(-1);

        const div = h(token.tag, {}, []);
        parent.children.push(div);
        stack.push(div);
      } else {
        const div = h(token.tag, {}, []);
        parent.children.push(div);
        stack.push(div);
      }
    } else if (token.type.endsWith("_close")) {
      stack.pop();
      if (token.level === 0 && token.block) {
        stack.pop();
      }
    } else if (token.type === "inline") {
      const divs = tokensToVNodes(token.children ?? []);
      parent.children.push(h("span", {}, divs));
    } else if (token.type === "fence") {
      const div = h("div", { class: "block" }, []);
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

const props = defineProps(["content"]);

/**
 * @typedef {import('vue').ShallowRef<HTMLDivElement[]>} DivRefArray
 * @typedef {import('vue').ShallowRef<HTMLDivElement>} DivRef
 */

/**
 * @type {DivRef}
 */
const containerRef = shallowRef();
/**
 * @type {DivRef}
 */
const blockToolbarContainerRef = shallowRef();
/**
 * @type {DivRef}
 */
const blockEditorContainerRef = shallowRef();
/**
 * @type {DivRefArray}
 */
const blockRefs = shallowRef([]);
/**
 * @type {DivRefArray}
 */
const lastVisited = shallowRef([]);

function queryBlocks() {
  blockRefs.value = containerRef.value.querySelectorAll(".block");
  console.log(blockRefs.value);
}


function setupBlockToolbar() {
  containerRef.value.addEventListener(
    "pointerenter",
    (ev) => {
      if (!ev.target.classList.contains("block")) {
        return;
      }

      if (lastVisited.value.length > 0) {
        lastVisited.value.forEach((el) => {
          el.classList.remove("selected");
        });
        lastVisited.value = [];
      }

      ev.target.classList.add("selected");
      lastVisited.value.push(ev.target);
    },
    { capture: true }
  );

  containerRef.value.addEventListener("pointerleave", (ev) => {
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
      console.log("RenderContent mounted");
      queryBlocks();
      setupBlockToolbar();
    });
    return () => parseMarkdownText(props.content ?? "");
  },
});
</script>

<template>
  <div class="markdown-body" style="width: 800px; margin: 0 auto">
    <div ref="containerRef">
      <component :is="RenderContent"></component>
    </div>
    <div class="blockToolbarContainer" ref="blockToolbarContainerRef">
      <div class="mount"></div>
    </div>
    <div class="blockEditorContainer" ref="blockEditorContainerRef">
      <div class="mount"></div>
    </div>
  </div>
</template>

<style scoped>
.blockToolbarContainer {
  background-color: red;
}
</style>
