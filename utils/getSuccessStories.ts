import storiesData from "@/json/success-stories.json";

export type SuccessStoryType = {
  id: number;
  quote: string;
  name: string;
  role: string;
  outcome: string;
  category: string;
};

export async function getSuccessStories(): Promise<SuccessStoryType[]> {
  return storiesData as SuccessStoryType[];
}
