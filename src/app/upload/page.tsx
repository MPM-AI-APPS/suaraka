"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import { bytes } from "@/lib/utils";
import { toast } from "sonner";

export default function UploadPage() {
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported.");
      return;
    }
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${basePath}/api/books`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(t.upload.success);
      router.push(`/library/${data.book.id}`);
    } catch (err) {
      console.error(err);
      toast.error(t.upload.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 suaraka-reveal">
      <div>
        <h1 className="font-heading text-3xl tracking-tight md:text-4xl">{t.upload.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.upload.subtitle}</p>
      </div>

      <Card className="suaraka-glass">
        <CardContent className="p-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border/70 bg-background/40 hover:bg-secondary/40"
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UploadCloud className="h-7 w-7" />
            </div>
            <CardTitle className="font-heading text-lg">{t.upload.drop}</CardTitle>
            <CardDescription>PDF only · up to 50 MB</CardDescription>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </div>

          {file && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-border/70 bg-card p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{bytes(file.size)}</div>
                </div>
              </div>
              <Button onClick={upload} disabled={busy} className="rounded-full">
                {busy ? (
                  <>
                    <Loader2 className="animate-spin" /> {t.upload.processing}
                  </>
                ) : (
                  "Upload"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
