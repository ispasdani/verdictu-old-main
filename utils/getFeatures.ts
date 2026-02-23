import featuresData from "@/json/features.json";

export type FeatureType = {
  id: number;
  title: string;
  img: string;
  imgAlt: string;
  date: string;
  duration: string; // keep naming consistent with your old component
  episode: string; // you can rename later if you want
  slug: string;
  content: {
    summary: string;
    section1: string;
    quote: [string, string];
    section2: string;
  }[];
};

export async function getFeatures(): Promise<FeatureType[]> {
  // Keep async so your component API stays identical.
  return featuresData as FeatureType[];
}
