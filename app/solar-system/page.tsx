import type { Metadata } from "next";
import SolarSystemCanvas from "@/components/SolarSystemCanvas";
import { SITE_CONTENT } from "@/lib/content";

export const metadata: Metadata = {
  title: SITE_CONTENT.metadata.solarSystem.title,
  description: SITE_CONTENT.metadata.solarSystem.description,
  openGraph: {
    title: `${SITE_CONTENT.metadata.solarSystem.title} | ${SITE_CONTENT.metadata.root.siteName}`,
    description: SITE_CONTENT.metadata.solarSystem.description,
    type: "website",
  },
};

export default function SolarSystemPage() {
  return <SolarSystemCanvas />;
}
