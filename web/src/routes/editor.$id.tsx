import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/editor/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/compose",
      search: { seed: params.id },
    })
  },
})
