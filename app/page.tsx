"use client";

import dynamic from "next/dynamic";

const DJConsole = dynamic(() => import("../components/console/DJConsole"), {
  ssr: false,
});

export default function Home() {
  return <DJConsole />;
}

