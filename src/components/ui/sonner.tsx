import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toasts con los tokens del sistema (soft + border por tono) en vez de
 * `richColors`, que traía la paleta propia de Sonner (verde y rojo
 * saturados, ajenos al resto de la app y sin modo oscuro coherente).
 *
 * Los estilos de Sonner se inyectan sin `@layer`, así que le ganan a
 * cualquier utilidad de Tailwind v4 (que vive en `@layer utilities`): por
 * eso los colores van con `!`.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          // Los colores van por tipo y no en `toast`: con dos `!` sobre la
          // misma propiedad ganaría el que Tailwind emita último, no el tipo.
          toast: "group toast shadow-lg rounded-lg!",
          default: "bg-background! text-foreground! border-border!",
          loading: "bg-background! text-foreground! border-border!",
          description: "text-current! opacity-80",
          actionButton: "bg-primary! text-primary-foreground!",
          cancelButton: "bg-muted! text-muted-foreground!",
          success: "bg-success-soft! border-success-border! text-success!",
          error: "bg-destructive-soft! border-destructive-border! text-destructive!",
          warning: "bg-warning-soft! border-warning-border! text-warning!",
          info: "bg-info-soft! border-info-border! text-info!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
