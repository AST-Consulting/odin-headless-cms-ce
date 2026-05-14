import { SeoHealth } from "@/components/seo/SeoHealth";
import { AbTester } from "@/components/seo/AbTester";

export default function SeoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">SEO & Discover</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SeoHealth />
        <AbTester />
      </div>
    </div>
  );
}

