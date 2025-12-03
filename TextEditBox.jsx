import { defineComponent, onMounted, onUnmounted, shallowRef } from "vue";

export default defineComponent({
  props: ["content"],
  emits: ["close"],
  setup(props, { emit }) {
    const container = shallowRef();
    const draft = shallowRef();

    function handleClick(ev) {
      // 点击自身或子元素
      if (
        ev.target === container.value ||
        container.value.contains(ev.target)
      ) {
        return;
      }

      emit("close", draft.value);
    }

    onMounted(() => {
      draft.value = props.content ?? "";

      setTimeout(() => {
        document.addEventListener("click", handleClick);
      });
    });

    onUnmounted(() => {
      document.removeEventListener("click", handleClick);
    });

    return () => {
      return (
        <div
          ref={container}
          style="background-color: red; height: 100%; max-height: 100%; overflow-y: auto; width: 100%"
        >
          <textarea
            v-model={draft.value}
            style="height: 100%; max-height: 100%; overflow-y: auto; width: 100%"
          ></textarea>
        </div>
      );
    };
  },
});
