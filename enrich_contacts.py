#!/usr/bin/env python3
"""
ZoomInfo Contact Enrichment Script
Reads enriched data from enriched_contacts.json and generates a formatted Excel file.
The actual ZoomInfo browsing is done by Claude using the browser-agent MCP tools.
"""

import json
import sys
import os
from pathlib import Path

try:
    from openpyxl import Workbook
    from openpyxl.styles import (
        PatternFill, Font, Alignment, Border, Side
    )
    from openpyxl.utils import get_column_letter
except ImportError:
    print("Installing openpyxl...")
    os.system(f"{sys.executable} -m pip install openpyxl -q")
    from openpyxl import Workbook
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from openpyxl.utils import get_column_letter


# ── Colour palette ──────────────────────────────────────────────────────────
HEADER_FILL   = PatternFill("solid", fgColor="1F3864")   # dark navy
ROW_ODD_FILL  = PatternFill("solid", fgColor="DCE6F1")   # light blue
ROW_EVEN_FILL = PatternFill("solid", fgColor="FFFFFF")   # white
RED_FILL      = PatternFill("solid", fgColor="FFCCCC")   # missing email

HEADER_FONT   = Font(name="Calibri", bold=True, color="FFFFFF", size=11)
BODY_FONT     = Font(name="Calibri", size=10)
LINK_FONT     = Font(name="Calibri", size=10, color="0563C1", underline="single")

THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

COLUMNS = [
    ("#",           5),
    ("Name",        22),
    ("Company",     28),
    ("Title",       30),
    ("Level",       12),
    ("Email",       34),
    ("Direct Phone",18),
    ("Mobile Phone",18),
    ("Notes",       40),
]


def load_contacts(path: str) -> list[dict]:
    with open(path) as f:
        return json.load(f)


def build_excel(contacts: list[dict], output_path: str) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Enriched Contacts"

    # ── Header row ──────────────────────────────────────────────────────────
    for col_idx, (header, width) in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font      = HEADER_FONT
        cell.fill      = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border    = BORDER
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    ws.row_dimensions[1].height = 22
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(COLUMNS))}1"

    # ── Data rows ───────────────────────────────────────────────────────────
    for row_num, contact in enumerate(contacts, start=2):
        fill = ROW_ODD_FILL if row_num % 2 == 1 else ROW_EVEN_FILL

        email        = contact.get("email") or ""
        direct_phone = contact.get("directPhone") or ""
        mobile_phone = contact.get("mobilePhone") or ""
        notes        = contact.get("notes") or ""

        values = [
            contact.get("id", row_num - 1),
            contact.get("name", ""),
            contact.get("company", ""),
            contact.get("title", ""),
            contact.get("level", ""),
            email,
            direct_phone,
            mobile_phone,
            notes,
        ]

        for col_idx, value in enumerate(values, start=1):
            cell = ws.cell(row=row_num, column=col_idx, value=value)
            cell.font      = BODY_FONT
            cell.alignment = Alignment(vertical="center", wrap_text=(col_idx == len(COLUMNS)))
            cell.border    = BORDER

            # Row background — red if email is missing
            if not email and col_idx == 6:
                cell.fill = RED_FILL
            else:
                cell.fill = fill

        ws.row_dimensions[row_num].height = 18

    # ── Summary row ─────────────────────────────────────────────────────────
    total = len(contacts)
    found = sum(1 for c in contacts if c.get("email"))
    summary_row = total + 2
    ws.cell(row=summary_row, column=1, value=f"Total: {total} contacts — "
            f"{found} emails found, {total - found} missing").font = Font(bold=True, size=10)

    wb.save(output_path)
    print(f"✓ Excel saved → {output_path}  ({found}/{total} emails enriched)")


def main():
    # Input: enriched_contacts.json (written by Claude after ZoomInfo browsing)
    enriched_path = Path("enriched_contacts.json")
    contacts_path = Path("contacts.json")
    output_path   = "enriched_contacts.xlsx"

    if enriched_path.exists():
        contacts = load_contacts(str(enriched_path))
        print(f"Loaded {len(contacts)} enriched contacts from {enriched_path}")
    elif contacts_path.exists():
        # Fall back to raw contacts (no enrichment yet)
        contacts = load_contacts(str(contacts_path))
        print(f"No enriched data yet — generating template from {contacts_path}")
    else:
        print("ERROR: Neither enriched_contacts.json nor contacts.json found.")
        sys.exit(1)

    build_excel(contacts, output_path)


if __name__ == "__main__":
    main()
