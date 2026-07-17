import type { Metadata } from "next";
import TimeHeistGame from "./game/TimeHeistGame";

export const metadata: Metadata = {
  title: "Time Heist: Tuesday Again — Play",
  description:
    "A chaotic 1–4 player museum heist trapped inside a twelve-minute time loop.",
};

export default function Home() {
  return <TimeHeistGame />;
}
