import { NavBar } from "./components/layout/NavBar";
import { Footer } from "./components/layout/Footer";
import { Hero } from "./components/hero/Hero";
import { WallWorkspace } from "./components/workspace/WallWorkspace";
import { HowItWorks } from "./components/how/HowItWorks";
import { VrPreview } from "./components/vr/VrPreview";
import { RidgeDivider } from "./components/decor/Ornaments";

export default function App() {
  return (
    <>
      <a href="#wall" className="skip-link">
        Skip to the climbing wall workspace
      </a>
      <NavBar />
      <main className="bg-grid">
        <Hero />
        <RidgeDivider fill="var(--color-forest)" className="-mb-px mt-16 sm:mt-20" />
        <WallWorkspace />
        <RidgeDivider fill="var(--color-forest)" flip className="-mt-px" />
        <HowItWorks />
        <RidgeDivider fill="var(--color-sky)" className="-mb-px" />
        <VrPreview />
      </main>
      <Footer />
    </>
  );
}
