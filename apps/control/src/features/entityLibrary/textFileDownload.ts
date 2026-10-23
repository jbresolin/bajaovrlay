/**
 * Hands the browser a text file to save, as "Exportar CSV" and "Baixar exemplo" do: the
 * text becomes a Blob, a link to it is clicked, and the link's address is let go at once.
 * Nothing leaves the page: the text was built here from the slices it holds.
 */
export function downloadTextFile(fileName: string, text: string, contentType: string): void {
  const fileAddress = URL.createObjectURL(new Blob([text], { type: contentType }));
  const link = document.createElement('a');
  link.href = fileAddress;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(fileAddress);
}

/** The type a CSV file is handed with: UTF-8, as its byte-order mark says. */
export const csvContentType = 'text/csv;charset=utf-8';
