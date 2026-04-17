import { ResultsClient } from "@/components/results/ResultsClient";

export const metadata = {
  title: "Your matches — Kip It Real",
  description: "Your top three glove recommendations from the Kip It Real matchmaker.",
};

export default function ResultsPage() {
  return (
    <section>
      <div className="mx-auto max-w-content px-4 py-12 md:px-8 md:py-16">
        <ResultsClient />
      </div>
    </section>
  );
}
