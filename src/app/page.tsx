import { LandingContent } from "@/components/home/landing-content";
import { isDemoMode } from "@/lib/demo-mode";

export default function Home() {
  return <LandingContent demoMode={isDemoMode()} />;
}
