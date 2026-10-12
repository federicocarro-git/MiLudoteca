import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown de los resúmenes, con GFM (tablas, checklists, tachado). No
 * renderiza HTML crudo (es lo predeterminado de react-markdown). Estilos en
 * globals.css (.md y .md-hoja).
 */
export function Markdown({
  texto,
  variante = "normal",
}: {
  texto: string;
  variante?: "normal" | "hoja";
}) {
  return (
    <div className={variante === "hoja" ? "md md-hoja" : "md"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Tablas anchas: scroll horizontal en el celular en vez de romper el layout.
          table: ({ children }) => (
            <div className="md-tabla">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {texto}
      </ReactMarkdown>
    </div>
  );
}
