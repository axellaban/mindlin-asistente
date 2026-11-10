/** Un mensaje como se ve en WhatsApp: *negrita*, _cursiva_ y los links que se pueden tocar. */
export function TextoWhatsApp({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*|_[^_\n]+_|https?:\/\/[^\s<>"]+)/g);
  return (
    <>
      {partes.map((p, i) => {
        if (/^\*[^*\n]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>;
        if (/^_[^_\n]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
        if (/^https?:\/\//.test(p)) {
          const url = p.replace(/[.,;:!?)]+$/, "");
          return (
            <span key={i}>
              <a href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
              {p.slice(url.length)}
            </span>
          );
        }
        return p;
      })}
    </>
  );
}
