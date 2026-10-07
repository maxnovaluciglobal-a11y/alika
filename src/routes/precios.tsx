import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirección permanente: los precios viven en la sección #precios de la
// landing. Va en el router y no en vercel.json para que funcione igual en
// Vercel, en el contenedor de self-hosting y en `npm run dev`.
export const Route = createFileRoute("/precios")({
  beforeLoad: () => {
    throw redirect({ to: "/", hash: "precios", statusCode: 301 });
  },
});
