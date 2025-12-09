import { defineComponent, ref, onMounted } from "vue";
import MarkdownRenderNg from "./MarkdownRenderNg";

export default defineComponent({
  setup() {
    const text = ref("");

    async function loadData() {
      return fetch("/public/sample1.md").then((res) => res.text());
    }

    onMounted(async () => {
      text.value = await loadData();
    });

    return () => {
      // console.log(1, text.value);
      return (
        <div>
          <MarkdownRenderNg content={text.value} />
        </div>
      );
    };
  },
});
