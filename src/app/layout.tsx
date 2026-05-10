import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist_Mono, Lora, Playfair_Display } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
	title: "OpenStory — 小说创作，由此点亮",
	description:
		"一款带有 AI 合著者的小说创作工具。在智能辅助下撰写、编辑和规划你的小说。",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const playfair = Playfair_Display({
	subsets: ["latin"],
	variable: "--font-playfair",
	display: "swap",
});

const lora = Lora({
	subsets: ["latin"],
	variable: "--font-lora",
	display: "swap",
});

const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-geist-mono",
	display: "swap",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html
			className={`${playfair.variable} ${lora.variable} ${geistMono.variable}`}
			lang="zh-CN"
		>
			<body>
				<TRPCReactProvider>{children}</TRPCReactProvider>
			</body>
		</html>
	);
}
