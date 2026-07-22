# LaTeX Formatting Preferences

- Use blue color for citation numbers (e.g., [1], [2]) to make them easily identifiable by configuring hyperref with citecolor=blue. Confidence: 0.90
- Keep "TÀI LIỆU THAM KHẢO" as the bibliography heading; use `\renewcommand{\refname}{TÀI LIỆU THAM KHẢO}` to avoid duplicate headings from `thebibliography`. Add a small English subtitle like "(References)" beneath if needed. Confidence: 0.85
- Ensure all citations in the document are actually referenced in the text; remove unused citations from the bibliography. Confidence: 0.80
- Organize bibliography into categories (Tiếng Việt, Tiếng Anh, Tài liệu trực tuyến) with centered bold subheadings between groups; maintain continuous numbering across all categories. Confidence: 0.70

# LaTeX Compilation

- Use xelatex for compilation when the document uses fontspec and Times New Roman. Confidence: 0.95

# LaTeX Script Safety

- When doing global regex find-and-replace of citation numbers like [N] in LaTeX files, avoid matching [N] inside command definitions (e.g., \newcommand{\cmd}[N], \newcolumntype{L}[N]) by using context-aware patterns or limiting replacement scope to the document body only. Confidence: 0.75
