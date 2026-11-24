import type { Metadata } from "next";
import GalaxyTransition from "@/components/GalaxyTransition";
import { SITE_CONTENT } from "@/lib/content";

export const metadata: Metadata = {
  title: SITE_CONTENT.metadata.home.title,
  description: SITE_CONTENT.metadata.home.description,
  openGraph: {
    title: SITE_CONTENT.metadata.home.title,
    description: SITE_CONTENT.metadata.home.description,
    type: "website",
  },
};

export default function HomePage() {
  return <GalaxyTransition />;
}
