const Table = {
  render(headers, rows, options = {}) {
    const tableClass = ["table", options.className].filter(Boolean).join(" ");
    const thead = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
    const tbody = `<tbody>${rows.join("")}</tbody>`;

    return `<table class="${tableClass}">${thead}${tbody}</table>`;
  },
};

export { Table };
