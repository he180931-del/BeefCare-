"""Convert an SRS .docx into the plain-text layout used by docs/requirements/SRS_*.txt.

Layout (same as SRS_2026-10-28.txt):
  [P<n> <heading level>] paragraph text      (level blank for body text)
  [TABLE block <n>]                          rows, cells joined by " | ",
  ...                                        paragraphs inside a cell joined by " / "
  [/TABLE]
<n> is the position of the paragraph/table among the document body's blocks.
Needs python-docx (pip install python-docx). Regenerate after Report 3 changes:
  python docs/tools/docx_to_srs_txt.py "docs/Reports/BeefCare_Report3_Software Requirement Specification_v1.2.docx" docs/requirements/SRS_Report3_v1.2.txt
"""
import re
import sys

import docx
from docx.table import Table
from docx.text.paragraph import Paragraph

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def clean(text: str) -> str:
    text = text.replace(' ', ' ').replace('\t', ' ')
    return re.sub(r'[ ​]+', ' ', text).strip()


def heading_level(par: Paragraph) -> str:
    name = par.style.name if par.style is not None else ''
    m = re.match(r'Heading (\d)', name)
    return m.group(1) if m else ''


def cell_text(cell) -> str:
    parts = []
    for block in cell._tc.iterchildren():
        if block.tag == W + 'p':
            t = clean(Paragraph(block, cell).text)
            if t:
                parts.append(t)
        elif block.tag == W + 'tbl':  # nested table: flatten its rows
            for row in table_rows(Table(block, cell)):
                parts.append(' | '.join(row))
    return ' / '.join(parts)


def table_rows(table: Table):
    rows = []
    for row in table.rows:
        seen, cells = set(), []
        for cell in row.cells:  # merged cells repeat the same <w:tc>
            if id(cell._tc) in seen:
                continue
            seen.add(id(cell._tc))
            cells.append(cell_text(cell))
        while cells and not cells[-1]:
            cells.pop()
        if any(cells):
            rows.append(cells)
    return rows


def main(src: str, dst: str) -> None:
    document = docx.Document(src)
    out = []
    index = 0
    for block in document.element.body.iterchildren():
        if block.tag == W + 'p':
            par = Paragraph(block, document)
            text = clean(par.text)
            if text:
                out.append(f'[P{index} {heading_level(par)}] {text}')
            index += 1
        elif block.tag == W + 'tbl':
            rows = table_rows(Table(block, document))
            if rows:
                out.append(f'[TABLE block {index}]')
                out.extend(' | '.join(r) for r in rows)
                out.append('[/TABLE]')
            index += 1
    with open(dst, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(out) + '\n')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
