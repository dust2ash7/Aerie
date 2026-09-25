import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/aerie/Studio";

export const Route = createFileRoute("/")({
  component: Studio,
});
