import { getSuccessStories } from "@/utils/getSuccessStories";
import SuccessStoriesCarousel from "./success-stories-carousel";

export default async function SuccessStories() {
  const stories = await getSuccessStories();
  return <SuccessStoriesCarousel stories={stories} />;
}
