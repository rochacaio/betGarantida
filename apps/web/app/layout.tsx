import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "BetGarantida — Controle de apostas",
  description: "Calcule, registre e acompanhe suas surebets e saldos por casa de aposta.",
  openGraph: {
    title: "BetGarantida — Mais clareza. Menos medo.",
    description: "Controle suas entradas, saldos e resultados.",
    images: [{ url: "/og.png", width: 1536, height: 808 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BetGarantida — Mais clareza. Menos medo.",
    description: "Controle suas entradas, saldos e resultados.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
