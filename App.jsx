import { defineComponent, ref, onMounted } from "vue";
import MarkdownRender from "./MarkdownRender";

export default defineComponent({
  setup() {
    const text = ref("");

    async function loadData() {
      return fetch("/public/sample.md").then((res) => res.text());
    }

    onMounted(async () => {
      text.value = await loadData();
    });

    return () => {
      // console.log(1, text.value);
      return (
        <div>
          <MarkdownRender content={text.value} />
        </div>
      );
    };
  },
});
