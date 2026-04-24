"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import { Sparkles, MessageSquareText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "sonner";

interface PageInsights {
  summary: string;
  takeaways: string[];
  vocabulary: { term: string; definition: string }[];
}

export function BookAssistant({
  bookId,
  currentPageId,
}: {
  bookId: string;
  currentPageId?: string;
}) {
  const { t, locale } = useI18n();
  const [summary, setSummary] = useState<PageInsights | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const doSummarize = async () => {
    if (!currentPageId) return;
    setSummarizing(true);
    try {
      const r = await api.summarizePage(bookId, currentPageId, locale);
      setSummary(r);
    } catch (e) {
      console.error(e);
      toast.error("Could not summarize.");
    } finally {
      setSummarizing(false);
    }
  };

  const doAsk = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      const r = await api.askBook(bookId, question, locale);
      setAnswer(r.answer);
    } catch (e) {
      console.error(e);
      toast.error("Could not answer.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="suaraka-glass">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> {t.book.summarize}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={summarizing || !currentPageId}
              onClick={doSummarize}
            >
              {summarizing ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {t.book.summarize}
            </Button>
          </div>
          {summary && (
            <div className="space-y-3 text-sm">
              <p className="text-foreground">{summary.summary}</p>
              {summary.takeaways.length > 0 && (
                <div>
                  <div className="font-heading text-xs uppercase tracking-wider text-muted-foreground">
                    {t.book.keyTakeaways}
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {summary.takeaways.map((tk, i) => (
                      <li key={i}>{tk}</li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.vocabulary.length > 0 && (
                <div>
                  <div className="font-heading text-xs uppercase tracking-wider text-muted-foreground">
                    {t.book.vocabulary}
                  </div>
                  <dl className="mt-1 grid gap-1">
                    {summary.vocabulary.map((v, i) => (
                      <div key={i} className="flex gap-2">
                        <dt className="font-medium">{v.term}</dt>
                        <dd className="text-muted-foreground">— {v.definition}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="suaraka-glass">
        <CardContent className="space-y-3 p-5">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4 text-primary" /> {t.book.ask}
          </CardTitle>
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t.book.askPlaceholder}
              onKeyDown={(e) => {
                if (e.key === "Enter") doAsk();
              }}
            />
            <Button onClick={doAsk} disabled={asking || !question.trim()} className="rounded-full">
              {asking ? <Loader2 className="animate-spin" /> : "Ask"}
            </Button>
          </div>
          {answer && (
            <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-sm leading-relaxed prose prose-sm prose-neutral dark:prose-invert max-w-none">
              <Markdown>{answer}</Markdown>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
