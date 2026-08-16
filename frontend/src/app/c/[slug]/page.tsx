import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function CampaignFeedbackPage() {
  return (
    <main className="bg-background text-foreground grid min-h-screen place-items-center overflow-hidden p-5 sm:p-8">
      <section className="w-full max-w-4xl">
        <h1 className="font-head mb-6 text-center text-[clamp(3.8rem,15vw,10rem)] leading-[0.78] tracking-[-0.09em] uppercase sm:mb-10">
          Feedback
        </h1>

        <form className="border-border bg-accent relative border-2 p-3 shadow-xl sm:p-4">
          <Textarea
            aria-label="Feedback"
            className="border-border h-44 resize-none border-2 px-4 py-4 pr-18 font-sans text-xl leading-tight font-semibold sm:h-52 sm:px-5 sm:py-5 sm:pr-22 sm:text-2xl"
            placeholder=""
          />
          <Button
            aria-label="Send feedback"
            className="absolute right-6 bottom-6 size-14 p-0 text-4xl leading-none sm:right-8 sm:bottom-8 sm:size-16"
            size="icon-lg"
            type="button"
          >
            <span aria-hidden="true">→</span>
          </Button>
        </form>
      </section>
    </main>
  );
}
